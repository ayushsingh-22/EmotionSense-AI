import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
function component(path){
 const source=fs.readFileSync(new URL(path,import.meta.url),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const exports={};const api={moodLabels:['calm','happy','sad'],bytes:s=>new TextEncoder().encode(s).length,dateRange:()=>({from:'2026-01-01',to:'2026-01-31'}),wellbeing:{},userMessage:()=>''};
 const mockRequire=name=>name==='@/lib/wellbeing'?api:name==='@/components/auth/AuthGuard'?{AuthGuard:({children})=>children}:name==='@/components/ui/button'?{Button:({children,...props})=>React.createElement('button',props,children)}:name==='@/lib/api'?{getBackendAuthToken:async()=>''}:require(name);
 vm.runInNewContext(js,{exports,require:mockRequire,TextEncoder,process,console});return exports.default||exports.WrittenJournals;
}
test('mood form renders its labels, note limit, and history',()=>{const Page=component('../app/mood/page.tsx');const html=renderToStaticMarkup(React.createElement(Page));assert.match(html,/Mood check-in/);assert.match(html,/calm/);assert.match(html,/2000 bytes/);assert.match(html,/Your history/)});
test('written journal and empty library explain their purpose',()=>{const Journal=component('../components/journal/WrittenJournals.tsx');const Library=component('../app/library/page.tsx');assert.match(renderToStaticMarkup(React.createElement(Journal)),/Written by you/);assert.match(renderToStaticMarkup(React.createElement(Library)),/There are no activities here yet/)});
