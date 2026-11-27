// Privacy logger: every line is JSON containing ONLY allowlisted, non-personal fields.
// Anything else passed in (strings, messages, bodies, emails, stacks) is dropped.
const allowedNames = new Set(['Error', 'TypeError', 'RangeError', 'SyntaxError', 'PrismaClientKnownRequestError', 'PrismaClientInitializationError', 'AbortError']);
const allowedProviders = new Set(['gemini', 'groq', 'google', 'sarvam', 'murf', 'resend', 'huggingface']);
const allowedCodes = new Set([
  'UNAUTHENTICATED', 'RATE_LIMITED', 'VALIDATION_FAILED', 'EXPORT_TOO_LARGE', 'P1001', 'P1008', 'P2002', 'P2024', 'P2028',
  // POST /api/auth/register validation codes (contracts/auth-register.json)
  'PASSWORD_TOO_SHORT', 'PASSWORD_TOO_LONG', 'NAME_TOO_LONG', 'ADULT_CONFIRMATION_REQUIRED', 'INVALID_EMAIL',
  // Email delivery outcomes (auth OTP mail)
  'EMAIL_NOT_CONFIGURED', 'EMAIL_AUTH_INVALID', 'EMAIL_AUTH_UNAVAILABLE', 'EMAIL_REJECTED', 'EMAIL_RATE_LIMITED', 'EMAIL_TIMEOUT', 'EMAIL_NETWORK_ERROR', 'EMAIL_DELIVERY_FAILED'
]);
const allowedProviderCodes = new Set(['tls_certificate_error','provider_network_error','rate_limit_exceeded','invalid_api_key','invalid_request_error','model_decommissioned','model_not_found','insufficient_quota','authentication_error','permission_error','server_error','rate_limit_error']);
// Non-PII events. Phase 2C-6 data export uses the 'data export ...' events.
const allowedEvents = new Set([
  'gmail refresh token invalid', 'email configuration incomplete',
  'data export completed', 'data export denied', 'data export too large', 'data export rate limited', 'data export failed',
  'http request', 'auth register rejected', 'auth password minimum mismatch', 'auth email sent', 'auth email delivery failed',
  'email provider check', 'emergency alert delivery failed'
]);
const allowedMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']);
const allowedTriggers = new Set(['startup', 'endpoint']);

/**
 * A route is logged only as a *template* (e.g. /api/me/journals/:id). Reject
 * anything that could carry personal data: '@', query strings, or segments that
 * look like ids (UUIDs, long hex/digit runs).
 */
export function safeRoute(route) {
  if (typeof route !== 'string' || route.length > 150 || !/^\/[A-Za-z0-9_\-/:.]*$/.test(route) || route.includes('@')) return null;
  const idLike = s => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s) || /^[0-9a-f]{16,}$/i.test(s) || /^\d{4,}$/.test(s);
  return route.split('/').some(idLike) ? null : route;
}

function fields(args) {
  const out = {};
  for (const value of args) {
    if (!value || typeof value !== 'object') continue;
    if (allowedEvents.has(value.event)) out.event = value.event;
    if (allowedMethods.has(value.method)) out.method = value.method;
    if (typeof value.ok === 'boolean') out.ok = value.ok;
    if (allowedTriggers.has(value.trigger)) out.trigger = value.trigger;
    const route = safeRoute(value.route);
    if (route) out.route = route;
    const status = value.status ?? value.statusCode ?? value.response?.status;
    if (Number.isInteger(status) && status >= 100 && status <= 599) out.status = status;
    if (allowedCodes.has(value.code)) out.code = value.code;
    if (Number.isInteger(value.durationMs) && value.durationMs >= 0 && value.durationMs <= 3600000) out.durationMs = value.durationMs;
    if (typeof value.requestId === 'string' && /^[0-9a-f-]{36}$/i.test(value.requestId)) out.requestId = value.requestId;
    if (allowedNames.has(value.name)) out.errorName = value.name;
    if (allowedProviders.has(value.provider)) out.provider = value.provider;
    for (const key of ['providerErrorCode', 'providerErrorType']) if (allowedProviderCodes.has(value[key])) out[key] = value[key];
  }
  return out;
}
const emit = (level, args) => console[level === 'error' ? 'error' : 'log'](JSON.stringify({ level, ...fields(args) }));
export const safeError = (...args) => emit('error', args);
const logger = {
  log: (...args) => emit('info', args), info: (...args) => emit('info', args),
  warn: (...args) => emit('warn', args), error: (...args) => safeError(...args),
  debug: (...args) => emit('debug', args), writeToFile: () => {}
};
export default logger;
