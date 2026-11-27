import { createGmailEmail } from './gmailEmail.js';
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function createResendEmail({ apiKey, from, fetchImpl = fetch, timeoutMs = 10000 }) {
  // Construction does not contact the provider or block server startup.
  const fail = (message, reasonCode) => Object.assign(new Error(message), { reasonCode });
  return {
    provider: 'resend',
    configured: () => Boolean(apiKey && from),
    // Resend uses a static API key (no OAuth refresh), so the check is configuration-only.
    async checkAuth() { if (!apiKey || !from) throw fail('Email provider not configured', 'EMAIL_NOT_CONFIGURED'); return { ok: true }; },
    async send({ to, subject, text }) {
      if (!apiKey || !from) throw fail('Email provider not configured', 'EMAIL_NOT_CONFIGURED');
      if (typeof to !== 'string' || typeof subject !== 'string' || typeof text !== 'string') throw fail('Invalid email', 'EMAIL_REJECTED');
      let response;
      try {
        response = await fetchImpl('https://api.resend.com/emails', {
          method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from, to: [to], subject, text, html: `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>` }),
          signal: AbortSignal.timeout(timeoutMs)
        });
      } catch (error) { throw fail('Email provider request failed', error?.name === 'TimeoutError' ? 'EMAIL_TIMEOUT' : 'EMAIL_NETWORK_ERROR'); }
      if (!response.ok) throw fail('Email provider request failed', response.status === 401 || response.status === 403 ? 'EMAIL_AUTH_INVALID' : response.status === 429 ? 'EMAIL_RATE_LIMITED' : 'EMAIL_REJECTED');
      return { accepted: true };
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
  const notConfigured=()=>Object.assign(new Error('Email provider not configured'),{reasonCode:'EMAIL_NOT_CONFIGURED'});
  return {provider:'none',configured:()=>false,checkAuth:async()=>{throw notConfigured()},send:async()=>{throw notConfigured()}};
}
