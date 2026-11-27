/**
 * Registration contract between the website and the backend.
 * Pure (no imports) so the Next route, the browser and the tests share it.
 * The backend side of the same contract is pinned by contracts/auth-register.json;
 * frontend/tests/registerContract.test.mjs and backend/tests/registerContract.unit.test.js
 * both check against that file.
 */

/** Body the signup form posts to the Next route. */
export type SignupForm = { email: unknown; password: unknown; fullName: unknown; isAdult: unknown };

/**
 * Body forwarded to the backend: exactly these four keys, built explicitly so no
 * extra client field ever reaches the backend (safe across Vercel/Render version skew).
 */
export function backendRegisterBody(form: Partial<SignupForm>) {
  return { email: form.email, password: form.password, name: form.fullName, isAdult: form.isAdult };
}

// Validation codes the backend may return for POST /api/auth/register (status 400).
// None of them depends on whether an account exists; "already registered" still gets
// the generic 202 acknowledgement, so these are not an enumeration signal.
export const REGISTER_ERROR_MESSAGES = {
  PASSWORD_TOO_SHORT: 'Password must be at least 12 characters long.',
  PASSWORD_TOO_LONG: 'Password is too long (maximum 72 bytes, about 72 basic characters).',
  NAME_TOO_LONG: 'Name must be 100 characters or fewer.',
  ADULT_CONFIRMATION_REQUIRED: 'Please confirm that you are 18 or older.',
  INVALID_EMAIL: 'Please enter a valid email address.'
} as const;
export type RegisterErrorCode = keyof typeof REGISTER_ERROR_MESSAGES;

export const isRegisterErrorCode = (code: unknown): code is RegisterErrorCode =>
  typeof code === 'string' && Object.prototype.hasOwnProperty.call(REGISTER_ERROR_MESSAGES, code);

/** User-facing message for a failed register response. Unknown codes fall back to a generic message. */
export function registerErrorMessage(status: number, code?: unknown): string {
  if (status === 429) return 'Too many attempts. Please wait a few minutes and try again.';
  if (status >= 500) return 'Service unavailable. Please try again.';
  if (isRegisterErrorCode(code)) return REGISTER_ERROR_MESSAGES[code];
  return 'Unable to process the request. Check your details and try again.';
}
