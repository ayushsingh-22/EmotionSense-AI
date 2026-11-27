import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
test('theme provider renders its initialization script on the server',()=>{
 const source=fs.readFileSync(new URL('../components/theme-provider.tsx',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const exports={};vm.runInNewContext(code,{exports,require,console,process});
 const html=renderToStaticMarkup(React.createElement(exports.ThemeProvider,null,React.createElement('span',null,'Content')));
 assert.match(html,/<script/);assert.match(html,/Content/);assert.doesNotMatch(html,/visibility:hidden/);
});
