import fs from 'node:fs';
import { assertProductionCatalog } from '../src/wellbeing/catalogProductionGuard.js';
try{const catalog=JSON.parse(fs.readFileSync(new URL('../../content/catalog.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));assertProductionCatalog(catalog);console.log('Production catalog test-content check passed.')}catch(error){console.error(error.message);process.exitCode=1}
