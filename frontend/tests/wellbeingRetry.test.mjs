import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retryOnce } from '../lib/wellbeingRetry.ts';
const busy=()=>Object.assign(new Error('busy'),{response:{status:503}});
test('safe requests announce and retry one 503',async()=>{let calls=0,announced=0;const result=await retryOnce(async()=>{if(++calls===1)throw busy();return 'ok'},true,()=>announced++,async()=>{});assert.equal(result,'ok');assert.equal(calls,2);assert.equal(announced,1)});
test('ambiguous writes and non-503 errors are never replayed',async()=>{for(const [safe,error] of [[false,busy()],[true,Object.assign(Error(),{response:{status:400}})]]){let calls=0;await assert.rejects(()=>retryOnce(async()=>{calls++;throw error},safe,undefined,async()=>{}));assert.equal(calls,1)}});
test('a second 503 is returned to the caller',async()=>{let calls=0;await assert.rejects(()=>retryOnce(async()=>{calls++;throw busy()},true,undefined,async()=>{}));assert.equal(calls,2)});
