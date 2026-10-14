import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { setTestEnv, mintToken, bearer, OTHER_SECRET } from './helpers.js';

setTestEnv();
const auth = await import('../src/middleware/auth.js');
const { requireAuth, bindUserId, requireSelfParam, requireCronSecret } = auth;

const makeApp = () => {
  const app = express();
  app.use(express.json());
  const r = express.Router();
  r.param('userId', requireSelfParam);
  r.all('/echo', (req, res) => res.json({ userId: req.userId, body: req.body, query: req.query }));
  r.get('/u/:userId', (req, res) => res.json({ ok: true }));
  app.use('/p', requireAuth, bindUserId, r);
  app.get('/cron', requireCronSecret, (req, res) => res.json({ ok: true }));
  return app;
};

describe('requireAuth', () => {
  const app = makeApp();

  test('rejects missing / malformed Authorization', async () => {
    await request(app).get('/p/echo').expect(401);
    await request(app).get('/p/echo').set('Authorization', 'Basic abc').expect(401);
    await request(app).get('/p/echo').set('Authorization', 'Bearer not.a.jwt').expect(401);
    await request(app).get('/p/echo').set('Authorization', 'Bearer ').expect(401);
  });

  test('rejects a token signed with another secret', async () => {
    const t = await mintToken('user-a', { secret: OTHER_SECRET });
    await request(app).get('/p/echo').set(bearer(t)).expect(401);
  });

  test('rejects expired tokens', async () => {
    const t = await mintToken('user-a', { expiresIn: '-1m' });
    await request(app).get('/p/echo').set(bearer(t)).expect(401);
  });

  test('rejects wrong issuer / audience / missing subject', async () => {
    await request(app).get('/p/echo').set(bearer(await mintToken('user-a', { iss: 'evil' }))).expect(401);
    await request(app).get('/p/echo').set(bearer(await mintToken('user-a', { aud: 'other-api' }))).expect(401);
    await request(app).get('/p/echo').set(bearer(await mintToken('user-a', { aud: null }))).expect(401);
    await request(app).get('/p/echo').set(bearer(await mintToken(null))).expect(401);
  });

  test('pins HS256 (HS512 with the right secret is rejected)', async () => {
    const t = await mintToken('user-a', { alg: 'HS512' });
    await request(app).get('/p/echo').set(bearer(t)).expect(401);
  });

  test('rejects alg=none (unsigned) tokens', async () => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const t = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'user-a', iss: 'mantra-web', aud: 'mantra-api', exp: now + 300 })}.`;
    await request(app).get('/p/echo').set(bearer(t)).expect(401);
  });

  test('rejects tokens older than the max age even if exp is far away', async () => {
    const old = Math.floor(Date.now() / 1000) - 3600;
    const t = await mintToken('user-a', { iat: old, expiresIn: '1d' });
    await request(app).get('/p/echo').set(bearer(t)).expect(401);
  });

  test('accepts a valid token and exposes only the token subject', async () => {
    const t = await mintToken('user-a');
    const res = await request(app).get('/p/echo').set(bearer(t)).expect(200);
    assert.equal(res.body.userId, 'user-a');
  });

  test('401 body never echoes the token', async () => {
    const t = await mintToken('user-a', { secret: OTHER_SECRET });
    const res = await request(app).get('/p/echo').set(bearer(t));
    assert.ok(!JSON.stringify(res.body).includes(t));
  });
});

describe('bindUserId (identity only from the token)', () => {
  const app = makeApp();
  let token;
  before(async () => { token = await mintToken('user-a'); });

  test('fills userId into body and query when the client omits it', async () => {
    const res = await request(app).post('/p/echo?x=1').set(bearer(token)).send({ hello: 'w' }).expect(200);
    assert.equal(res.body.body.userId, 'user-a');
    assert.equal(res.body.query.userId, 'user-a');
    assert.equal(res.body.body.hello, 'w');
  });

  test('403 when body.userId differs from the token subject', async () => {
    const res = await request(app).post('/p/echo').set(bearer(token)).send({ userId: 'user-b' }).expect(403);
    assert.equal(res.body.code, 'USER_MISMATCH');
  });

  test('403 when query.userId / user_id differs', async () => {
    await request(app).get('/p/echo?userId=user-b').set(bearer(token)).expect(403);
    await request(app).post('/p/echo').set(bearer(token)).send({ user_id: 'user-b' }).expect(403);
  });

  test('allows a matching userId (existing frontend still sends it)', async () => {
    await request(app).post('/p/echo').set(bearer(token)).send({ userId: 'user-a' }).expect(200);
  });

  test(':userId path param must equal the caller', async () => {
    await request(app).get('/p/u/user-a').set(bearer(token)).expect(200);
    await request(app).get('/p/u/user-b').set(bearer(token)).expect(403);
  });
});

describe('requireCronSecret', () => {
  const app = makeApp();
  test('rejects missing/incorrect, accepts correct', async () => {
    await request(app).get('/cron').expect(401);
    await request(app).get('/cron').set(bearer('wrong')).expect(401);
    await request(app).get('/cron').set(bearer(process.env.CRON_SECRET)).expect(200);
  });
  test('a user JWT is not a cron secret', async () => {
    await request(app).get('/cron').set(bearer(await mintToken('user-a'))).expect(401);
  });
  test('404 (disabled) when CRON_SECRET is unset', async () => {
    const saved = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    await request(app).get('/cron').set(bearer('x')).expect(404);
    process.env.CRON_SECRET = saved;
  });
});

describe('API_JWT_SECRET is required (no NEXTAUTH_SECRET fallback)', () => {
  const withEnv = async (env, fn) => {
    const saved = { API_JWT_SECRET: process.env.API_JWT_SECRET, NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET };
    for (const [k, v] of Object.entries(env)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    try { await fn(); } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k]; else process.env[k] = v;
      }
    }
  };
  test('NEXTAUTH_SECRET alone does not authenticate: boot check throws and requests fail closed', async () => {
    const t = await mintToken('user-a', { secret: 'n'.repeat(40) });
    await withEnv({ API_JWT_SECRET: undefined, NEXTAUTH_SECRET: 'n'.repeat(40) }, async () => {
      assert.throws(() => auth.assertAuthConfigured(), /API_JWT_SECRET is not configured/);
      const res = await request(makeApp()).get('/p/echo').set(bearer(t));
      assert.equal(res.status, 500);
    });
  });
  test('short secret is rejected', async () => {
    await withEnv({ API_JWT_SECRET: 'short' }, async () => {
      assert.throws(() => auth.assertAuthConfigured(), /at least 32/);
    });
  });
  test('API_JWT_SECRET equal to NEXTAUTH_SECRET is rejected', async () => {
    await withEnv({ API_JWT_SECRET: 'x'.repeat(40), NEXTAUTH_SECRET: 'x'.repeat(40) }, async () => {
      assert.throws(() => auth.assertAuthConfigured(), /must differ/);
    });
  });
  test('a token signed with NEXTAUTH_SECRET is rejected when API_JWT_SECRET differs', async () => {
    await withEnv({ NEXTAUTH_SECRET: 'n'.repeat(40) }, async () => {
      const t = await mintToken('user-a', { secret: 'n'.repeat(40) });
      await request(makeApp()).get('/p/echo').set(bearer(t)).expect(401);
    });
  });
});
