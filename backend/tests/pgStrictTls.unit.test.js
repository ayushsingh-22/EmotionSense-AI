import { test } from 'node:test';
import assert from 'node:assert/strict';
import ConnectionParameters from 'pg/lib/connection-parameters.js';
import { strictPgConfig } from '../src/lib/pgStrictTls.js';
import { CronScheduler } from '../src/journal-service/cronScheduler.js';

const HOST = 'ep-fake-direct-000.c-1.ap-southeast-1.aws.neon.tech';
const url = q => `postgresql://synthetic:synthetic@${HOST}/db${q}`;

test('strips URL TLS params so they cannot override the pinned verification', () => {
  for (const q of ['?sslmode=require', '?sslmode=disable', '?sslmode=no-verify', '?ssl=false&uselibpqcompat=true&sslmode=require', '?sslmode=prefer&channel_binding=require']) {
    const cfg = strictPgConfig(url(q), { connectionTimeoutMillis: 5 });
    assert.deepEqual(cfg.ssl, { rejectUnauthorized: true, servername: HOST });
    assert.doesNotMatch(cfg.connectionString, /ssl|uselibpqcompat/i);
    assert.equal(cfg.connectionTimeoutMillis, 5);
    // What pg will actually use after merging the parsed URL over the options:
    assert.deepEqual(new ConnectionParameters(cfg).ssl, { rejectUnauthorized: true, servername: HOST });
  }
  assert.match(strictPgConfig(url('?sslmode=require&channel_binding=require')).connectionString, /channel_binding=require/);
  assert.throws(() => strictPgConfig('not a url'), /Invalid database URL/);
  assert.throws(() => strictPgConfig('https://example.invalid/db'), /Invalid database URL/);
});

test('nightly advisory-lock client is created with strict TLS', async () => {
  const saved = { d: process.env.DIRECT_URL, p: process.env.DATABASE_URL };
  process.env.DIRECT_URL = url('?sslmode=require');
  process.env.DATABASE_URL = `postgresql://synthetic:synthetic@${HOST.replace('-000.', '-000-pooler.')}/db?sslmode=require`;
  let options;
  try {
    await assert.rejects(new CronScheduler().runNightly({ clientFactory: o => { options = o; return { on() {}, connect: async () => { throw new Error('stop'); }, end: async () => {} }; } }));
    assert.deepEqual(options.ssl, { rejectUnauthorized: true, servername: HOST });
    assert.doesNotMatch(options.connectionString, /sslmode/);
  } finally {
    if (saved.d === undefined) delete process.env.DIRECT_URL; else process.env.DIRECT_URL = saved.d;
    if (saved.p === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = saved.p;
  }
});
