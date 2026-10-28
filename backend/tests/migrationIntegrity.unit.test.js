import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const migrations=path.join(root,'prisma/migrations');
const original={
  '20260923032421_init':'99889bdb34d50b0de97a17e25d926b0947dc4c1c9e4d42297158e3640d47ef9f',
  '20261012181122_add_wellbeing_v2':'d4657ac71f55ab0b81e960ae645f0bbfedc0ab331cf022fbb4307d646f29bcc7',
  '20261014120000_add_auth_identities':'99c5fdb6c09edfc3add368fc3eb108bfd4dcf03407b464485f0280a5eaefb384',
  '20261016120000_add_auth_link_challenges':'475bce9c7ddea4a616c13e7d11fb74da1469db52f08916fb858b3cd1a5f8dd5f'
};
for(const [name,expected] of Object.entries(original))test(`applied migration checksum remains unchanged: ${name}`,()=>{
  assert.equal(createHash('sha256').update(fs.readFileSync(path.join(migrations,name,'migration.sql'))).digest('hex'),expected);
});
test('the original migrations retain their order and later migrations follow',()=>{
  const dirs=fs.readdirSync(migrations).filter(x=>/^\d{14}_/.test(x)).sort();assert.deepEqual(dirs.slice(0,4),Object.keys(original));
});
test('migration SQL files use LF line endings',()=>{
  for(const name of fs.readdirSync(migrations).filter(x=>/^\d{14}_/.test(x)))assert.ok(!fs.readFileSync(path.join(migrations,name,'migration.sql')).includes(13));
});
test('git attributes pin migration files to LF',()=>{
  const attributes=fs.readFileSync(path.join(root,'.gitattributes'),'utf8').split(/\r?\n/).map(s=>s.trim());assert.ok(attributes.includes('prisma/migrations/**/migration.sql text eol=lf'));assert.ok(attributes.includes('prisma/migrations/migration_lock.toml text eol=lf'));
});
test('case-insensitive user email uniqueness retains its guarded migration',()=>{
  const sql=fs.readFileSync(path.join(migrations,'20261014120000_add_auth_identities','migration.sql'),'utf8');assert.match(sql,/CREATE UNIQUE INDEX "users_email_lower_key" ON "users"\(lower\("email"\)\)/);assert.ok(sql.indexOf('RAISE EXCEPTION')<sql.indexOf('CREATE UNIQUE INDEX "users_email_lower_key"'));
});
