import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';

test('production loggers do not create or append local log files', async () => {
  const saved = process.env.NODE_ENV, mkdir = fs.mkdirSync, append = fs.appendFileSync, asyncAppend = fs.appendFile;
  process.env.NODE_ENV = 'production'; let writes = 0;
  fs.mkdirSync = () => { writes++; }; fs.appendFileSync = () => { writes++; }; fs.appendFile = () => { writes++; };
  try {
    const { default: logger } = await import('../src/utils/logger.js?file-test');
    const { requestLogger } = await import('../src/middleware/requestLogger.js?file-test');
    logger.writeToFile('INFO', 'test');
    const response = new EventEmitter(); response.statusCode = 200;
    requestLogger({ id:'test', method:'GET', originalUrl:'/api/health', ip:'127.0.0.1' }, response, () => {}); response.emit('finish');
    assert.equal(writes, 0);
  } finally { fs.mkdirSync = mkdir; fs.appendFileSync = append; fs.appendFile = asyncAppend; if (saved === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = saved; }
});
