import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createBackendAuthRouter } from '../src/routes/backendAuthRoutes.js';

function fixture() {
  const state = { missing:false, rejected:false, unavailable:false, providerDown:false, sessionActive:true, challengeValid:true, unverified:false, limited:false, duplicate:false };
  const user = { id:'user-id', email:'unit@invalid.test', fullName:'Unit', passwordHash:'stored', emailVerifiedAt:new Date() };
  const down = () => { if (state.unavailable) { const error=new Error('private diagnostic'); if(state.errorCode) error.code=state.errorCode; throw error; } };
  const tx = { $queryRaw:async()=>{}, user:{ update:async()=>user, updateMany:async()=>({count:1}), deleteMany:async()=>({count:1}) }, authSession:{updateMany:async()=>({count:1})} };
  const prisma={ user:{ findUnique:async()=>{down();return state.missing?null:{...user,emailVerifiedAt:state.unverified?null:user.emailVerifiedAt}}, create:async()=>{down();if(state.duplicate){const e=Error();e.code='P2002';throw e}return {...user,emailVerifiedAt:null}}, updateMany:async()=>({count:1}) }, $transaction:async fn=>{down();return fn(tx)} };
  const services={ passwords:{validate:()=>{if(state.rejected)throw Error('invalid')},hash:async()=> 'hash',verify:async()=>({valid:!state.rejected,needsRehash:false})},
    tokens:{verify:async()=>{if(state.rejected)throw Error('invalid');return {sub:'user-id',sid:'session-id'}}},
    sessions:{markUsed:async()=>{down();return state.sessionActive},create:async()=>({accessToken:'opaque',refreshToken:'opaque'}),rotate:async()=>state.rejected?null:{accessToken:'opaque',refreshToken:'opaque'},logout:async()=>!state.rejected,logoutAll:async()=>{}},
    challenges:{issue:async()=>{down();return state.limited?null:{code:'000000'}},consume:async(_args,fn)=>{down();if(!state.challengeValid)return false;await fn(tx,new Date());return true}},
    email:{send:async()=>{if(state.providerDown)throw Error('offline')}} };
  const app=express(); app.use('/api/auth',(_q,r,n)=>{r.set('Cache-Control','no-store');n()},express.json({limit:'8kb'}));
  const auth=createBackendAuthRouter({prisma,services}); app.use('/api/auth',auth.router); app.get('/protected',auth.auth,(_q,r)=>r.sendStatus(204));
  return {app,state};
}
const input={email:'unit@invalid.test',password:'not-a-real-password',newPassword:'not-a-real-password',currentPassword:'not-a-real-password',otp:'000000',refreshToken:'opaque'};
const cases=[['post','register',202],['post','verify-email',200],['post','resend-verification',202],['post','login',200],['post','refresh',200],['post','logout',200],['post','logout-all',200],['post','forgot-password',202],['post','reset-password',200],['post','change-password',200],['get','me',200],['delete','account',200]];
for (const [method,path,status] of cases) {
  test(`${path} succeeds with fake dependencies`,async()=>{const {app}=fixture();const res=await request(app)[method](`/api/auth/${path}`).set('Authorization','Bearer opaque').send(input);assert.equal(res.status,status);assert.equal(res.headers['cache-control'],'no-store')});
  test(`${path} rejects invalid input or credentials`,async()=>{const {app,state}=fixture();state.rejected=true;state.challengeValid=false;const res=await request(app)[method](`/api/auth/${path}`).set('Authorization','Bearer opaque').send(input); if(['resend-verification','forgot-password'].includes(path))assert.equal(res.status,202);else assert.ok(res.status>=400)});
}
test('active session is required and database failures map to 503',async()=>{const {app,state}=fixture();let res=await request(app).get('/protected').set('Authorization','Bearer opaque');assert.equal(res.status,204);state.sessionActive=false;res=await request(app).get('/protected').set('Authorization','Bearer opaque');assert.equal(res.status,401);state.unavailable=true;res=await request(app).get('/protected').set('Authorization','Bearer opaque');assert.equal(res.status,503)});
test('database failure produces 503 without details',async()=>{const f=fixture();f.state.unavailable=true;const r=await request(f.app).post('/api/auth/login').send(input);assert.equal(r.status,503)});
test('dependency failures log only a safe Prisma code, including session checks',async()=>{const f=fixture();f.state.unavailable=true;f.state.errorCode='P2028';const lines=[];const original=console.error;console.error=(...args)=>lines.push(args.join(' '));try{assert.equal((await request(f.app).get('/protected').set('Authorization','Bearer opaque')).status,503);assert.equal((await request(f.app).post('/api/auth/login').send(input)).status,503);assert.equal(lines.length,2);assert.ok(lines.every(line=>JSON.parse(line).code==='P2028'))}finally{console.error=original}});
test('transaction timeouts return 503 with Retry-After for session checks and auth endpoints',async()=>{
  const f=fixture();f.state.unavailable=true;const old=console.error;console.error=()=>{};
  try {for(const code of ['P2028','P2024','P1001','P1008']){f.state.errorCode=code;for(const res of [await request(f.app).get('/protected').set('Authorization','Bearer opaque'),await request(f.app).post('/api/auth/login').send(input)]){assert.equal(res.status,503);assert.ok(Number(res.headers['retry-after'])>0);assert.ok(!JSON.stringify(res.body).includes(code))}}}
  finally {console.error=old}
});
for(const path of ['register','resend-verification','forgot-password']) test(`${path} acknowledgements do not disclose account or provider state`,async()=>{let baseline;for(const mode of ['unknown','unverified','verified','limited','provider']){const f=fixture();f.state.missing=mode==='unknown';f.state.unverified=mode==='unverified'||mode==='limited'||(mode==='provider'&&path!=='forgot-password');f.state.limited=mode==='limited';f.state.providerDown=mode==='provider';f.state.duplicate=path==='register'&&mode!=='unknown';const r=await request(f.app).post(`/api/auth/${path}`).send(input);const headers={...r.headers};delete headers.date;const value={status:r.status,body:r.body,headers};if(!baseline)baseline=value;else assert.deepEqual(value,baseline)}});
test('unverified status requires correct password',async()=>{const f=fixture();f.state.unverified=true;let r=await request(f.app).post('/api/auth/login').send(input);assert.equal(r.status,403);f.state.rejected=true;r=await request(f.app).post('/api/auth/login').send(input);assert.equal(r.status,401);f.state.missing=true;r=await request(f.app).post('/api/auth/login').send(input);assert.equal(r.status,401)});
test('unknown and known accounts receive generic acknowledgement',async()=>{const f=fixture();const known=await request(f.app).post('/api/auth/forgot-password').send(input);f.state.missing=true;const unknown=await request(f.app).post('/api/auth/forgot-password').send(input);assert.equal(known.status,unknown.status);assert.deepEqual(known.body,unknown.body)});
test('login per-IP limit returns no-store 429',async()=>{const {app}=fixture();for(let i=0;i<10;i++)await request(app).post('/api/auth/login').send(input);const r=await request(app).post('/api/auth/login').send(input);assert.equal(r.status,429);assert.equal(r.headers['cache-control'],'no-store')});
test('auth JSON is limited to 8 KB',async()=>{const {app}=fixture();const r=await request(app).post('/api/auth/login').send({data:'x'.repeat(9000)});assert.equal(r.status,413);assert.equal(r.headers['cache-control'],'no-store')});
