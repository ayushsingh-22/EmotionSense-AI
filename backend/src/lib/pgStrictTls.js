// Build node-postgres options with TLS certificate *and* hostname verification
// pinned in code (equivalent to libpq sslmode=verify-full).
//
// Why: pg 8 treats sslmode=require/prefer/verify-ca as verify-full, but pg 9 /
// pg-connection-string 3 will switch to libpq semantics (require = encrypt
// without verifying). pg also lets the *parsed connection string override* an
// explicit `ssl` option, so we remove every ssl* query parameter from the URL
// and set `ssl` ourselves. The .env URLs and Prisma are untouched.
const TLS_PARAM = /^(ssl.*|uselibpqcompat)$/i;

export function strictPgConfig(connectionString, extra = {}) {
  let url;
  try { url = new URL(connectionString); } catch { throw new Error('Invalid database URL'); }
  if (!/^postgres(ql)?:$/.test(url.protocol)) throw new Error('Invalid database URL');
  for (const key of [...url.searchParams.keys()]) if (TLS_PARAM.test(key)) url.searchParams.delete(key);
  return { ...extra, connectionString: url.toString(), ssl: { rejectUnauthorized: true, servername: url.hostname } };
}
