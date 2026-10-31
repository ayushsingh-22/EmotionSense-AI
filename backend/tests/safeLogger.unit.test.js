import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { safeError } from '../src/utils/logger.js';

test('direct console calls are confined to logging modules', () => {
  const walk = dir => fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(path.join(dir,e.name)) : [path.join(dir,e.name)]);
  const files=walk('src').filter(f=>/\.(js|md)$/.test(f) && !['src/utils/logger.js','src/utils/logRedaction.js'].includes(f.replaceAll('\\','/')));
  for(const file of files) assert.doesNotMatch(fs.readFileSync(file,'utf8'), /\bconsole\.(?:log|info|warn|error)\s*\(/, file);
});
test('safe error logger outputs only approved fields', () => {
  const lines=[];const old=console.error;console.error=(line)=>lines.push(line);
  try { safeError({name:'Error',status:503,provider:'resend',code:'P2028',message:'private content',body:'private content',stack:'private content'}); }
  finally {console.error=old}
  assert.deepEqual(JSON.parse(lines[0]),{level:'error',errorName:'Error',status:503,provider:'resend',code:'P2028'});
  assert.ok(!lines[0].includes('private content'));
});
