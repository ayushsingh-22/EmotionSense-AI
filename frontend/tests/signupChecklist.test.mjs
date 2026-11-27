import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const transpile = (p, jsx) => ts.transpileModule(fs.readFileSync(new URL(p, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, ...(jsx ? { jsx: ts.JsxEmit.ReactJSX } : {}) } }).outputText;
const lib = p => { const exports = {}; vm.runInNewContext(transpile(p), { exports, Object, Set, JSON }); return exports; };

test('signup page shows every password rule before submit, unticked, with the 12-character minimum', () => {
  const el = (tag) => ({ children, ...props }) => React.createElement(tag, props, children);
  const mocks = {
    '@/lib/passwordPolicy': lib('../lib/passwordPolicy.ts'), '@/lib/registerContract': lib('../lib/registerContract.ts'),
    'next/link': el('a'), 'next/navigation': { useRouter: () => ({ push() {} }) },
    'lucide-react': { Eye: el('i'), EyeOff: el('i'), Activity: el('i') },
    '@/contexts/AuthContext': { useAuth: () => ({ signUp: async () => ({}), user: null }) },
    '@/components/ui/button': { Button: el('button') }, '@/components/ui/input': { Input: props => React.createElement('input', props) },
    '@/components/ui/label': { Label: el('label') }, '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
    '@/components/ui/card': { Card: el('div'), CardContent: el('div'), CardDescription: el('p'), CardHeader: el('div'), CardTitle: el('h1') }
  };
  const exports = {};
  vm.runInNewContext(transpile('../app/auth/signup/page.tsx', true), { exports, require: n => mocks[n] ?? require(n), console });
  const html = renderToStaticMarkup(React.createElement(exports.default));
  for (const rule of ['length', 'maxBytes', 'common', 'repetitive', 'email', 'name']) assert.match(html, new RegExp(`data-rule="${rule}" data-ok="false"`), rule);
  assert.match(html, /At least 12 characters/);
  assert.match(html, /aria-describedby="password-rules"/);
  assert.match(html, /id="password-rules" aria-live="polite"/);
  assert.match(html, /minLength="12"/);
  assert.match(html, /maxLength="100"/);
});
