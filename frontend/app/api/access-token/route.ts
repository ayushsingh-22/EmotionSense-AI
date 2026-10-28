import { NextRequest, NextResponse } from 'next/server';
import { encode, getToken } from 'next-auth/jwt';
import { backendUrl } from '@/lib/backendAuthClient';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
const fail = (status: number) => NextResponse.json({ error: status === 401 ? 'Authentication required' : 'Service temporarily unavailable' }, {status,headers});

export async function GET(req: NextRequest) {
  const configured=process.env.NEXTAUTH_URL;
  if(!configured || !process.env.NEXTAUTH_SECRET) return fail(503);
  let origin: string;
  try { origin=new URL(configured).origin; } catch { return fail(503); }
  const site=req.headers.get('sec-fetch-site'), suppliedOrigin=req.headers.get('origin');
  if ((suppliedOrigin && suppliedOrigin !== origin) || (site && site !== 'same-origin') || (!suppliedOrigin && site !== 'same-origin')) return fail(403);
  const secure=origin.startsWith('https://');
  const cookieName=secure?'__Secure-next-auth.session-token':'next-auth.session-token';
  if(!req.cookies.getAll().some(c=>c.name===cookieName || c.name.startsWith(`${cookieName}.`))) return fail(401);
  const token=await getToken({req,secret:process.env.NEXTAUTH_SECRET,secureCookie:secure});
  if(!token?.accessToken || !token.refreshToken || !token.accessExpiresAt || !token.refreshExpiresAt) return fail(401);
  const absoluteExpiry=Date.parse(token.refreshExpiresAt);
  if(!Number.isFinite(absoluteExpiry) || absoluteExpiry<=Date.now()) return fail(401);
  let updated=false;
  const force=process.env.NODE_ENV==='development' && process.env.AUTH_TEST_FORCE_REFRESH==='true' && req.nextUrl.searchParams.get('force')==='1';
  if(force || !Number.isFinite(Date.parse(token.accessExpiresAt)) || Date.parse(token.accessExpiresAt)-Date.now()<=60000) {
    let result: Response;
    try { result=await fetch(`${backendUrl()}/api/auth/refresh`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refreshToken:token.refreshToken}),cache:'no-store',signal:AbortSignal.timeout(20000)}); }
    catch { return fail(503); }
    if(!result.ok) return fail(result.status===401?401:503);
    const pair=await result.json();
    if(!pair.accessToken || !pair.refreshToken || !pair.accessExpiresAt || !pair.refreshExpiresAt) return fail(503);
    token.accessToken=pair.accessToken;token.refreshToken=pair.refreshToken;token.accessExpiresAt=pair.accessExpiresAt;token.refreshExpiresAt=pair.refreshExpiresAt;updated=true;
  }
  if(!token.accessExpiresAt || !token.refreshExpiresAt) return fail(503);
  const response=NextResponse.json({token:token.accessToken},{headers});
  if(updated) {
    const maxAge=Math.max(1,Math.floor((Date.parse(token.refreshExpiresAt)-Date.now())/1000));
    const encoded=await encode({token,secret:process.env.NEXTAUTH_SECRET,maxAge});
    for(const chunk of req.cookies.getAll().filter(c=>c.name.startsWith(`${cookieName}.`))) response.cookies.set(chunk.name,'',{path:'/',maxAge:0,httpOnly:true,sameSite:'lax',secure});
    const options={path:'/',maxAge,httpOnly:true,sameSite:'lax' as const,secure};
    if(encoded.length<=3933) response.cookies.set(cookieName,encoded,options);
    else {
      response.cookies.set(cookieName,'',{...options,maxAge:0});
      for(let i=0;i<Math.ceil(encoded.length/3933);i++) response.cookies.set(`${cookieName}.${i}`,encoded.slice(i*3933,(i+1)*3933),options);
    }
  }
  return response;
}
