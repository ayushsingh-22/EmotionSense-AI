import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGmailEmail, buildGmailMime } from '../src/auth/gmailEmail.js';
import { createEmailAdapter } from '../src/auth/emailService.js';
import { createInternalRouter } from '../src/routes/internalRoutes.js';
import express from 'express';
import request from 'supertest';

const sender=['sender','example.invalid'].join('@'), recipient=['recipient','example.invalid'].join('@');
const config={clientId:'client',clientSecret:'synthetic-secret',refreshToken:'synthetic-refresh',sender,fromName:'MindHaven',sleep:async()=>{}};
const message={to:recipient,subject:'Verification ✓',text:'<example>&'};
const tokenResponse={ok:true,status:200,json:async()=>({access_token:'synthetic-access',expires_in:3600})};
test('Gmail refreshes with documented scope and sends a MIME message over HTTPS',async()=>{
  const calls=[];const email=createGmailEmail({...config,fetchImpl:async(url,options)=>{calls.push({url,options});return calls.length===1?tokenResponse:{ok:true,status:200}}});
  assert.deepEqual(await email.send(message),{accepted:true});assert.equal(calls.length,2);
  assert.equal(calls[0].url,'https://oauth2.googleapis.com/token');assert.equal(calls[0].options.body.get('grant_type'),'refresh_token');
  assert.equal(calls[1].url,'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
  const raw=JSON.parse(calls[1].options.body).raw;const mime=Buffer.from(raw,'base64url').toString('utf8');
  assert.ok(mime.includes('multipart/alternative'));assert.ok(mime.includes('text/plain; charset=UTF-8'));assert.ok(mime.includes('text/html; charset=UTF-8'));assert.ok(mime.includes('Subject: =?UTF-8?B?'));
  assert.ok(mime.includes(Buffer.from('<p>&lt;example&gt;&amp;</p>').toString('base64')));
});
test('transient errors retry with bounded backoff',async()=>{
  let calls=0;const pauses=[];const email=createGmailEmail({...config,sleep:async ms=>pauses.push(ms),fetchImpl:async()=>{calls++;return calls===1?tokenResponse:calls===2?{ok:false,status:503}:{ok:true,status:200}}});
  assert.equal((await email.send(message)).accepted,true);assert.equal(calls,3);assert.deepEqual(pauses,[250]);
});
test('timeout is bounded and exhausted without exposing provider details',async()=>{
  let calls=0;const email=createGmailEmail({...config,timeoutMs:5,attempts:2,fetchImpl:async()=>{calls++;return new Promise(()=>{})}});
  await assert.rejects(email.send(message),{message:'Email provider request failed'});assert.equal(calls,2);
});
test('invalid grant logs only the operator event and does not retry',async()=>{
  let calls=0;const lines=[];const original=console.error;console.error=line=>lines.push(line);
  try {const email=createGmailEmail({...config,fetchImpl:async()=>{calls++;return {ok:false,status:400,json:async()=>({error:'invalid_grant',error_description:'private'})}}});await assert.rejects(email.send(message));assert.equal(calls,1);const log=JSON.parse(lines[0]);assert.equal(log.event,'gmail refresh token invalid');assert.ok(!lines[0].includes('private'));}finally{console.error=original}
});
test('MIME refuses header injection in names, subject and addresses',()=>{
  for(const fields of [{fromName:'x\r\nBcc: x'},{subject:'x\nBcc: x'},{to:'x\r\nBcc: x'},{sender:'x\nBcc: x'}]) assert.throws(()=>buildGmailMime({sender,fromName:'MindHaven',...message,...fields}));
});
test('production defaults to Gmail; Resend stays selectable',()=>{
  assert.equal(createEmailAdapter({env:{NODE_ENV:'production'}}).handlesRetries,true);
  assert.equal(createEmailAdapter({env:{NODE_ENV:'production',EMAIL_PROVIDER:'resend',RESEND_API_KEY:'x',RESEND_FROM:'x'}}).configured(),true);
});
test('protected client IP endpoint reports only requested fields',async()=>{
  const previous=process.env.CRON_SECRET;process.env.CRON_SECRET='synthetic-cron-secret';const app=express();app.set('trust proxy',1);app.use('/api/internal',createInternalRouter({runNightly:async()=>{}}));
  try {assert.equal((await request(app).get('/api/internal/client-ip')).status,401);assert.equal((await request(app).get('/api/internal/client-ip').set('Authorization','Bearer wrong')).status,401);
    const result=await request(app).get('/api/internal/client-ip').set('Authorization',`Bearer ${process.env.CRON_SECRET}`).set('X-Forwarded-For','203.0.113.1, 198.51.100.2');
    assert.equal(result.status,200);assert.deepEqual(Object.keys(result.body).sort(),['forwardedForEntries','ip','trustProxyHops']);assert.equal(result.body.forwardedForEntries,2);assert.equal(result.body.trustProxyHops,1);assert.equal(result.body.ip,'198.51.100.2');
  } finally {if(previous===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=previous}
});

test('send request timeout is bounded and retried',async()=>{
  let count=0;const email=createGmailEmail({...config,timeoutMs:5,attempts:2,fetchImpl:async()=>{count++;return count===1?tokenResponse:new Promise(()=>{})}});
  await assert.rejects(email.send(message),{message:'Email provider request failed'});assert.equal(count,3);
});
