import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEmergencySender, createGuardedEmergencySender, emergencyAlertText, emergencyAlertHtml } from '../src/utils/emergencyEmail.js';
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

test('alert sender requires enabled current contact and latest consent before provider call',async()=>{
  let enabled=true,granted=false,calls=0;const db={emergencyContact:{findUnique:async()=>({notifyEnabled:enabled,contactEmail:'contact.invalid'})},userConsent:{findFirst:async()=>({granted})},alertLog:{create:async()=>({id:'event'}),updateMany:async()=>({count:1})},$queryRaw:async()=>[]};db.$transaction=async fn=>fn(db);
  const send=createGuardedEmergencySender({db,email:{send:async()=>{calls++;return {accepted:true}}}});const user={id:'u'},contact={contact_email:'contact.invalid'};
  assert.equal(await send(user,contact),false);assert.equal(calls,0);granted=true;enabled=false;assert.equal(await send(user,contact),false);assert.equal(calls,0);enabled=true;assert.equal(await send(user,contact),true);assert.equal(calls,1);
});

test('withdrawal between retries prevents additional provider calls',async()=>{let granted=true,calls=0;const db={emergencyContact:{findUnique:async()=>({notifyEnabled:true,contactEmail:'contact.invalid'})},userConsent:{findFirst:async()=>({granted})},alertLog:{create:async()=>({id:'event'}),updateMany:async()=>({count:1})},$queryRaw:async()=>[]};db.$transaction=async fn=>fn(db);const send=createGuardedEmergencySender({db,sleep:async()=>{},email:{send:async()=>{calls++;granted=false;throw Error('temporary')}}});assert.equal(await send({id:'u'},{contact_email:'contact.invalid'}),false);assert.equal(calls,1)});

test('provider call occurs after dispatch transaction ends',async()=>{let active=false;const db={emergencyContact:{findUnique:async()=>({notifyEnabled:true,contactEmail:'contact.invalid'})},userConsent:{findFirst:async()=>({granted:true})},alertLog:{create:async()=>({id:'event'}),updateMany:async()=>({count:1})},$queryRaw:async()=>[]};db.$transaction=async fn=>{active=true;try{return await fn(db)}finally{active=false}};const send=createGuardedEmergencySender({db,email:{send:async()=>{assert.equal(active,false);return {accepted:true}}}});assert.equal(await send({id:'u'},{contact_email:'contact.invalid'}),true)});
