import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../src/middleware/schemas.js', import.meta.url), 'utf8');
const load = spec => import('data:text/javascript;base64,' + Buffer.from(source.replace("from 'zod'", `from '${import.meta.resolve(spec)}'`)).toString('base64'));
test('Zod upgrade retains schema acceptance and parsed data for representative inputs', async () => {
  const [old, current] = await Promise.all([load('zod/v3'), load('zod')]);
  const inputs = [{}, {message:'  sample  ',sessionId:null,includeAudio:'true',memoryLength:'2',unknown:'preserved'}, {message:' ',sessionId:'a'}, {message:null}, {text:' text '}, {text:''}, {contactName:'x',contactEmail:'x@example.invalid',contactPhone:null}, {limit:'5'}, {limit:'1.2'}, {limit:null}, {date:'2026-01-01',force:'false'}, {activity_type:'x',content:null,session_id:null}];
  for (const key of Object.keys(old).filter(k => typeof old[k]?.safeParse === 'function')) for (const sample of inputs) {
    const a=old[key].safeParse(sample), b=current[key].safeParse(sample);
    assert.equal(b.success,a.success,`${key} acceptance`);
    if (a.success) assert.deepEqual(b.data,a.data,`${key} parsed values`);
    else { assert.ok(Array.isArray(b.error.issues)); assert.ok(b.error.issues.every(issue => Array.isArray(issue.path) && typeof issue.message === 'string')); }
  }
});
