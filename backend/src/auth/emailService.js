import { createGmailEmail } from './gmailEmail.js';
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function createResendEmail({ apiKey, from, fetchImpl = fetch, timeoutMs = 10000 }) {
  // Construction does not contact the provider or block server startup.
  return {
    configured: () => Boolean(apiKey && from),
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

/** Adapter construction is non-blocking; no provider calls happen at startup. */
export function createEmailAdapter({ env = process.env, fetchImpl = fetch } = {}) {
  const provider = (env.EMAIL_PROVIDER || (String(env.NODE_ENV || '').trim().toLowerCase() === 'production' ? 'gmail' : 'resend')).trim().toLowerCase();
  if (provider === 'gmail') return createGmailEmail({clientId:env.GMAIL_CLIENT_ID,clientSecret:env.GMAIL_CLIENT_SECRET,refreshToken:env.GMAIL_REFRESH_TOKEN,sender:env.GMAIL_SENDER,fromName:env.EMAIL_FROM_NAME || 'MindHaven',fetchImpl});
  if (provider === 'resend') return createResendEmail({apiKey:env.RESEND_API_KEY,from:env.RESEND_FROM,fetchImpl});
  return {configured:()=>false,send:async()=>{throw new Error('Email provider not configured')}};
}
