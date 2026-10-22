/**
 * Firebase ID-token verification (server side only).
 *
 * Security design
 *  - Verification is done by the Firebase Admin SDK (signature against Google's
 *    rotating keys, exp/iat, issuer `https://securetoken.google.com/<project>`,
 *    audience == project id, non-empty `sub`). On top of that this module PINS the
 *    expected project id (FIREBASE_PROJECT_ID): the decoded `aud` and `iss` must match it
 *    again, so a token minted for ANY other Firebase project is refused even if the
 *    SDK were initialised with different credentials.
 *  - Revocation policy: every exchange calls verifyIdToken(token, checkRevoked = true).
 *    That makes Firebase reject tokens issued before a revokeRefreshTokens() call and
 *    tokens of DISABLED or DELETED users. Cost: one extra Firebase round trip per
 *    exchange. This is acceptable because an exchange only happens when a client needs a
 *    new 5-minute API token (about once per 5 minutes per active user). The minted API
 *    token itself is not revocable: worst case a revoked user keeps API access for the
 *    remaining <= 5 minutes.
 *  - The Firebase UID is taken ONLY from the verified token, never from the client.
 *  - Credentials come from environment variables (names only in docs; never committed).
 *    Configuration problems fail closed with an error that names variables, never values.
 *  - The Admin app is created once per process (named app, so it never collides with a
 *    default app created elsewhere).
 */
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export const FIREBASE_APP_NAME = 'mantra-identity';
export const ISSUER_PREFIX = 'https://securetoken.google.com/';

/** Sign-in methods accepted for provisioning/login. Anonymous, phone, custom tokens etc. are refused. */
export const ALLOWED_SIGN_IN_PROVIDERS = new Set(['google.com', 'password']);

const VERIFY_TIMEOUT_MS = 8000;
const PROJECT_ID_RE = /^[a-z][a-z0-9-]{3,29}$/;
const UID_RE = /^[\x21-\x7e]{1,128}$/;
const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/;

/** The token is not acceptable (bad, expired, revoked, disabled, deleted, wrong project...). */
export class TokenRejected extends Error {
  constructor(reason) { super('Firebase token rejected'); this.name = 'TokenRejected'; this.reason = reason; }
}
/** We could not decide (Firebase unreachable, misconfiguration, SDK failure). Never a client fault. */
export class VerifierUnavailable extends Error {
  constructor(reason) { super('Firebase verification unavailable'); this.name = 'VerifierUnavailable'; this.reason = reason; }
}

/** Firebase error codes that mean "this token/user is not valid". Anything else is an outage. */
const REJECT_CODES = new Set([
  'auth/argument-error', 'auth/invalid-id-token', 'auth/id-token-expired', 'auth/id-token-revoked',
  'auth/user-disabled', 'auth/user-not-found', 'auth/invalid-credential', 'auth/invalid-user-token',
  'auth/user-token-expired'
]);

/* ------------------------------ configuration ------------------------------ */

export const isExchangeEnabled = (env = process.env) => env.FIREBASE_EXCHANGE_ENABLED === 'true';

/**
 * Reads and validates configuration. Accepted credential forms (first match wins):
 *   FIREBASE_SERVICE_ACCOUNT_JSON_BASE64  (base64 of the service-account JSON)
 *   FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 * FIREBASE_PROJECT_ID is always required and is the pinned project.
 */
export const readFirebaseConfig = (env = process.env) => {
  const projectId = (env.FIREBASE_PROJECT_ID || '').trim();
  if (!projectId) throw new VerifierUnavailable('FIREBASE_PROJECT_ID is not configured');
  if (!PROJECT_ID_RE.test(projectId)) throw new VerifierUnavailable('FIREBASE_PROJECT_ID is malformed');

  let clientEmail; let privateKey;
  const b64 = (env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 || '').trim();
  if (b64) {
    let sa;
    try { sa = JSON.parse(Buffer.from(b64, 'base64').toString('utf8')); } catch { throw new VerifierUnavailable('FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 is not valid base64 JSON'); }
    if (sa?.project_id && sa.project_id !== projectId) throw new VerifierUnavailable('service account project does not match FIREBASE_PROJECT_ID');
    clientEmail = sa?.client_email; privateKey = sa?.private_key;
  } else {
    clientEmail = (env.FIREBASE_CLIENT_EMAIL || '').trim();
    privateKey = env.FIREBASE_PRIVATE_KEY;
  }
  if (typeof privateKey === 'string') privateKey = privateKey.replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) throw new VerifierUnavailable('Firebase Admin credentials are not configured (FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY)');
  if (!/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(privateKey)) throw new VerifierUnavailable('FIREBASE_PRIVATE_KEY is not a PEM private key');
  return { projectId, clientEmail, privateKey };
};

let cached = null; // { projectId, auth }

/** Initialises the Admin SDK exactly once per process and returns { projectId, auth }. */
export const getFirebaseAuth = (env = process.env) => {
  if (cached) return cached;
  const { projectId, clientEmail, privateKey } = readFirebaseConfig(env);
  let app = getApps().find((a) => a.name === FIREBASE_APP_NAME);
  if (!app) {
    try {
      app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }, FIREBASE_APP_NAME);
    } catch {
      // Never forward the SDK message: it can quote credential fields.
      throw new VerifierUnavailable('Firebase Admin initialisation failed');
    }
  }
  cached = { projectId, auth: getAuth(app) };
  return cached;
};

/** Boot-time check for deployments that enable the exchange route. Throws when unusable. */
export const assertFirebaseConfigured = (env = process.env) => { getFirebaseAuth(env); };

/** Test helper only: forget the cached app reference (the SDK app itself is not deleted). */
export const _resetFirebaseCacheForTests = () => { cached = null; };

/* ------------------------------- verification ------------------------------ */

const withTimeout = (promise, ms) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new VerifierUnavailable('timeout')), ms);
  promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
});

/**
 * Builds a verifier bound to an Admin `auth` object and a pinned project id.
 * Returns async (idToken) => claims, or throws TokenRejected / VerifierUnavailable.
 */
export const createFirebaseVerifier = ({ auth, projectId }) => {
  if (!auth || typeof auth.verifyIdToken !== 'function' || !projectId) throw new VerifierUnavailable('verifier misconfigured');
  return async (idToken) => {
    if (typeof idToken !== 'string' || idToken.length < 20 || idToken.length > 4096 || !JWT_SHAPE.test(idToken)) {
      throw new TokenRejected('malformed');
    }
    let decoded;
    try {
      decoded = await withTimeout(auth.verifyIdToken(idToken, true), VERIFY_TIMEOUT_MS);
    } catch (error) {
      if (error instanceof VerifierUnavailable) throw error;
      const code = typeof error?.code === 'string' ? error.code : 'unknown';
      if (REJECT_CODES.has(code)) throw new TokenRejected(code);
      throw new VerifierUnavailable(code);
    }

    // Defence in depth: pin the project even if the SDK was configured differently.
    if (decoded?.aud !== projectId || decoded?.iss !== `${ISSUER_PREFIX}${projectId}`) throw new TokenRejected('wrong-project');
    const uid = decoded.uid ?? decoded.sub;
    if (typeof uid !== 'string' || !UID_RE.test(uid) || (decoded.sub && decoded.sub !== uid)) throw new TokenRejected('bad-subject');

    const firebase = decoded.firebase && typeof decoded.firebase === 'object' ? decoded.firebase : {};
    return {
      uid,
      projectId,
      email: typeof decoded.email === 'string' ? decoded.email : null,
      emailVerified: decoded.email_verified === true,
      signInProvider: typeof firebase.sign_in_provider === 'string' ? firebase.sign_in_provider : null,
      // Seconds since epoch of the user's last real sign-in (not of this token). Used for link freshness.
      authTime: Number.isSafeInteger(decoded.auth_time) ? decoded.auth_time : null,
      name: typeof decoded.name === 'string' ? decoded.name : null,
      picture: typeof decoded.picture === 'string' ? decoded.picture : null
    };
  };
};

let defaultVerifier = null;
/** Verifier using the process-wide Admin app. Throws VerifierUnavailable when not configured. */
export const verifyFirebaseIdToken = async (idToken) => {
  if (!defaultVerifier) {
    const { auth, projectId } = getFirebaseAuth();
    defaultVerifier = createFirebaseVerifier({ auth, projectId });
  }
  return defaultVerifier(idToken);
};
export const getPinnedProjectId = () => getFirebaseAuth().projectId;
