// Email provider health: OAuth/config check only, never sends mail.
// Results carry only { ok, code }; no tokens, addresses or provider messages.
import logger from '../utils/logger.js';

export const EMAIL_HEALTH_CODES = Object.freeze(['EMAIL_NOT_CONFIGURED', 'EMAIL_AUTH_INVALID', 'EMAIL_AUTH_UNAVAILABLE', 'EMAIL_TIMEOUT', 'EMAIL_NETWORK_ERROR', 'EMAIL_DELIVERY_FAILED']);

export async function checkEmailProvider(email, { timeoutMs = 15000 } = {}) {
  if (!email || typeof email.checkAuth !== 'function') return { ok: false, code: 'EMAIL_NOT_CONFIGURED' };
  let timer;
  try {
    await Promise.race([
      email.checkAuth(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { reasonCode: 'EMAIL_TIMEOUT' })), timeoutMs); timer.unref?.(); })
    ]);
    return { ok: true };
  } catch (error) {
    return { ok: false, code: EMAIL_HEALTH_CODES.includes(error?.reasonCode) ? error.reasonCode : 'EMAIL_DELIVERY_FAILED' };
  } finally { clearTimeout(timer); }
}

/** One structured line: event "email provider check", ok, code, provider, trigger. */
export function logEmailProviderCheck(result, { provider, trigger, log = logger } = {}) {
  const line = { event: 'email provider check', ok: result.ok, provider, trigger, ...(result.ok ? {} : { code: result.code }) };
  return result.ok ? log.info(line) : log.error(line);
}
