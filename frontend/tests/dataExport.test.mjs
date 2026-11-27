import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

function load(path, mocks = {}, jsx = false) {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, ...(jsx ? { jsx: ts.JsxEmit.ReactJSX } : {}) } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: name => mocks[name] ?? require(name), Blob, JSON, Promise, String, Date, Error, setTimeout, URL, console });
  return exports;
}
const lib = load('../lib/dataExport.ts');
const response = (status, body) => ({ ok: status < 400, status, json: async () => body, blob: async () => new Blob([JSON.stringify(body)]) });

test('posts only the password to /api/me/export with auth header and no-store, then saves a dated file', async () => {
  const calls = [], saved = [], phases = [];
  const name = await lib.downloadMyData('secret-password-value', {
    baseUrl: 'https://api.example.test/', authHeaders: async () => ({ Authorization: 'Bearer t' }),
    fetchImpl: async (url, init) => { calls.push({ url, init }); return response(200, { format: 'mindhaven-export' }); },
    save: (blob, filename) => saved.push({ blob, filename }), now: () => new Date(2026, 10, 26, 23, 30), onPhase: p => phases.push(p)
  });
  assert.equal(name, 'mindhaven-export-2026-11-26.json');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.example.test/api/me/export');
  assert.equal(calls[0].init.method, 'POST'); assert.equal(calls[0].init.cache, 'no-store');
  assert.deepEqual(JSON.parse(calls[0].init.body), { password: 'secret-password-value' });
  assert.equal(calls[0].init.headers.Authorization, 'Bearer t');
  assert.equal(saved[0].filename, 'mindhaven-export-2026-11-26.json'); assert.equal(saved[0].blob.type, 'application/json');
  assert.deepEqual(phases, ['verifying', 'saving', 'done']);
});

test('errors map to clear messages, never save, and a 401 is not retried', async () => {
  for (const [status, pattern] of [[401, /password did not match/], [429, /3 per day/], [413, /20 MB export limit/], [503, /waking up/], [500, /Something went wrong/]]) {
    let calls = 0, saved = 0, phases = [];
    await assert.rejects(lib.downloadMyData('pw', { baseUrl: '', authHeaders: async () => ({}), fetchImpl: async () => { calls++; return response(status, { error: { message: 'Your data is larger than the 20 MB export limit, so no file was created.' } }); }, save: () => saved++, onPhase: p => phases.push(p) }), e => pattern.test(e.message) && e.status === status);
    assert.equal(calls, 1); assert.equal(saved, 0); assert.equal(phases.at(-1), 'error');
  }
  await assert.rejects(lib.downloadMyData('pw', { baseUrl: '', authHeaders: async () => ({}), fetchImpl: async () => { throw new TypeError('network'); }, save: () => {} }), /Could not reach the server/);
});

test('filename uses the local calendar date', () => {
  assert.equal(lib.exportFilename(new Date(2026, 0, 5, 0, 1)), 'mindhaven-export-2026-01-05.json');
});

test('settings section explains what is included in one sentence and offers the download', () => {
  const mod = load('../components/DataExportSettings.tsx', {
    '@/lib/dataExport': lib, '@/lib/api': { api: { defaults: { baseURL: '' } }, authHeaders: async () => ({}) },
    '@/components/ui/button': { Button: ({ children, variant, ...props }) => React.createElement('button', props, children) }
  }, true);
  const html = renderToStaticMarkup(React.createElement(mod.DataExportSettings));
  assert.match(html, /Download my data/);
  assert.ok(html.includes(lib.EXPORT_SUMMARY.replace(/'/g, '&#x27;')));
  assert.equal(lib.EXPORT_SUMMARY.split(/[.!?](\s|$)/).filter(s => s && s.trim()).length, 1, 'exactly one sentence');
  const settings = fs.readFileSync(new URL('../app/settings/page.tsx', import.meta.url), 'utf8');
  assert.match(settings, /<DataExportSettings \/>/);
});
