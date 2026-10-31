import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { normalizeNodeEnv, isProduction } from '../src/config/environment.js';
import { parseAllowedOrigins, securityHeaders } from '../src/middleware/security.js';
import healthRoutes from '../src/routes/healthRoutes.js';

test('environment comparisons trim and normalize case',()=>{
  assert.equal(normalizeNodeEnv(' ProDuctIon '),'production');assert.equal(isProduction(' PRODUCTION '),true);assert.equal(isProduction('development'),false);
  assert.deepEqual(parseAllowedOrigins('', ' PrOdUcTiOn '),[]);
});
test('production security headers use normalized environment',async()=>{
  const before=process.env.NODE_ENV;process.env.NODE_ENV=' PrOdUcTiOn ';
  try {const app=express();app.use(securityHeaders());app.get('/',(_q,r)=>r.sendStatus(204));const result=await request(app).get('/');assert.ok(result.headers['strict-transport-security']);}
  finally {if(before===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=before}
});
test('health returns only a short commit SHA or unknown',async()=>{
  const before=process.env.RENDER_GIT_COMMIT;const app=express();app.use('/api/health',healthRoutes);
  try {process.env.RENDER_GIT_COMMIT='abcdef0123456789';let result=await request(app).get('/api/health');assert.equal(result.body.commit,'abcdef0');assert.deepEqual(Object.keys(result.body).sort(),['commit','environment','release','status','success','timestamp','uptime'].sort());
    delete process.env.RENDER_GIT_COMMIT;result=await request(app).get('/api/health');assert.equal(result.body.commit,'unknown');process.env.RENDER_GIT_COMMIT='not-a-sha';result=await request(app).get('/api/health');assert.equal(result.body.commit,'unknown');}
  finally {if(before===undefined)delete process.env.RENDER_GIT_COMMIT;else process.env.RENDER_GIT_COMMIT=before}
});
