import { test, afterEach, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import dotenv from 'dotenv';
import express from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { assertSafeTestDatabase } from './devDbGuard.js';
import { createAuthServices } from '../src/auth/index.js';
import { createFakeEmail } from '../src/auth/emailService.js';
import { createBackendAuthRouter } from '../src/routes/backendAuthRoutes.js';

dotenv.config({path:'.env'});
if(process.env.RUN_AUTH_DB_TESTS!=='1') {
  test('real database auth tests require explicit opt-in', {skip:true}, () => {});
} else {
const prisma=new PrismaClient();
const services=createAuthServices({prisma}); services.email=createFakeEmail();
const app=express();app.set('trust proxy',1);app.use(express.json({limit:'8kb'}));app.use('/api/auth',createBackendAuthRouter({prisma,services}).router);
const prefix='spike-test-', suffix='@example.invalid';
const password='Synthetic-password-for-test-2026!';
let currentEmail;
let guardPassed=false;
let ipCounter=1;
const call=(method,path,body={},access) => {
  const n=ipCounter++;let req=request(app)[method](`/api/auth/${path}`).set('X-Forwarded-For',`10.${Math.floor(n/65536)%256}.${Math.floor(n/256)%256}.${n%256}`);
  if(access)req=req.set('Authorization',`Bearer ${access}`);
  return req.send(body);
};
const clean=async()=>{if(!guardPassed)return;await prisma.user.deleteMany({where:{email:{startsWith:prefix,endsWith:suffix}}});services.email.messages.length=0;};
before(async()=>{await assertSafeTestDatabase(prisma);const count=await prisma.user.count();assert.equal(count,0,'Test target must have no users');guardPassed=true});
afterEach(clean);
after(async()=>{try{await clean();const [users,sessions,challenges]=await Promise.all([prisma.user.count(),prisma.authSession.count(),prisma.authChallenge.count()]);console.log(`FINAL_COUNTS users=${users} sessions=${sessions} challenges=${challenges}`);assert.equal(users+sessions+challenges,0)}finally{await prisma.$disconnect()}});
const ensure=(r,status)=>assert.equal(r.status,status,`Unexpected HTTP status in integration test`);
async function code(){for(let i=0;i<100;i++){if(services.email.messages.length){const m=services.email.messages.pop();return /\b\d{6}\b/.exec(m.text)?.[0]}await new Promise(r=>setTimeout(r,25))}throw Error('Fake email not delivered')}
async function register(){currentEmail=`${prefix}${randomUUID()}${suffix}`;ensure(await call('post','register',{email:currentEmail,password}),202);const otp=await code();ensure(await call('post','verify-email',{email:currentEmail,otp}),200);return currentEmail}
async function login(){const r=await call('post','login',{email:currentEmail,password});ensure(r,200);return r.body}
async function ready(){await register();return login()}
async function family(access){const {sid}=await services.tokens.verify(access);return (await prisma.authSession.findUnique({where:{id:sid}})).familyId}
async function activeCount(familyId){return prisma.authSession.count({where:{familyId,revokedAt:null,expiresAt:{gt:new Date()},consumedAt:null}})}
test('full flow and logout',async()=>{const pair=await ready();ensure(await call('get','me',{},pair.accessToken),200);const refreshed=await call('post','refresh',{refreshToken:pair.refreshToken});ensure(refreshed,200);ensure(await call('post','logout',{},refreshed.body.accessToken),200);ensure(await call('get','me',{},refreshed.body.accessToken),401)});
test('password reset revokes sessions',async()=>{const pair=await ready();ensure(await call('post','forgot-password',{email:currentEmail}),202);const otp=await code();ensure(await call('post','reset-password',{email:currentEmail,password,otp}),200);ensure(await call('get','me',{},pair.accessToken),401)});
test('password change revokes sessions',async()=>{const pair=await ready();ensure(await call('post','change-password',{currentPassword:password,newPassword:password},pair.accessToken),200);ensure(await call('get','me',{},pair.accessToken),401)});
test('account deletion cascades',async()=>{const pair=await ready();ensure(await call('delete','account',{password},pair.accessToken),200);assert.equal(await prisma.authSession.count(),0);assert.equal(await prisma.authChallenge.count(),0)});
test('a five concurrent refreshes and b lost response retry',async()=>{const pair=await ready(), id=await family(pair.accessToken),start=performance.now();const r=await Promise.all(Array.from({length:5},()=>call('post','refresh',{refreshToken:pair.refreshToken})));for(const x of r)ensure(x,200);assert.ok(r.every(x=>JSON.stringify(x.body)===JSON.stringify(r[0].body)));assert.equal(await prisma.authSession.count({where:{familyId:id}}),2);const retry=await call('post','refresh',{refreshToken:pair.refreshToken});ensure(retry,200);assert.ok(JSON.stringify(retry.body)===JSON.stringify(r[0].body));console.log(`CONCURRENCY a_b_ms=${Math.round(performance.now()-start)}`)});
test('c reuse after grace revokes family',async()=>{const pair=await ready(), id=await family(pair.accessToken),start=performance.now();ensure(await call('post','refresh',{refreshToken:pair.refreshToken}),200);await new Promise(r=>setTimeout(r,30500));ensure(await call('post','refresh',{refreshToken:pair.refreshToken}),401);assert.equal(await activeCount(id),0);console.log(`CONCURRENCY c_ms=${Math.round(performance.now()-start)}`)});
test('d reuse after child use revokes family',async()=>{const pair=await ready(),id=await family(pair.accessToken),start=performance.now();const r=await call('post','refresh',{refreshToken:pair.refreshToken});ensure(r,200);ensure(await call('get','me',{},r.body.accessToken),200);ensure(await call('post','refresh',{refreshToken:pair.refreshToken}),401);assert.equal(await activeCount(id),0);console.log(`CONCURRENCY d_ms=${Math.round(performance.now()-start)}`)});
test('e concurrent logout and refresh leaves no active session',async()=>{const pair=await ready(),id=await family(pair.accessToken),start=performance.now();const [out,refresh]=await Promise.all([call('post','logout',{},pair.accessToken),call('post','refresh',{refreshToken:pair.refreshToken})]);ensure(out,200);assert.ok([200,401].includes(refresh.status));assert.equal(await activeCount(id),0);console.log(`CONCURRENCY e_ms=${Math.round(performance.now()-start)}`)});
test('enumeration response timing',async()=>{await ready();const other=`${prefix}${randomUUID()}${suffix}`;const stats={};for(const [name,path,email,pw] of [['login_known','login',currentEmail,'wrong'],['login_unknown','login',other,'wrong'],['forgot_known','forgot-password',currentEmail,''],['forgot_unknown','forgot-password',other,'']]){const times=[];for(let i=0;i<20;i++){const start=performance.now();const r=await call('post',path,{email,password:pw});ensure(r,path==='login'?401:202);times.push(performance.now()-start)}times.sort((a,b)=>a-b);stats[name]={median:Math.round((times[9]+times[10])/2),min:Math.round(times[0]),max:Math.round(times[19])}}console.log(`TIMINGS_MS ${JSON.stringify(stats)}`)});
}
