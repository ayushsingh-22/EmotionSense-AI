import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retryRead, transactionBeforeStart } from '../src/auth/transientRetry.js';
const sleep=async()=>{};
for(const code of ['P1001','P1017','P2024','ECONNRESET'])test(`read retries ${code} only once`,async()=>{let calls=0;assert.equal(await retryRead(async()=>{if(++calls===1)throw Object.assign(Error(),{code});return 7},sleep),7);assert.equal(calls,2)});
test('transaction retries only when its callback never started',async()=>{let calls=0;const db={$transaction:async f=>{if(++calls===1)throw Object.assign(Error(),{code:'P1001'});return f({})}};assert.equal(await transactionBeforeStart(db,async()=>7,{},sleep),7);assert.equal(calls,2);calls=0;await assert.rejects(()=>transactionBeforeStart({$transaction:async f=>{calls++;return f({})}},async()=>{throw Object.assign(Error(),{code:'P1017'})},{},sleep),{code:'P1017'});assert.equal(calls,1)});
