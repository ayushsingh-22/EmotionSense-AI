const allowedNames = new Set(['Error', 'TypeError', 'RangeError', 'SyntaxError', 'PrismaClientKnownRequestError', 'PrismaClientInitializationError', 'AbortError']);
const allowedProviders = new Set(['gemini', 'groq', 'google', 'sarvam', 'murf', 'resend', 'huggingface']);
const allowedRoutes = new Set(['/api/auth/login', '/api/auth/refresh', '/api/auth/register', '/api/auth/logout', '/api/internal/journal/run', '/api/health']);
const allowedCodes = new Set(['UNAUTHENTICATED', 'RATE_LIMITED', 'VALIDATION_FAILED', 'P1001', 'P1008', 'P2002', 'P2024', 'P2028']);
function fields(args) {
  const out = {};
  for (const value of args) {
    if (!value || typeof value !== 'object') continue;
    if (allowedNames.has(value.name)) out.errorName = value.name;
    const status = value.status ?? value.statusCode ?? value.response?.status;
    if (Number.isInteger(status) && status >= 100 && status <= 599) out.status = status;
    if (allowedProviders.has(value.provider)) out.provider = value.provider;
    if (['gmail refresh token invalid','email configuration incomplete'].includes(value.event)) out.event = value.event;
    if (allowedCodes.has(value.code)) out.code = value.code;
    if (allowedRoutes.has(value.route)) out.route = value.route;
    if (typeof value.requestId === 'string' && /^[0-9a-f-]{36}$/i.test(value.requestId)) out.requestId = value.requestId;
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
