import { NextRequest, NextResponse } from 'next/server';
import { backendUrl } from '@/lib/backendAuthClient';
export async function POST(req: NextRequest) {
  const headers={'Cache-Control':'no-store'};
  try {
    if(Number(req.headers.get('content-length')||0)>8192) return NextResponse.json({error:'Invalid request'},{status:413,headers});
    const raw=await req.text();
    if(new TextEncoder().encode(raw).byteLength>8192) return NextResponse.json({error:'Invalid request'},{status:413,headers});
    let body: Record<string, unknown>;
    try {body=JSON.parse(raw)} catch {return NextResponse.json({error:'Invalid request'},{status:400,headers})}
    if(!body || typeof body!=='object' || Array.isArray(body)) return NextResponse.json({error:'Invalid request'},{status:400,headers});
    const result=await fetch(`${backendUrl()}/api/auth/register`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:body.email,password:body.password,name:body.fullName}),cache:'no-store',signal:AbortSignal.timeout(20000)});
    if(result.status===202) return NextResponse.json({message:'If eligible, instructions will be sent.'},{status:202,headers});
    return NextResponse.json({error:result.status>=500?'Service temporarily unavailable':'Invalid request'},{status:result.status>=500?503:result.status,headers});
  } catch {return NextResponse.json({error:'Service temporarily unavailable'},{status:503,headers})}
}
