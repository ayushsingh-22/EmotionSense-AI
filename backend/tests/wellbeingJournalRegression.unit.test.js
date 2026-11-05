import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import journalRouter from '../src/routes/journalRoutes.js';
import generator from '../src/journal-service/journalGenerator.js';
import { mountEntries } from '../src/wellbeing/entries.js';
test('generated journal endpoint remains independent of user-written journal routes',async()=>{const original=generator.getJournalEntry;let calls=0;generator.getJournalEntry=async()=>{calls++;return {date:'2026-01-01',content:'generated fixture',emotion_summary:{}}};const app=express(),router=express.Router();mountEntries(router,{},'test-only-secret');app.use('/api/me',router);app.use('/api/journal',journalRouter);try{const r=await request(app).get('/api/journal/today').query({userId:'synthetic-user'});assert.equal(r.status,200);assert.equal(r.body.data.content,'generated fixture');assert.equal(calls,1)}finally{generator.getJournalEntry=original}});
