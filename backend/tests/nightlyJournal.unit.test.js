import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { EventEmitter } from 'node:events';
import { createInternalRouter } from '../src/routes/internalRoutes.js';
import { CronScheduler } from '../src/journal-service/cronScheduler.js';
import { JournalGenerator } from '../src/journal-service/journalGenerator.js';

test('secret is required and accepted trigger responds before background work', async () => {
  const old=process.env.CRON_SECRET; process.env.CRON_SECRET='synthetic-secret-for-test-only'; let called=0;
  const app=express(); app.use('/api/internal',createInternalRouter({runNightly:async()=>{called++}}));
  try {
    assert.equal((await request(app).post('/api/internal/journal/run')).status,401);
    assert.equal((await request(app).post('/api/internal/journal/run').set('Authorization','Bearer wrong')).status,401);
    assert.equal((await request(app).post('/api/internal/journal/run').set('Authorization',`Bearer ${process.env.CRON_SECRET}`)).status,202);
    await new Promise(resolve=>setImmediate(resolve)); assert.equal(called,1);
  } finally { if(old===undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET=old; }
});
test('separate schedulers cannot overlap when advisory lock is held', async () => {
  const old=process.env.DIRECT_URL, oldPooled=process.env.DATABASE_URL;process.env.DIRECT_URL='postgresql://localhost/test';process.env.DATABASE_URL='postgresql://localhost/test';let held=false;let release;
  const blocker=new Promise(resolve=>{release=resolve});let count=0;
  const factory=()=>{const c=new EventEmitter();c.connect=async()=>{};c.end=async()=>{};c.query=async sql=>{if(sql.includes('try_advisory')) {if(held)return {rows:[{locked:false}]};held=true;return {rows:[{locked:true}]}}held=false;return {rows:[]}};return c};
  try {const a=new CronScheduler(), b=new CronScheduler();a.generateNightlyJournals=async()=>{count++;await blocker};b.generateNightlyJournals=async()=>{count++};const first=a.runNightly({clientFactory:factory});await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(await b.runNightly({clientFactory:factory}),{started:false});release();await first;assert.equal(count,1)}
  finally {release();if(old===undefined)delete process.env.DIRECT_URL;else process.env.DIRECT_URL=old;if(oldPooled===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=oldPooled}
});
test('nightly skips existing generated journal on repeat and new generator instance', async () => {
  let saved=null, generations=0;
  const db={message:{findMany:async()=>[{id:'m',role:'user',content:'synthetic',createdAt:new Date()}]}};
  const storage={getDailyEmotionSummary:async()=>saved,upsertDailyEmotionSummary:async(payload,opts)=>{assert.equal(opts.preserveExistingJournal,true);saved={eJournalEntry:payload.eJournalEntry};return saved}};
  const make=()=>{const g=new JournalGenerator({db,storage});g.getDateRangeIST=()=>({startTime:new Date(),endTime:new Date()});g.aggregateEmotions=()=>({emotionCounts:{},primaryEmotion:'neutral',totalMessages:1});g.generateJournalContent=async()=>{generations++;return 'synthetic'};g.parseJournalSections=()=>({});g._toJournalShape=()=>({});return g};
  assert.equal((await make().generateDailyJournal('u','2026-01-01')).skipped,false);
  assert.equal((await make().generateDailyJournal('u','2026-01-01')).skipped,true);
  assert.equal(generations,1);
});

test('nightly refuses mismatched direct and application database targets', async () => {
  const oldDirect=process.env.DIRECT_URL, oldDatabase=process.env.DATABASE_URL;
  try {
    process.env.DIRECT_URL='postgresql://localhost/one'; process.env.DATABASE_URL='postgresql://localhost/two';
    let opened=false; const scheduler=new CronScheduler();
    await assert.rejects(scheduler.runNightly({clientFactory:()=>{opened=true;throw new Error('unexpected')}}));
    assert.equal(opened,false);
  } finally {
    if(oldDirect===undefined) delete process.env.DIRECT_URL; else process.env.DIRECT_URL=oldDirect;
    if(oldDatabase===undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL=oldDatabase;
  }
});

test('a lost lock aborts the nightly write', async () => {
  let writes=0;
  const db={message:{findMany:async()=>[{id:'m',role:'user',content:'synthetic',createdAt:new Date()}]}};
  const storage={getDailyEmotionSummary:async()=>null,upsertDailyEmotionSummary:async()=>{writes++}};
  const g=new JournalGenerator({db,storage});g.getDateRangeIST=()=>({startTime:new Date(),endTime:new Date()});g.aggregateEmotions=()=>({emotionCounts:{},primaryEmotion:'neutral',totalMessages:1});g.generateJournalContent=async()=> 'synthetic';g.parseJournalSections=()=>({});
  await assert.rejects(g.generateDailyJournal('u','2026-01-01',{ensureLock:()=>{throw new Error('lock lost')}}));
  assert.equal(writes,0);
});
