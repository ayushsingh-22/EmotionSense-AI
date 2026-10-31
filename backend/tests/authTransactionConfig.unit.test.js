import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readAuthConfig } from '../src/auth/authConfig.js';
import { createSessionService } from '../src/auth/sessionService.js';
import { createChallengeService } from '../src/auth/challengeService.js';

test('interactive transaction limits default to ten and fifteen seconds',()=>{
  assert.deepEqual(readAuthConfig({}).transactionOptions,{maxWait:10000,timeout:15000});
});

test('session and challenge transactions receive the configured limits',async()=>{
  const options={maxWait:8000,timeout:20000}, seen=[];
  const prisma={authSession:{findUnique:async()=>({id:'session',userId:'user',familyId:'family'})},$transaction:async(_fn,value)=>{seen.push(value);throw new Error('test stop')}};
  const sessions=createSessionService({prisma,tokens:{issue:async()=>({token:'opaque',expiresAt:new Date()})},replayKey:'0'.repeat(64),transactionOptions:options});
  const challenges=createChallengeService({prisma,secret:'x'.repeat(32),transactionOptions:options});
  for(const operation of [()=>sessions.create({userId:'user'}),()=>sessions.rotate('a'.repeat(43)),()=>sessions.markUsed({userId:'user',sessionId:'session'}),()=>sessions.logout({userId:'user',sessionId:'session'}),()=>sessions.logoutAll('user'),()=>challenges.issue({userId:'user',purpose:'verify_email'}),()=>challenges.consume({userId:'user',purpose:'verify_email',code:'000000'})]) await assert.rejects(operation(),/test stop/);
  assert.equal(seen.length,7);for(const value of seen) assert.deepEqual(value,options);
});
test('interactive transaction limits accept configured values and reject invalid ones',()=>{
  assert.deepEqual(readAuthConfig({AUTH_TRANSACTION_MAX_WAIT_MS:'8000',AUTH_TRANSACTION_TIMEOUT_MS:'20000'}).transactionOptions,{maxWait:8000,timeout:20000});
  assert.throws(()=>readAuthConfig({AUTH_TRANSACTION_MAX_WAIT_MS:'0'}));
  assert.throws(()=>readAuthConfig({AUTH_TRANSACTION_TIMEOUT_MS:'invalid'}));
});
