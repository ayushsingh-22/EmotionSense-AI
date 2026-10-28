import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import next from 'next';

// Local fake backend only: no database, provider, or real user is contacted.
test('rotated refresh token is persisted beyond the replay window', { timeout: 120000 }, async () => {
  let active='refresh-0', generation=0, loginStatus=200;
  const backend=createServer(async(req,res)=>{
    let body='';for await(const chunk of req)body+=chunk;
    const input=body?JSON.parse(body):{};
    res.setHeader('Content-Type','application/json');
    const pair=()=>({accessToken:`access-${generation}`,refreshToken:active,accessExpiresAt:new Date(Date.now()+900000).toISOString(),refreshExpiresAt:new Date(Date.now()+86400000).toISOString()});
    if(req.url==='/api/auth/login'){if(loginStatus!==200){res.statusCode=loginStatus;res.end('{}');return}res.end(JSON.stringify({...pair(),user:{id:'unit-user',name:'Test'}}));return}
    if(req.url==='/api/auth/refresh'){
      if(input.refreshToken!==active){res.statusCode=401;res.end('{}');return}
      generation++;active=`refresh-${generation}`;res.end(JSON.stringify(pair()));return;
    }
    res.statusCode=404;res.end('{}');
  });
  await new Promise(resolve=>backend.listen(0,'127.0.0.1',resolve));
  const backendPort=backend.address().port;
  process.env.NEXTAUTH_SECRET=randomBytes(32).toString('hex');
  process.env.NEXT_PUBLIC_API_URL=`http://127.0.0.1:${backendPort}`;
  process.env.NODE_ENV='development';process.env.AUTH_TEST_FORCE_REFRESH='true';
  const app=next({dev:true,dir:process.cwd(),hostname:'127.0.0.1'});
  let web;
  try {
    await app.prepare();web=createServer(app.getRequestHandler());await new Promise(resolve=>web.listen(0,'127.0.0.1',resolve));
    const base=`http://127.0.0.1:${web.address().port}`;process.env.NEXTAUTH_URL=base;
    const cookies=new Map();
    const call=async(path,options={})=>{
      const headers=new Headers(options.headers);if(cookies.size)headers.set('cookie',[...cookies].map(([k,v])=>`${k}=${v}`).join('; '));
      const response=await fetch(base+path,{...options,headers,redirect:'manual'});
      for(const item of response.headers.getSetCookie()){const first=item.split(';',1)[0],index=first.indexOf('=');if(index>0){const key=first.slice(0,index),value=first.slice(index+1);if(value)cookies.set(key,value);else cookies.delete(key)}}
      return response;
    };
    let response=await call('/api/auth/csrf');assert.equal(response.status,200);const {csrfToken}=await response.json();
    const form=new URLSearchParams({csrfToken,email:'unit@invalid.test',password:'placeholder-password',json:'true'});
    for(const [status,expected] of [[401,'CredentialsSignin'],[403,'EmailNotVerified'],[503,'ServiceUnavailable']]){
      loginStatus=status;const rejected=await call('/api/auth/callback/credentials',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:form});const result=await rejected.json();assert.equal(new URL(result.url).searchParams.get('error'),expected);
    }
    loginStatus=200;
    response=await call('/api/auth/callback/credentials',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:form});assert.ok([200,302].includes(response.status));
    response=await call('/api/auth/session');assert.equal(response.status,200);assert.equal((await response.json())?.user?.id,'unit-user');
    response=await call('/api/access-token',{headers:{'sec-fetch-site':'cross-site'}});assert.equal(response.status,403);
    const refresh=async()=>{const r=await call('/api/access-token?force=1',{headers:{'sec-fetch-site':'same-origin'}});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.deepEqual(Object.keys(await r.json()),['token']);};
    await refresh();assert.equal(generation,1);
    response=await call('/api/auth/session');assert.equal(response.status,200);assert.equal(response.headers.getSetCookie().length,0);
    await new Promise(resolve=>setTimeout(resolve,31000));
    await refresh();assert.equal(generation,2);
    response=await call('/api/auth/session');assert.equal(response.status,200);const session=await response.json();assert.equal(session?.user?.id,'unit-user');assert.ok(!JSON.stringify(session).includes('refresh-'));assert.ok(!JSON.stringify(session).includes('access-'));
  } finally {if(web)await new Promise(resolve=>web.close(resolve));await app.close();await new Promise(resolve=>backend.close(resolve));}
});
