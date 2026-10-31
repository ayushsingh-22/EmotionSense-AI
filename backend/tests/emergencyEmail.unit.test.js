import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEmergencySender, emergencyAlertText, emergencyAlertHtml } from '../src/utils/emergencyEmail.js';
import { redact } from '../src/utils/logRedaction.js';

test('an absent first name uses a natural fallback',()=>{
  const text=emergencyAlertText({},new Date('2026-01-01T00:00:00Z'));
  assert.match(text,/signs that someone you know may be struggling/);
  assert.match(text,/because they chose you as an emergency contact/);
});

test('emergency alert contains minimal information and escapes HTML',()=>{
  const u={full_name:'<script> Example'};
  const text=emergencyAlertText(u,new Date('2026-01-01T00:00:00Z'));
  assert.ok(text.includes('IST'));assert.ok(text.includes('14416'));assert.ok(text.includes('112'));
  assert.ok(!emergencyAlertHtml(u).includes('<script>'));
});
test('delivery retries and only records provider acceptance',async()=>{
  let calls=0;const pauses=[];const send=createEmergencySender({email:{send:async()=>{calls++;if(calls<3)throw Error('temporary');return {accepted:true}}},sleep:async ms=>pauses.push(ms)});
  assert.equal(await send({full_name:'Test'}, {contact_email:'fake'}),true);assert.equal(calls,3);assert.equal(pauses.length,2);
});
test('delivery failure exhausts retries',async()=>{
  let calls=0;const send=createEmergencySender({email:{send:async()=>{calls++;throw Error('temporary')}},sleep:async()=>{}});
  assert.equal(await send({full_name:'Test'},{contact_email:'fake'}),false);assert.equal(calls,3);
});
test('a hung adapter is bounded on each attempt',async()=>{
  let calls=0;const keepAlive=setTimeout(()=>{},1000);
  try {
    const send=createEmergencySender({email:{send:()=>{calls++;return new Promise(()=>{})}},sleep:async()=>{},timeoutMs:5});
    assert.equal(await send({full_name:'Test'},{contact_email:'fake'}),false);assert.equal(calls,3);
  } finally {clearTimeout(keepAlive)}
});
test('email addresses are removed from log output',()=>{
  const address='contact'+'@'+'example.invalid';
  assert.ok(!redact(`delivery to ${address}`).includes(address));
});
