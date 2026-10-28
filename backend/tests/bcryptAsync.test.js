import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

test('backend source has no synchronous bcrypt operations', async () => {
  const root = fileURLToPath(new URL('../src/', import.meta.url));
  async function scan(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) await scan(p);
      else if (/\.[cm]?[jt]s$/.test(entry.name)) {
        const source = await readFile(p, 'utf8');
        assert.doesNotMatch(source, /\b(?:hashSync|compareSync|genSaltSync)\s*\(/, `synchronous bcrypt call in ${p}`);
      }
    }
  }
  await scan(root);
});
