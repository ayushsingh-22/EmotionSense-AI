import { test } from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { assertSafeTestDatabase } from './devDbGuard.js';
import { CronScheduler } from '../src/journal-service/cronScheduler.js';
dotenv.config({path:'.env'});
test('separate direct Postgres sessions prevent overlapping nightly runs', {skip:process.env.RUN_AUTH_DB_TESTS !== '1'}, async () => {
  const prisma=new PrismaClient();let release;
  try {
    await assertSafeTestDatabase(prisma);
    const barrier=new Promise(resolve=>{release=resolve});let entered;
    const started=new Promise(resolve=>{entered=resolve});let runs=0;
    const first=new CronScheduler(),second=new CronScheduler();
    first.generateNightlyJournals=async()=>{runs++;entered();await barrier;return {success:0}};
    second.generateNightlyJournals=async()=>{runs++;return {success:0}};
    const pending=first.runNightly();
    try {await started;assert.deepEqual(await second.runNightly(),{started:false});}
    finally {release();await pending;}
    assert.equal(runs,1);
  } finally {release?.();await prisma.$disconnect();}
});
