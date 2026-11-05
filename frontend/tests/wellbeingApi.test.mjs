import { test } from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
test('wellbeing client sends expected API paths and consent payloads',async()=>{
 const calls=[],exports={};const api={request:async config=>{calls.push(config);return {data:{data:{}}}}};const code=ts.transpileModule(fs.readFileSync(new URL('../lib/wellbeing.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{exports,TextEncoder,Date,Number,Promise,Set,require:name=>name==='./api'?{api}:name==='./wellbeingRetry'?{retryOnce:fn=>fn()}:name==='./consentUpdates'?{announceConsentChange:()=>{}}:null});
 await exports.wellbeing.addMood({moodLabel:'calm'});await exports.wellbeing.consent('voice_processing',true);await exports.wellbeing.start('fixture');await exports.wellbeing.finish('session','completed');await exports.wellbeing.feedback('session',{helpfulness:'better'});
 assert.deepEqual(calls.map(x=>[x.method,x.url]),[['POST','/api/me/mood-checkins'],['POST','/api/me/consents'],['POST','/api/me/activity-sessions'],['PATCH','/api/me/activity-sessions/session'],['POST','/api/me/activity-sessions/session/feedback']]);assert.equal(calls[1].data.noticeVersion,'voice-processing-v1');assert.equal(calls[1].data.granted,true);
});
