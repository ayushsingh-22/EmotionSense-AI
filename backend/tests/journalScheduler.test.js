/**
 * Nightly journal scheduler gate. Uses a fake cron library: no job is ever executed, no database or LLM is touched.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
const { CronScheduler, shouldRegisterNightlyJob } = await import('../src/journal-service/cronScheduler.js');

const fakeCron = () => {
  const calls = [];
  return {
    calls,
    schedule(expression, callback, options) {
      calls.push({ expression, callback, options });
      return { stop() { this.stopped = true; } };
    }
  };
};

/** A scheduler whose job body must never run in these tests. */
const scheduler = () => {
  const s = new CronScheduler();
  s.generateNightlyJournals = async () => { throw new Error('the journal job must not execute in tests'); };
  return s;
};

describe('shouldRegisterNightlyJob', () => {
  test('local development and test runs do not register the job by default', () => {
    assert.equal(shouldRegisterNightlyJob({ NODE_ENV: 'development' }), false);
    assert.equal(shouldRegisterNightlyJob({ NODE_ENV: 'test' }), false);
    assert.equal(shouldRegisterNightlyJob({ NODE_ENV: ' Development ' }), false);
  });
  test('explicit enablement in development works, and only with exactly "true"', () => {
    assert.equal(shouldRegisterNightlyJob({ NODE_ENV: 'development', JOURNAL_SCHEDULER_ENABLED: 'true' }), true);
    for (const v of ['1', 'yes', 'TRUE', 'on', '', undefined]) {
      assert.equal(shouldRegisterNightlyJob({ NODE_ENV: 'development', JOURNAL_SCHEDULER_ENABLED: v }), false, String(v));
    }
  });
  test('production behaviour is unchanged: always registered (the new flag cannot switch it off)', () => {
    assert.equal(shouldRegisterNightlyJob({ NODE_ENV: 'production' }), true);
    assert.equal(shouldRegisterNightlyJob({ NODE_ENV: 'production', JOURNAL_SCHEDULER_ENABLED: 'false' }), true);
  });
  test('an unset or unknown NODE_ENV keeps the original always-on behaviour (safe if a deploy forgets NODE_ENV)', () => {
    assert.equal(shouldRegisterNightlyJob({}), true);
    assert.equal(shouldRegisterNightlyJob({ NODE_ENV: 'staging' }), true);
  });
});

describe('CronScheduler.start', () => {
  test('development: nothing is registered, start() reports false, stop() is safe', () => {
    const cron = fakeCron(); const s = scheduler();
    assert.equal(s.start({ env: { NODE_ENV: 'development' }, scheduler: cron }), false);
    assert.equal(cron.calls.length, 0);
    assert.equal(s.cronTask, null);
    assert.doesNotThrow(() => s.stop());
  });
  test('development with JOURNAL_SCHEDULER_ENABLED=true registers the original 23:30 IST job (not executed)', () => {
    const cron = fakeCron(); const s = scheduler();
    assert.equal(s.start({ env: { NODE_ENV: 'development', JOURNAL_SCHEDULER_ENABLED: 'true' }, scheduler: cron }), true);
    assert.equal(cron.calls.length, 1);
    assert.equal(cron.calls[0].expression, '30 23 * * *');
    assert.deepEqual(cron.calls[0].options, { timezone: 'Asia/Kolkata' });
    assert.equal(typeof cron.calls[0].callback, 'function'); // captured, never invoked
  });
  test('production registers exactly as before', () => {
    const cron = fakeCron(); const s = scheduler();
    assert.equal(s.start({ env: { NODE_ENV: 'production' }, scheduler: cron }), true);
    assert.equal(cron.calls.length, 1);
    assert.equal(cron.calls[0].expression, '30 23 * * *');
    assert.deepEqual(cron.calls[0].options, { timezone: 'Asia/Kolkata' });
    s.stop();
    assert.equal(s.cronTask.stopped, true);
  });
  test('JOURNAL_CRON_SCHEDULE override is still honoured', () => {
    const prev = process.env.JOURNAL_CRON_SCHEDULE;
    process.env.JOURNAL_CRON_SCHEDULE = '0 2 * * *';
    try {
      const cron = fakeCron(); const s = scheduler();
      s.start({ env: { NODE_ENV: 'production' }, scheduler: cron });
      assert.equal(cron.calls[0].expression, '0 2 * * *');
    } finally {
      if (prev === undefined) delete process.env.JOURNAL_CRON_SCHEDULE; else process.env.JOURNAL_CRON_SCHEDULE = prev;
    }
  });
  test('the default singleton used by the server follows the same gate (development: not registered)', async () => {
    const { default: singleton } = await import('../src/journal-service/cronScheduler.js');
    const cron = fakeCron();
    assert.equal(singleton.start({ env: { NODE_ENV: 'development' }, scheduler: cron }), false);
    assert.equal(cron.calls.length, 0);
  });
});

test('node-cron fires the 23:30 Kolkata schedule', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date('2026-01-01T17:59:50Z') });
  const scheduler = new CronScheduler();
  let fired = 0;
  scheduler.runNightly = async () => { fired++; };
  try {
    scheduler.start({ env: { NODE_ENV: 'production' } });
    assert.equal(fired, 0);
    t.mock.timers.tick(10000);
    await Promise.resolve(); await Promise.resolve();
    t.mock.timers.tick(1);
    await Promise.resolve(); await Promise.resolve();
    assert.equal(fired, 1);
  } finally { scheduler.stop(); t.mock.timers.reset(); }
});
