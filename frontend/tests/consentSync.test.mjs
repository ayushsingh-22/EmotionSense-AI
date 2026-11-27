import { test } from 'node:test';import assert from 'node:assert/strict';
import { watchConsentUpdates,announceConsentChange } from '../lib/consentUpdates.ts';
import { requestVoiceConsent } from '../lib/voiceConsent.ts';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('prompt grant refreshes settings; withdrawal makes the next voice use prompt again',async()=>{
 const w=new EventTarget(),d=new EventTarget();Object.defineProperty(d,'visibilityState',{value:'visible'});globalThis.window=w;let granted=false,shown=null,prompts=0;
 const stop=watchConsentUpdates({windowTarget:w,documentTarget:d,load:async()=>[{purpose:'voice_processing',granted}],apply:value=>{shown=value.voice_processing},fail:()=>{throw Error('load failed')}});
 const prompt=e=>{e.preventDefault();prompts++;granted=true;announceConsentChange();e.detail.resolve(true)};w.addEventListener('mindhaven:voice-consent',prompt);
 try{await tick();assert.equal(shown,false);assert.equal(await requestVoiceConsent(),true);await tick();assert.equal(shown,true);granted=false;announceConsentChange();await tick();assert.equal(shown,false);if(!granted)assert.equal(await requestVoiceConsent(),true);assert.equal(prompts,2)}finally{stop();w.removeEventListener('mindhaven:voice-consent',prompt);delete globalThis.window}
});
