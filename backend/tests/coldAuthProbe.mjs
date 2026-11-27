// Guarded, opt-in cold-start probe. Never logs credentials or user data.
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import request from 'supertest';
import { assertSafeTestDatabase } from './devDbGuard.js';
import { deleteSynthetic, syntheticCounts } from './syntheticCleanup.js';
import { createAuthServices } from '../src/auth/index.js';
import { createFakeEmail } from '../src/auth/emailService.js';
import { createBackendAuthRouter } from '../src/routes/backendAuthRoutes.js';

dotenv.config({path:'.env'});
if(process.env.RUN_COLD_AUTH_PROBE!=='1') throw new Error('Explicit probe opt-in required');
const prisma=new PrismaClient();
let id, approved=false;
try {
  await assertSafeTestDatabase(prisma);
  await deleteSynthetic(prisma,['spike-cold-']); // only this probe's own leftovers; real accounts are never touched
  approved=true;
  const user=await prisma.user.create({data:{email:`spike-cold-${randomUUID()}@example.invalid`,passwordHash:'!',emailVerifiedAt:new Date()}});
  id=user.id;
  const services=createAuthServices({prisma});services.email=createFakeEmail();
  const pair=await services.sessions.create({userId:id});
  const app=express();app.use(express.json());app.use('/api/auth',createBackendAuthRouter({prisma,services}).router);
  await prisma.$disconnect();
  console.log('COLD_PROBE_READY');
  const action=await new Promise(resolve=>process.stdin.once('data',chunk=>resolve(String(chunk).trim())));
  process.stdin.pause();
  if(action==='go') {
    const refresh=await request(app).post('/api/auth/refresh').send({refreshToken:pair.refreshToken});
    console.log(`COLD_REFRESH_STATUS ${refresh.status}`);
    const access=refresh.status===200?refresh.body.accessToken:pair.accessToken;
    const logout=await request(app).post('/api/auth/logout').set('Authorization',`Bearer ${access}`).send({});
    console.log(`COLD_LOGOUT_STATUS ${logout.status}`);
    if(refresh.status!==200 || logout.status!==200) process.exitCode=1;
  } else console.log('COLD_PROBE_CANCELLED');
} catch(error) {
  const code=typeof error?.code==='string'&&/^P\d{4}$/.test(error.code)?error.code:'unclassified';
  console.error(`COLD_PROBE_FAILURE ${code}`);process.exitCode=1;
} finally {
  try {
    if(approved&&id) await prisma.user.deleteMany({where:{id,email:{startsWith:'spike-cold-',endsWith:'@example.invalid'}}});
    if(approved){await deleteSynthetic(prisma,['spike-cold-']);const {users,sessions,challenges}=await syntheticCounts(prisma,['spike-cold-']);console.log(`COLD_FINAL_COUNTS synthetic_users=${users} synthetic_sessions=${sessions} synthetic_challenges=${challenges}`);if(users||sessions||challenges)process.exitCode=1;}
  } catch {console.error('COLD_CLEANUP_FAILED');process.exitCode=1}
  await prisma.$disconnect();
}
