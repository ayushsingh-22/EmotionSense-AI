// Phase 2C-6: "Download my data". Dependencies are injected so this module has
// no imports and can be unit-tested without the browser or the axios client.
// Uses fetch rather than the shared axios instance on purpose: axios retries a
// 401 once with a fresh token, which would resend the password and count twice
// against the server's failed-attempt limit.

export type ExportPhase = 'idle' | 'verifying' | 'saving' | 'done' | 'error';
export type ExportDeps = {
  baseUrl: string;
  authHeaders: () => Promise<Record<string, string>>;
  fetchImpl: typeof fetch;
  save: (blob: Blob, filename: string) => void;
  now?: () => Date;
  onPhase?: (phase: ExportPhase) => void;
};

export const EXPORT_SUMMARY =
  'Your file includes your profile, preferences, consent history, mood check-ins, journals (yours and generated), chats, emotion analyses and activity log, activities and feedback, recommendations, sign-in history, emergency contact and alert history, but never your password or sign-in tokens.';

/** Local calendar date, so the name matches the day the user downloaded it. */
export function exportFilename(date: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `mindhaven-export-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.json`;
}

export class ExportError extends Error {
  constructor(message: string, readonly status?: number) { super(message); this.name = 'ExportError'; }
}

export function exportErrorMessage(status: number | undefined, body?: { error?: { message?: string } | string }): string {
  if (status === 401) return 'That password did not match, or your session has ended. Check your password and try again.';
  if (status === 429) return 'You have reached the export limit (3 per day). Please try again tomorrow.';
  if (status === 413) return typeof body?.error === 'object' && body.error?.message ? body.error.message : 'Your data is too large to export as one file. Please contact support.';
  if (status === 400) return 'The request was not accepted. Please reload the page and try again.';
  if (status === 503) return 'The service is waking up. Please try again in a moment.';
  if (status === undefined) return 'Could not reach the server. Check your connection and try again.';
  return 'Something went wrong. Please try again.';
}

export async function downloadMyData(password: string, deps: ExportDeps): Promise<string> {
  const phase = (p: ExportPhase) => deps.onPhase?.(p);
  phase('verifying');
  let response: Response;
  try {
    response = await deps.fetchImpl(`${deps.baseUrl.replace(/\/$/, '')}/api/me/export`, {
      method: 'POST',
      headers: { ...(await deps.authHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
      cache: 'no-store',
      credentials: 'omit'
    });
  } catch {
    phase('error');
    throw new ExportError(exportErrorMessage(undefined));
  }
  if (!response.ok) {
    let body: { error?: { message?: string } | string } | undefined;
    try { body = await response.json(); } catch { body = undefined; }
    phase('error');
    throw new ExportError(exportErrorMessage(response.status, body), response.status);
  }
  phase('saving');
  const blob = await response.blob();
  const filename = exportFilename(deps.now?.() ?? new Date());
  deps.save(new Blob([blob], { type: 'application/json' }), filename);
  phase('done');
  return filename;
}

/** Browser save via a temporary object URL (revoked right after the click). */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
