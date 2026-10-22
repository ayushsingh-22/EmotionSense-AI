import { buildCleanupPlan, cleanupPlanIsSafe, PRISMA_MIGRATIONS_TABLE, STATIC_TABLES } from './freshDevelopmentGuard.mjs';

const plan = buildCleanupPlan();

console.log('DRY RUN ONLY: no database connection or write operation is performed.');
console.log(`Protected tables: ${[PRISMA_MIGRATIONS_TABLE, ...STATIC_TABLES].sort().join(', ')}`);
console.log('Reviewed deletion order:');
for (const entry of plan) console.log(`  ${entry.statement}`);
console.log(`Plan safety checks: ${cleanupPlanIsSafe(plan) ? 'PASS' : 'FAIL'}`);
