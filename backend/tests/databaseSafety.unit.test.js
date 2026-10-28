import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertSafeTestDatabase, DEV } from './devDbGuard.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const validEnv=()=>({NODE_ENV:'test',EXPECTED_NEON_BRANCH_ID:DEV.branch,DATABASE_URL:`postgresql://placeholder@${DEV.endpoint}-pooler.c-4.ap-southeast-1.aws.neon.tech/test`});
const fake=(identity={...DEV})=>({$queryRawUnsafe:async()=>[identity]});
test('test database guard accepts the designated branch',async()=>assert.equal((await assertSafeTestDatabase(fake(),validEnv())).branch,DEV.branch));
for(const [name,change] of [
  ['missing branch pin',e=>delete e.EXPECTED_NEON_BRANCH_ID],
  ['different branch pin',e=>e.EXPECTED_NEON_BRANCH_ID='unapproved'],
  ['production environment',e=>e.NODE_ENV='production'],
  ['mixed-case production environment',e=>e.NODE_ENV=' Production '],
  ['missing URL',e=>delete e.DATABASE_URL],
  ['malformed URL',e=>e.DATABASE_URL='invalid'],
  ['unapproved host',e=>e.DATABASE_URL='postgresql://placeholder@unapproved.invalid/test'],
  ['forged endpoint suffix',e=>e.DATABASE_URL=`postgresql://placeholder@${DEV.endpoint}-other.c-4.ap-southeast-1.aws.neon.tech/test`],
  ['unapproved host domain',e=>e.DATABASE_URL=`postgresql://placeholder@${DEV.endpoint}.invalid/test`]
]) test(`test database guard rejects ${name}`,async()=>{const env=validEnv();change(env);await assert.rejects(assertSafeTestDatabase(fake(),env))});
for(const [name,identity] of [
  ['server-reported branch',{...DEV,branch:'unapproved'}],
  ['server-reported endpoint',{...DEV,endpoint:'unapproved'}],
  ['server-reported project',{...DEV,project:'unapproved'}],
  ['incomplete server identity',{}]
])test(`test database guard rejects a wrong ${name}`,async()=>assert.rejects(assertSafeTestDatabase(fake(identity),validEnv())));

for(const file of ['api.integration.test.js','backendAuth.integration.test.js']) test(`${file} cleanup is guarded and limited to synthetic users`,()=>{
  const source=fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),file),'utf8');
  assert.match(source,/deleteMany\(\{\s*where:\s*\{\s*email:\s*\{\s*startsWith:/);
  assert.match(source,/endsWith:\s*(?:suffix|'@example\.invalid')/);
  assert.doesNotMatch(source,/\.(?:contentItem|mediaAsset|\$executeRawUnsafe)\.?(?:deleteMany)?\s*\(/);
  assert.doesNotMatch(source,/\.user\.deleteMany\(\s*\{\s*\}\s*\)/);
});
