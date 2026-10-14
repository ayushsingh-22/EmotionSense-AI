/**
 * Safe public error messages.
 *
 * Internal errors (Prisma, provider SDKs, filesystem, bugs) must never reach API
 * clients: their messages disclose table/column names, hostnames, file paths and
 * sometimes request payloads. Handlers keep logging the full error server-side
 * (console is redacted, see logRedaction.js) and answer with a generic message
 * plus the request id so support can correlate the two.
 *
 * Only messages that are deliberate, user-actionable validation text are allowed
 * through, via the allow-list below.
 */

const SAFE_MESSAGE_PATTERNS = [
  /^[A-Za-z_]+(?:, [A-Za-z_]+)*(?:,? and [A-Za-z_]+)? (?:is|are) required$/, // "user_id and session_id are required"
  /^Invalid (?:activity_type|role|source|period)\b[^\n]{0,200}$/, // enum validation, lists allowed values only
  /^Session not found$/,
  /^Activity not found$/,
  /^No updatable fields provided$/,
  /^No chat messages\b[^\n]{0,160}$/i
];

export const isSafePublicMessage = (message) =>
  typeof message === 'string' && message.length <= 300 && SAFE_MESSAGE_PATTERNS.some((re) => re.test(message));

/** error.message if it is an approved user-facing message, otherwise the fallback. */
export const safePublicMessage = (error, fallback = 'Internal server error') => {
  if (error && error.expose === true && typeof error.message === 'string') return error.message;
  return isSafePublicMessage(error?.message) ? error.message : fallback;
};
