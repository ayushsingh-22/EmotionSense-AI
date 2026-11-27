'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { api, authHeaders } from '@/lib/api';
import { EXPORT_SUMMARY, ExportError, downloadMyData, saveBlob, type ExportPhase } from '@/lib/dataExport';

const field = 'w-full rounded-md border bg-background p-2';
const progressText: Record<ExportPhase, string> = {
  idle: '',
  verifying: 'Checking your password and preparing your file…',
  saving: 'Saving your file…',
  done: '',
  error: ''
};

export function DataExportSettings() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [phase, setPhase] = useState<ExportPhase>('idle');
  const [message, setMessage] = useState('');
  const busy = phase === 'verifying' || phase === 'saving';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !password) return;
    setMessage('');
    try {
      const filename = await downloadMyData(password, {
        baseUrl: String(api.defaults.baseURL ?? ''),
        authHeaders,
        fetchImpl: (...args) => fetch(...args),
        save: saveBlob,
        onPhase: setPhase
      });
      setMessage(`Downloaded ${filename}.`);
      setOpen(false);
    } catch (err) {
      setPhase('error');
      setMessage(err instanceof ExportError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setPassword('');
    }
  }

  return (
    <section className="space-y-4 rounded-xl border p-6" aria-labelledby="data-export-heading">
      <h2 id="data-export-heading" className="text-xl font-semibold">Download my data</h2>
      <p className="text-sm text-muted-foreground">{EXPORT_SUMMARY}</p>
      {!open ? (
        <Button type="button" onClick={() => { setOpen(true); setMessage(''); setPhase('idle'); }}>Download my data</Button>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            Confirm your password
            <input className={field} type="password" autoComplete="current-password" required value={password} disabled={busy} onChange={e => setPassword(e.target.value)} />
          </label>
          <p className="text-xs text-muted-foreground">You can download up to 3 copies a day. The file is saved as JSON on this device; keep it somewhere safe.</p>
          <div className="flex gap-3">
            <Button type="submit" disabled={busy || !password}>{busy ? 'Preparing…' : 'Download'}</Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => { setOpen(false); setPassword(''); setPhase('idle'); }}>Cancel</Button>
          </div>
        </form>
      )}
      {busy && (
        <div role="progressbar" aria-label="Preparing your data export" aria-busy="true" className="h-2 w-full overflow-hidden rounded bg-muted">
          <div className="h-full w-1/3 animate-pulse rounded bg-primary" />
        </div>
      )}
      <p role="status" aria-live="polite" className="text-sm">{busy ? progressText[phase] : message}</p>
    </section>
  );
}
