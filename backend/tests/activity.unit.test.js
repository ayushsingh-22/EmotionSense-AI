import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { mountActivity } from '../src/wellbeing/activity.js';
const uuid='00000000-0000-4000-8000-000000000001';
test('activity validates inputs and hides unavailable content',async()=>{const app=express(),router=express.Router();app.use(express.json());app.use((req,_res,next)=>{req.userId='synthetic';next()});mountActivity(router,{$queryRaw:async()=>[]},'test');app.use(router);assert.equal((await request(app).post('/activity-sessions').send({contentItemId:uuid,extra:true})).status,400);assert.equal((await request(app).post('/activity-sessions').send({contentItemId:uuid})).status,404);assert.equal((await request(app).post(`/activity-sessions/${uuid}/feedback`).send({helpfulness:'unknown'})).status,400);assert.equal((await request(app).patch(`/activity-sessions/${uuid}`).send({status:'started'})).status,400)});
