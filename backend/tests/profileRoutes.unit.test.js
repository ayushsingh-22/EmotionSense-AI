import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createProfileRouter } from '../src/routes/profileRoutes.js';

const fields = { id: 'a', email: 'a@example.invalid', fullName: 'A', avatarUrl: null, createdAt: new Date(), updatedAt: new Date() };
function fixture() {
  const calls = [];
  const db = { user: { findUnique: async opts => { calls.push(opts); return fields; }, update: async opts => { calls.push(opts); return fields; } }, message: { findMany: async opts => { calls.push(opts); return []; } } };
  const app = express(); app.use(express.json()); app.use((req, res, next) => { req.userId = 'a'; next(); }); app.use(createProfileRouter(db));
  return { app, calls };
}
test('profile selects only public fields and scopes reads to the authenticated subject', async () => {
  const { app, calls } = fixture(); const res = await request(app).get('/profile');
  assert.equal(res.status, 200); assert.equal(calls[0].where.id, 'a'); assert.equal(calls[0].select.passwordHash, undefined); assert.deepEqual(Object.keys(res.body).sort(), ['avatar_url','created_at','email','full_name','id','updated_at']);
});
test('profile updates only allowed fields for the authenticated subject', async () => {
  const { app, calls } = fixture(); const res = await request(app).patch('/profile').send({full_name:'Updated',id:'b',passwordHash:'x'});
  assert.equal(res.status, 200); assert.equal(calls[0].where.id, 'a'); assert.deepEqual(calls[0].data, {fullName:'Updated'});
});
test('history selects limited fields and binds the authenticated subject', async () => {
  const { app, calls } = fixture(); const res = await request(app).get('/messages/emotion-history?range=7days&emotion=sadness');
  assert.equal(res.status, 200); assert.equal(calls[0].where.userId, 'a'); assert.equal(calls[0].where.emotion, 'sadness'); assert.ok(calls[0].where.createdAt.gte instanceof Date); assert.equal(calls[0].select.content, undefined);
});
