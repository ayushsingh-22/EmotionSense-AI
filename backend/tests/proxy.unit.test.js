import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { resolveTrustProxyHops } from '../src/config/proxy.js';
test('one trusted hop selects the rightmost forwarded address, not a spoofed leftmost value', async () => {
  const app=express(); app.set('trust proxy',resolveTrustProxyHops({})); app.get('/',(req,res)=>res.json({ip:req.ip}));
  const result=await request(app).get('/').set('X-Forwarded-For','203.0.113.1, 198.51.100.2');
  assert.equal(result.body.ip,'198.51.100.2');
});
test('proxy hop configuration rejects ambiguous values', () => {
  for(const value of ['-1','1x','true','11']) assert.throws(()=>resolveTrustProxyHops({TRUST_PROXY_HOPS:value}));
  assert.equal(resolveTrustProxyHops({TRUST_PROXY_HOPS:'0'}),0);
});
