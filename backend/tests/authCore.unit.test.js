import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPasswordService } from '../src/auth/passwordService.js';
import { createTokenService } from '../src/auth/tokenService.js';
import { createSessionService } from '../src/auth/sessionService.js';
import { createChallengeService } from '../src/auth/challengeService.js';
import { createFakeEmail, createResendEmail } from '../src/auth/emailService.js';
import { readAuthConfig } from '../src/auth/authConfig.js';
import { createAuthServices } from '../src/auth/index.js';
import { assertSafeTestDatabase, DEV } from './devDbGuard.js';

// Serializable in-memory Prisma-shaped fake: no network, real email, or database.
function database() {
  let sessions = [], challenges = [], tail = Promise.resolve();
  const matches = (r, w) => Object.entries(w).every(([k,v]) => v && typeof v === 'object' && !(v instanceof Date)
    ? ('gte' in v ? r[k] >= v.gte : 'lte' in v ? r[k] && r[k] <= v.lte : false) : r[k] === v);
  const collection = list => ({
    async create({data}) { const row = { ...data, firstUsedAt:null,lastUsedAt:null,consumedAt:null,revokedAt:null,replacedById:null,replayCiphertext:null,replayExpiresAt:null,invalidatedAt:null,attemptCount:0,...data }; list.push(row); return row; },
    async findUnique({where}) { return list.find(r=>matches(r,where)) ?? null; },
    async findFirst({where}) { return list.find(r=>matches(r,where)) ?? null; },
    async findMany({where}) { return list.filter(r=>matches(r,where)).sort((a,b)=>b.createdAt-a.createdAt); },
    async update({where,data}) { const row=list.find(r=>matches(r,where)); if(!row) throw Error('missing row'); for(const [k,v] of Object.entries(data)) row[k]=v && typeof v==='object' && 'increment' in v ? row[k]+v.increment : v; return row; },
    async updateMany({where,data}) { const rows=list.filter(r=>matches(r,where)); for(const row of rows) Object.assign(row,data); return { count:rows.length }; }
  });
  const db={authSession:collection(sessions),authChallenge:collection(challenges), async $queryRaw(){},
    async $transaction(fn){const prev=tail;let done;tail=new Promise(r=>{done=r});await prev;try{return await fn(db)}finally{done()}}};
  return {db,sessions,challenges};
}
function fixture() {
  const data=database(); let now=new Date('2026-01-01T00:00:00Z'); const clock=()=>new Date(now);
  const tokens=createTokenService({secret:'x'.repeat(64),clock:()=>now.getTime()});
  const sessions=createSessionService({prisma:data.db,tokens,replayKey:'ab'.repeat(32),clock});
  const challenges=createChallengeService({prisma:data.db,secret:'c'.repeat(64),clock});
  return {...data,tokens,service:sessions,challengesService:challenges,advance(ms){now=new Date(now.getTime()+ms)}};
}

test('auth configuration defaults and rejects invalid policy',()=>{
  const c=readAuthConfig({}); assert.equal(c.bcryptCost,12); assert.equal(c.accessTtlSeconds,900); assert.equal(c.challengeTtlMs,600000);
  assert.throws(()=>readAuthConfig({AUTH_BCRYPT_COST:'0'}));
});
test('core composition requires distinct configured secrets',()=>{
  const {db}=database(); const env={API_JWT_SECRET:'a'.repeat(64),AUTH_CODE_HMAC_SECRET:'b'.repeat(64),AUTH_REFRESH_REPLAY_KEY:'ab'.repeat(32)};
  assert.ok(createAuthServices({prisma:db,env}).sessions);
  assert.throws(()=>createAuthServices({prisma:db,env:{...env,AUTH_CODE_HMAC_SECRET:env.API_JWT_SECRET}}));
});
test('database guard accepts only the explicitly designated branch',async()=>{
  const env={EXPECTED_NEON_BRANCH_ID:DEV.branch,DATABASE_URL:'postgresql:'+'//'+'x@'+DEV.endpoint+'-pooler.c-4.ap-southeast-1.aws.neon.tech/test'};
  const prisma={async $queryRawUnsafe(){return [{...DEV}]}};
  assert.equal((await assertSafeTestDatabase(prisma,env)).branch,DEV.branch);
  await assert.rejects(assertSafeTestDatabase(prisma,{...env,EXPECTED_NEON_BRANCH_ID:'unapproved-branch-one'}));
  await assert.rejects(assertSafeTestDatabase({async $queryRawUnsafe(){return [{...DEV,project:'wrong'}]}},env));
});

test('password length, timing dummy, bcrypt comparison and rehash', async()=>{
  const old=createPasswordService({cost:4,minLength:8}), next=createPasswordService({cost:5,minLength:8});
  assert.throws(()=>old.validate('a'.repeat(73))); assert.throws(()=>old.validate('é'.repeat(37)));
  const h=await old.hash('valid test password'); assert.equal((await old.verify('wrong password',h)).valid,false);
  assert.equal((await old.verify('valid test password',null)).valid,false);
  assert.equal((await next.rehashIfNeeded('valid test password',h)).needsRehash,true);
});
test('JWT verifies required claims and rejects wrong key and expiry', async()=>{
  const f=fixture(), issued=await f.tokens.issue({userId:'u',sessionId:'s'});
  assert.equal((await f.tokens.verify(issued.token)).sid,'s');
  await assert.rejects(createTokenService({secret:'z'.repeat(64)}).verify(issued.token));
  f.advance(901000); await assert.rejects(f.tokens.verify(issued.token));
});
test('parallel rotation and lost response replay return same child pair', async()=>{
  const f=fixture(), initial=await f.service.create({userId:'u'});
  const [a,b]=await Promise.all([f.service.rotate(initial.refreshToken),f.service.rotate(initial.refreshToken)]);
  assert.ok(a && b); assert.equal(a.refreshToken===b.refreshToken,true); assert.equal(a.accessToken===b.accessToken,true);
  const replay=await f.service.rotate(initial.refreshToken); assert.equal(replay.refreshToken===a.refreshToken,true);
  assert.equal(f.sessions.length,2); assert.ok(f.sessions[0].replayCiphertext);
});
test('expired grace and child use revoke family and clear encrypted replay', async()=>{
  for(const mode of ['expired','used','child-rotated']) {
    const f=fixture(), initial=await f.service.create({userId:'u'}), child=await f.service.rotate(initial.refreshToken);
    if(mode==='expired')f.advance(30001);
    if(mode==='used'){const claims=await f.tokens.verify(child.accessToken); assert.equal(await f.service.markUsed({userId:'u',sessionId:claims.sid}),true);}
    if(mode==='child-rotated')assert.ok(await f.service.rotate(child.refreshToken));
    assert.equal(await f.service.rotate(initial.refreshToken),null);
    assert.ok(f.sessions.every(s=>s.revokedAt && s.replayCiphertext===null && s.replayExpiresAt===null));
  }
});
test('session cleanup, absolute expiry, logout and logout-all', async()=>{
  const f=fixture(), first=await f.service.create({userId:'u'}), child=await f.service.rotate(first.refreshToken);
  f.advance(30000); await f.service.cleanup(); assert.equal(f.sessions[0].replayCiphertext,null);
  const claims=await f.tokens.verify(child.accessToken); assert.equal(await f.service.logout({userId:'u',sessionId:claims.sid}),true);
  assert.equal(await f.service.rotate(child.refreshToken),null);
  const second=await f.service.create({userId:'u'}); await f.service.logoutAll('u'); assert.equal(await f.service.rotate(second.refreshToken),null);
  const third=await f.service.create({userId:'u'}); f.advance(30*86400000); assert.equal(await f.service.rotate(third.refreshToken),null);
});
test('tampered encrypted replay fails closed and revokes family',async()=>{
  const f=fixture(), initial=await f.service.create({userId:'u'}); await f.service.rotate(initial.refreshToken);
  f.sessions[0].replayCiphertext[30]^=1;
  assert.equal(await f.service.rotate(initial.refreshToken),null);
  assert.ok(f.sessions.every(s=>s.revokedAt && s.replayCiphertext===null));
});
test('challenges limit attempts, consume once, expiry and resend caps', async()=>{
  const f=fixture(), c=await f.challengesService.issue({userId:'u',purpose:'verify_email'});
  assert.equal(/^\d{6}$/.test(c.code),true); assert.notEqual(f.challenges[0].codeHash,c.code);
  assert.equal(await f.challengesService.issue({userId:'u',purpose:'verify_email'}),null);
  for(let i=0;i<5;i++) assert.equal(await f.challengesService.consume({userId:'u',purpose:'verify_email',code:'bad'}),false);
  assert.equal(await f.challengesService.consume({userId:'u',purpose:'verify_email',code:c.code}),false);
  f.advance(60000); const d=await f.challengesService.issue({userId:'u',purpose:'verify_email'});
  assert.equal(await f.challengesService.consume({userId:'u',purpose:'verify_email',code:d.code}),true);
  assert.equal(await f.challengesService.consume({userId:'u',purpose:'verify_email',code:d.code}),false);
  for(let i=0;i<3;i++){f.advance(60000);assert.ok(await f.challengesService.issue({userId:'u',purpose:'verify_email'}));}
  f.advance(60000); assert.equal(await f.challengesService.issue({userId:'u',purpose:'verify_email'}),null);
  const x=await f.challengesService.issue({userId:'u',purpose:'reset_password'}); f.advance(600000);
  assert.equal(await f.challengesService.consume({userId:'u',purpose:'reset_password',code:x.code}),false);
});
test('email fake and Resend adapter escape HTML and send text without network', async()=>{
  const fake=createFakeEmail(); await fake.send({to:'synthetic',subject:'s',text:'body'}); assert.equal(fake.messages.length,1);
  let options; const client=createResendEmail({apiKey:'test',from:'test',fetchImpl:async(_url,o)=>{options=o;return {ok:true}}});
  assert.equal((await client.send({to:'synthetic',subject:'s',text:'<script>&'})).accepted,true);
  const body=JSON.parse(options.body); assert.equal(body.html.includes('&lt;script&gt;&amp;'),true); assert.equal(body.text,'<script>&');
  const failing=createResendEmail({apiKey:'test',from:'test',fetchImpl:async()=>{throw Error('sensitive provider details')}});
  await assert.rejects(failing.send({to:'synthetic',subject:'s',text:'body'}), {message:'Email provider request failed'});
});
