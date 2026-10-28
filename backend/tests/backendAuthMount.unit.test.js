import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

process.env.NODE_ENV='test';
process.env.GROQ_API_KEY='unit-placeholder';
const { buildApp } = await import('../src/server.js');
let active=false;
const services={passwords:{},tokens:{verify:async()=>({sub:'unit-user',sid:'unit-session'})},sessions:{markUsed:async()=>active,rotate:async()=>({accessToken:'opaque',refreshToken:'opaque'})},challenges:{},email:{}};
const app=buildApp(services);
test('server mounts backend auth and enforces its JSON size limit',async()=>{
  const response=await request(app).post('/api/auth/refresh').send({refreshToken:'opaque'});
  assert.equal(response.status,200);assert.equal(response.headers['cache-control'],'no-store');
  const oversized=await request(app).post('/api/auth/refresh').send({payload:'x'.repeat(9000)});
  assert.equal(oversized.status,413);assert.equal(oversized.headers['cache-control'],'no-store');
});
test('server protected route checks session and reports database outage',async()=>{
  let response=await request(app).get('/api/identity/me').set('Authorization','Bearer opaque');
  assert.equal(response.status,401);
  services.sessions.markUsed=async()=>{throw Error('offline')};
  response=await request(app).get('/api/identity/me').set('Authorization','Bearer opaque');
  assert.equal(response.status,503);
});
