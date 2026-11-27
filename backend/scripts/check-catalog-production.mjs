import fs from 'node:fs';
import { assertProductionCatalog, productionCatalogSubset } from '../src/wellbeing/catalogProductionGuard.js';
// CI check: every item a production run would seed must have real sources and licences.
// Drafts with test-only sources are excluded from production runs and reported, not failed.
try{
 const catalog=JSON.parse(fs.readFileSync(new URL('../../content/catalog.json',import.meta.url),'utf8').replace(/^﻿/,''));
 const {catalog:production,excluded}=productionCatalogSubset(catalog);
 assertProductionCatalog(production);
 console.log(`Production catalog test-content check passed: ${production.items.length} item(s) eligible (${production.items.filter(x=>x.status==='published').length} published); ${excluded.length} test-only draft(s) excluded from production runs.`);
}catch(error){console.error(error.message);process.exitCode=1}
