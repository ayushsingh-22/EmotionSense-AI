import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_BYTES, NAME_MAX_LENGTH } from '../lib/passwordPolicy.ts';

const contract = JSON.parse(fs.readFileSync(new URL('../../contracts/auth-register.json', import.meta.url), 'utf8'));
const source = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
function load(path, mocks, context = {}) {
  const js = ts.transpileModule(source(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: name => { if (name in mocks) return mocks[name]; throw new Error(`unexpected import ${name}`); }, TextEncoder, JSON, Number, Object, AbortSignal, Promise, ...context });
  return exports;
}
const registerContract = load('../lib/registerContract.ts', {});

// Run the real Next route handler: mocked next/server + fetch record what reaches the backend.
async function callRoute(formBody, backend = { status: 202, body: {} }) {
  const forwarded = [];
  const fetchMock = async (url, init) => { forwarded.push({ url, init }); return { status: backend.status, json: async () => { if (backend.body === undefined) throw new Error('no body'); return backend.body; } }; };
  const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200, headers: init?.headers }) };
  const route = load('../app/api/auth/register/route.ts', { 'next/server': { NextResponse }, '@/lib/backendAuthClient': { backendUrl: () => 'https://api.invalid' }, '@/lib/registerContract': registerContract }, { fetch: fetchMock });
  const raw = JSON.stringify(formBody);
  const res = await route.POST({ headers: { get: () => String(raw.length) }, text: async () => raw });
  // Re-serialise: objects created inside the vm context have a different Object prototype.
  return { res: JSON.parse(JSON.stringify({ status: res.status, body: res.body })), forwarded };
}

test('website limits equal the shared contract', () => {
  assert.equal(PASSWORD_MIN_LENGTH, contract.passwordMinLength);
  assert.equal(PASSWORD_MAX_BYTES, contract.passwordMaxBytes);
  assert.equal(NAME_MAX_LENGTH, contract.nameMaxLength);
  assert.deepEqual(Object.keys(registerContract.REGISTER_ERROR_MESSAGES).sort(), [...contract.errorCodes].sort());
  assert.match(registerContract.REGISTER_ERROR_MESSAGES.PASSWORD_TOO_SHORT, new RegExp(`${contract.passwordMinLength} characters`));
  assert.match(registerContract.REGISTER_ERROR_MESSAGES.NAME_TOO_LONG, new RegExp(String(contract.nameMaxLength)));
});

test('the signup form posts exactly the contract fields to the Next route', () => {
  const ctx = source('../contexts/AuthContext.tsx');
  const line = ctx.split('\n').find(l => l.includes("fetch('/api/auth/register'"));
  const m = line && line.match(/body:JSON\.stringify\(\{([^}]*)\}\)/);
  assert.ok(m, 'signUp request found');
  assert.deepEqual(m[1].split(',').map(s => s.trim()).sort(), [...contract.formToNextRoute].sort());
});

test('the Next route forwards exactly the backend contract body, with the right types, and nothing else', async () => {
  const form = { email: 'person@invalid.test', password: 'twelve-chars-ok', fullName: 'Person', isAdult: true, extraClientField: 'must not leak', userId: 'other' };
  const { res, forwarded } = await callRoute(form);
  assert.equal(res.status, contract.successStatus);
  assert.equal(forwarded.length, 1);
  assert.equal(forwarded[0].url, 'https://api.invalid/api/auth/register');
  const sent = JSON.parse(forwarded[0].init.body);
  assert.deepEqual(Object.keys(sent).sort(), Object.keys(contract.nextRouteToBackend).sort());
  for (const [key, type] of Object.entries(contract.nextRouteToBackend)) assert.equal(typeof sent[key], type, key);
  assert.equal(sent.name, 'Person');
});

test('backend validation codes reach the browser; unknown codes and old backends fall back safely', async () => {
  for (const code of contract.errorCodes) {
    const { res } = await callRoute({ email: 'a@invalid.test', password: 'x', fullName: 'A', isAdult: true }, { status: 400, body: { error: 'Invalid request', code } });
    assert.deepEqual([res.status, res.body], [400, { error: 'Invalid request', code }]);
    assert.equal(registerContract.registerErrorMessage(400, code), registerContract.REGISTER_ERROR_MESSAGES[code]);
  }
  const unknown = await callRoute({}, { status: 400, body: { error: 'x', code: 'SOMETHING_INTERNAL', detail: 'private' } });
  assert.deepEqual(unknown.res.body, { error: 'Invalid request' }, 'unlisted codes and extra fields are not passed through');
  const old = await callRoute({}, { status: 400, body: undefined });
  assert.deepEqual(old.res.body, { error: 'Invalid request' }, 'an older backend without codes still works');
  assert.match(registerContract.registerErrorMessage(400, undefined), /Unable to process the request/);
  assert.match(registerContract.registerErrorMessage(429), /Too many attempts/);
  const down = await callRoute({}, { status: 502, body: {} });
  assert.deepEqual([down.res.status, down.res.body], [503, { error: 'Service temporarily unavailable' }]);
});
