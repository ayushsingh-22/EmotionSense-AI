export const DEVELOPMENT = {
  project: 'fancy-union-28873755',
  branch: 'br-ancient-snow-b3si0kwz',
  endpoint: 'ep-cold-hill-b3lffx1r'
};

export const PRISMA_MIGRATIONS_TABLE = '_prisma_migrations';
export const PENDING_TABLE = 'auth_link_challenges';

export const STATIC_TABLES = new Set(['content_items', 'media_assets']);

export const APPLICATION_TABLES = [
  'activity_feedback',
  'activity_sessions',
  'alert_logs',
  'auth_identities',
  'chat_sessions',
  'content_items',
  'daily_emotion_summary',
  'emergency_contacts',
  'emotion_analysis',
  'emotion_flow_segments',
  'journal_entries',
  'master_user_activity',
  'media_assets',
  'messages',
  'mood_checkins',
  'recommendation_items',
  'recommendation_runs',
  'safety_alerts',
  'user_consents',
  'user_preferences',
  'users',
  'weekly_emotion_summary'
].sort();

export const USER_DATA_TABLES = APPLICATION_TABLES.filter((table) => !STATIC_TABLES.has(table));

export const CLEANUP_ORDER = [
  'activity_feedback',
  'recommendation_items',
  'messages',
  'activity_sessions',
  'recommendation_runs',
  'emergency_contacts',
  'safety_alerts',
  'emotion_analysis',
  'emotion_flow_segments',
  'daily_emotion_summary',
  'weekly_emotion_summary',
  'master_user_activity',
  'alert_logs',
  'user_preferences',
  'user_consents',
  'mood_checkins',
  'journal_entries',
  'auth_identities',
  'chat_sessions',
  'users'
];

export const validateDevelopmentIdentity = ({ reported, configuredEndpoint, expectedBranch }) => {
  const problems = [];
  if (!reported || typeof reported !== 'object') return ['database identity is missing'];
  if (reported.project !== DEVELOPMENT.project) problems.push('project is not the approved development project');
  if (reported.branch !== DEVELOPMENT.branch) problems.push('server-reported branch is not Development');
  if (reported.endpoint !== DEVELOPMENT.endpoint) problems.push('server-reported endpoint is not Development');
  if (configuredEndpoint !== DEVELOPMENT.endpoint) problems.push('configured endpoint is not Development');
  if (expectedBranch !== DEVELOPMENT.branch) problems.push('EXPECTED_NEON_BRANCH_ID is not Development');
  return problems;
};

export const validateFreshInventory = ({
  tableNames,
  counts,
  migrations,
  expectedMigrations,
  pendingTablePresent,
  writers = 0
}) => {
  const problems = [];
  const expectedTables = new Set([PRISMA_MIGRATIONS_TABLE, ...APPLICATION_TABLES]);
  const unknownTables = tableNames.filter((name) => !expectedTables.has(name) && name !== PENDING_TABLE);
  if (unknownTables.length) problems.push(`unknown public tables: ${unknownTables.join(', ')}`);
  if (pendingTablePresent) problems.push(`${PENDING_TABLE} is already present`);
  if (JSON.stringify(migrations) !== JSON.stringify(expectedMigrations)) {
    problems.push('Prisma migration history does not match the approved pre-migration history');
  }
  if (writers !== 0) problems.push(`${writers} active or stale writer transaction(s) detected`);
  for (const table of USER_DATA_TABLES) {
    if (Number(counts[table] ?? -1) !== 0) problems.push(`${table} is not empty`);
  }
  return problems;
};

export const buildCleanupPlan = () => CLEANUP_ORDER.map((table) => ({
  table,
  statement: `DELETE FROM "${table}";`
}));

export const cleanupPlanIsSafe = (plan) =>
  Array.isArray(plan) &&
  plan.length === CLEANUP_ORDER.length &&
  plan.every((entry, index) => entry.table === CLEANUP_ORDER[index] && entry.statement === `DELETE FROM "${entry.table}";`) &&
  !plan.some((entry) => [PRISMA_MIGRATIONS_TABLE, ...STATIC_TABLES, PENDING_TABLE].includes(entry.table));
