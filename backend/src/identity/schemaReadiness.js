/**
 * Schema readiness probe: the Firebase exchange refuses to run (503) unless the Phase 2B.2
 * identity migration is present in the connected database. This is what makes it impossible
 * to "turn the endpoint on" in an environment (for example production) that has not been
 * migrated yet, independently of the FIREBASE_EXCHANGE_ENABLED flag.
 *
 * Read-only: a single catalog query. A positive result is cached for the process lifetime;
 * a negative result is re-checked after 30 seconds.
 */

const CHECK_SQL = `
select
  to_regclass('public.auth_identities')::text as identities_table,
  (select count(*)::int from information_schema.columns
     where table_schema = 'public' and table_name = 'users' and column_name = 'email_verified_at') as has_verified_col,
  (select is_nullable from information_schema.columns
     where table_schema = 'public' and table_name = 'users' and column_name = 'password_hash') as hash_nullable,
  (select count(*)::int from pg_indexes
     where schemaname = 'public' and indexname = 'users_email_lower_key') as has_lower_index,
  (select count(*)::int from pg_indexes
     where schemaname = 'public' and indexname = 'auth_identities_provider_project_sub_key') as has_identity_unique
`;

export const createSchemaReadiness = (prisma, { failTtlMs = 30000, now = () => Date.now() } = {}) => {
  let ready = false;
  let lastFailAt = -Infinity;
  return async () => {
    if (ready) return true;
    if (now() - lastFailAt < failTtlMs) return false;
    try {
      const [r] = await prisma.$queryRawUnsafe(CHECK_SQL);
      ready = r.identities_table === 'auth_identities' && r.has_verified_col === 1 && r.hash_nullable === 'YES'
        && r.has_lower_index === 1 && r.has_identity_unique === 1;
    } catch {
      ready = false;
    }
    if (!ready) lastFailAt = now();
    return ready;
  };
};

/**
 * Account-linking readiness (Phase 2B.5B.1 migration): the link routes refuse to run (503) unless the identity schema
 * above AND auth_link_challenges with its digest uniqueness, 5-minute lifetime CHECK and consumption-window CHECK are
 * present, and auth_identities accepts link_method 'password_proof'. Same caching rules, read-only catalog query.
 */
const LINK_CHECK_SQL = `
select
  to_regclass('public.auth_link_challenges')::text as challenges_table,
  (select count(*)::int from pg_indexes
     where schemaname = 'public' and indexname = 'auth_link_challenges_challenge_hash_key') as has_digest_unique,
  (select count(*)::int from pg_constraint
     where conname in ('auth_link_challenges_lifetime', 'auth_link_challenges_consumed_in_window',
                       'auth_link_challenges_challenge_hash_format', 'auth_link_challenges_purpose_allowed')
       and conrelid = to_regclass('public.auth_link_challenges')) as has_checks,
  (select count(*)::int from pg_constraint
     where conname = 'auth_identities_link_method_allowed'
       and pg_get_constraintdef(oid) like '%password_proof%') as allows_password_proof
`;

export const createLinkSchemaReadiness = (prisma, { failTtlMs = 30000, now = () => Date.now() } = {}) => {
  const identityReady = createSchemaReadiness(prisma, { failTtlMs, now });
  let ready = false;
  let lastFailAt = -Infinity;
  return async () => {
    if (ready) return true;
    if (now() - lastFailAt < failTtlMs) return false;
    try {
      if (await identityReady()) {
        const [r] = await prisma.$queryRawUnsafe(LINK_CHECK_SQL);
        ready = r.challenges_table === 'auth_link_challenges' && r.has_digest_unique === 1 && r.has_checks === 4
          && r.allows_password_proof === 1;
      }
    } catch {
      ready = false;
    }
    if (!ready) lastFailAt = now();
    return ready;
  };
};
