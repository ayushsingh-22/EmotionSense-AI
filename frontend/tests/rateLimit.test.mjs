import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryRateLimitStore, consume, resetKey, setRateLimitStore, clientIp, hashPart, authLimits } from '../lib/rateLimit.ts';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe('rate limiter (memory store)', () => {
  test('allows up to the limit, then blocks with a retry-after', async () => {
    setRateLimitStore(new MemoryRateLimitStore());
    const key = `t1:${Math.random()}`;
    for (let i = 1; i <= 3; i++) assert.equal((await consume(key, { limit: 3, windowMs: 60_000 })).allowed, true);
    const blocked = await consume(key, { limit: 3, windowMs: 60_000 });
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.remaining, 0);
    assert.ok(blocked.retryAfterSec >= 1);
  });
  test('keys are independent', async () => {
    setRateLimitStore(new MemoryRateLimitStore());
    await consume('a', { limit: 1, windowMs: 60_000 });
    assert.equal((await consume('a', { limit: 1, windowMs: 60_000 })).allowed, false);
    assert.equal((await consume('b', { limit: 1, windowMs: 60_000 })).allowed, true);
  });
  test('the window expires', async () => {
    setRateLimitStore(new MemoryRateLimitStore());
    assert.equal((await consume('w', { limit: 1, windowMs: 40 })).allowed, true);
    assert.equal((await consume('w', { limit: 1, windowMs: 40 })).allowed, false);
    await sleep(60);
    assert.equal((await consume('w', { limit: 1, windowMs: 40 })).allowed, true);
  });
  test('resetKey clears a counter (successful login)', async () => {
    setRateLimitStore(new MemoryRateLimitStore());
    await consume('r', { limit: 1, windowMs: 60_000 });
    await resetKey('r');
    assert.equal((await consume('r', { limit: 1, windowMs: 60_000 })).allowed, true);
  });
  test('a shared store can be plugged in without touching callers', async () => {
    const calls = [];
    setRateLimitStore({
      hit: async (key, windowMs) => { calls.push(['hit', key, windowMs]); return { count: 99, resetAt: Date.now() + 5000 }; },
      reset: async (key) => { calls.push(['reset', key]); }
    });
    assert.equal((await consume('shared', { limit: 5, windowMs: 1000 })).allowed, false);
    await resetKey('shared');
    assert.deepEqual(calls.map((c) => c[0]), ['hit', 'reset']);
    setRateLimitStore(new MemoryRateLimitStore());
  });
  test('memory stays bounded under a flood of unique keys', async () => {
    setRateLimitStore(new MemoryRateLimitStore());
    for (let i = 0; i < 25_000; i++) await consume(`flood:${i}`, { limit: 1, windowMs: 60_000 });
    assert.equal((await consume('still-works', { limit: 1, windowMs: 60_000 })).allowed, true);
  });
});

describe('identifiers', () => {
  test('hashPart is stable, non-reversible-looking and never contains the raw value', () => {
    const h = hashPart('victim@example.com');
    assert.equal(h, hashPart('victim@example.com'));
    assert.notEqual(h, hashPart('other@example.com'));
    assert.match(h, /^[0-9a-f]{32}$/);
    assert.ok(!h.includes('victim'));
  });
  test('clientIp prefers platform-set headers over x-forwarded-for, supports Headers and plain objects', () => {
    assert.equal(clientIp(new Headers({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2', 'x-vercel-forwarded-for': '9.9.9.9' })), '9.9.9.9');
    assert.equal(clientIp(new Headers({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' })), '1.1.1.1');
    assert.equal(clientIp({ 'x-real-ip': '3.3.3.3', 'x-forwarded-for': '1.1.1.1' }), '3.3.3.3');
    assert.equal(clientIp({}), 'unknown');
    assert.equal(clientIp(undefined), 'unknown');
  });
  test('default limits are strict for registration and moderate for login; env overrides work', () => {
    const l = authLimits();
    assert.ok(l.registerPerIp.limit <= 10 && l.registerPerEmail.limit <= 5);
    assert.ok(l.loginPerAccount.limit <= 10);
    process.env.AUTH_RL_LOGIN_ACCOUNT_PER_15MIN = '3';
    assert.equal(authLimits().loginPerAccount.limit, 3);
    delete process.env.AUTH_RL_LOGIN_ACCOUNT_PER_15MIN;
  });
});
