const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function createResendEmail({ apiKey, from, fetchImpl = fetch, timeoutMs = 10000 }) {
  // Construction does not contact the provider or block server startup.
  return {
    async send({ to, subject, text }) {
      if (!apiKey || !from) throw new Error('Email provider not configured');
      if (typeof to !== 'string' || typeof subject !== 'string' || typeof text !== 'string') throw new Error('Invalid email');
      try {
        const response = await fetchImpl('https://api.resend.com/emails', {
          method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from, to: [to], subject, text, html: `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>` }),
          signal: AbortSignal.timeout(timeoutMs)
        });
        if (!response.ok) throw new Error('provider rejected request');
        return { accepted: true };
      } catch { throw new Error('Email provider request failed'); }
    }
  };
}

export function createFakeEmail() {
  const messages = [];
  return { messages, async send(message) { messages.push(structuredClone(message)); return { accepted: true }; } };
}
