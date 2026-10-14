/**
 * Log redaction: keeps useful diagnostics (messages, stacks, request context) in
 * server logs while stripping secrets before they are written.
 *
 * Two layers:
 *  1. VALUE-based: every environment variable whose NAME looks secret
 *     (KEY / SECRET / PASSWORD / TOKEN / DATABASE_URL / ...) contributes its
 *     actual value to a deny-list; any occurrence in a log line becomes [REDACTED].
 *     This catches secrets that appear inside third-party error objects (for example
 *     an axios error that dumps request headers), whatever their format.
 *  2. PATTERN-based: connection strings, Bearer tokens, Authorization headers,
 *     ?key= / ?token= query parameters, JWTs and common provider key prefixes.
 */
import util from 'node:util';

const SECRET_NAME = /(KEY|SECRET|PASSWORD|PASSWD|TOKEN|DATABASE_URL|DIRECT_URL|CONNECTION_STRING|PRIVATE|CREDENTIAL)/i;
const MIN_SECRET_LENGTH = 8;

const PATTERNS = [
  [/postgres(?:ql)?:\/\/[^\s'"`<>)]+/gi, 'postgresql://[REDACTED]'],
  [/(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi, '$1[REDACTED]'],
  [/(authorization["']?\s*[:=]\s*["']?)(?!Bearer\s)[^\s"',}]+/gi, '$1[REDACTED]'],
  [/([?&](?:key|api_key|apikey|token|access_token|secret)=)[^&\s"']+/gi, '$1[REDACTED]'],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[REDACTED_JWT]'],
  [/\bAIza[0-9A-Za-z_-]{30,}\b/g, '[REDACTED]'],
  [/\bgsk_[A-Za-z0-9]{20,}\b/g, '[REDACTED]'],
  [/\bsk-[A-Za-z0-9_-]{20,}\b/g, '[REDACTED]'],
  [/\bhf_[A-Za-z0-9]{20,}\b/g, '[REDACTED]'],
  [/\bnpg_[A-Za-z0-9]{8,}\b/g, '[REDACTED]']
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Secret VALUES currently configured in the environment (longest first). */
export const collectSecretValues = (env = process.env) => {
  const values = new Set();
  for (const [name, value] of Object.entries(env)) {
    if (typeof value === 'string' && value.length >= MIN_SECRET_LENGTH && SECRET_NAME.test(name)) values.add(value);
  }
  return [...values].sort((a, b) => b.length - a.length);
};

let secretRegex = null;
const buildSecretRegex = (values) => (values.length ? new RegExp(values.map(escapeRe).join('|'), 'g') : null);

export const refreshSecrets = (env = process.env) => {
  secretRegex = buildSecretRegex(collectSecretValues(env));
};

export const redact = (text) => {
  if (typeof text !== 'string' || text.length === 0) return text;
  let out = text;
  if (secretRegex) out = out.replace(secretRegex, '[REDACTED]');
  for (const [re, replacement] of PATTERNS) out = out.replace(re, replacement);
  return out;
};

const toLoggable = (arg) => {
  if (typeof arg === 'string') return redact(arg);
  if (arg instanceof Error || (arg && typeof arg === 'object')) {
    return redact(util.inspect(arg, { depth: 4, breakLength: 140 }));
  }
  return arg;
};

let installed = false;
/** Idempotently wraps console.log/info/warn/error so every line passes through redact(). */
export const installLogRedaction = () => {
  if (installed) return;
  installed = true;
  refreshSecrets();
  for (const method of ['log', 'info', 'warn', 'error']) {
    const original = console[method].bind(console);
    console[method] = (...args) => original(...args.map(toLoggable));
  }
};

refreshSecrets();
