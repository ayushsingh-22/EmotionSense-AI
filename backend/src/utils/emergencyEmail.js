import { createResendEmail } from '../auth/emailService.js';

const escapeHtml = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function emergencyAlertText(user, when = new Date()) {
  const firstName = String(user?.full_name || user?.fullName || '').trim().split(/\s+/)[0].replace(/[\r\n]/g, '');
  const name = firstName || 'someone you know';
  const reason = firstName ? `${name} chose you` : 'they chose you';
  const time = new Intl.DateTimeFormat('en-IN', {timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}).format(when);
  return `MindHaven noticed signs that ${name} may be struggling on ${time} IST.\n\nPlease consider checking in with them.\n\nFor mental health support in India, contact Tele-MANAS at 14416 or 1-800-891-4416. For emergencies, call 112.\n\nYou received this message because ${reason} as an emergency contact in MindHaven.`;
}

export function emergencyAlertHtml(user, when = new Date()) {
  return `<p>${escapeHtml(emergencyAlertText(user, when)).replace(/\n/g, '<br>')}</p>`;
}

export function createEmergencySender({ email, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), timeoutMs = 10000 } = {}) {
  if (!email) throw new Error('Email adapter required');
  return async (user, contact) => {
    const to=contact?.contact_email || contact?.email;
    if (!to) return false;
    const text=emergencyAlertText(user);
    for (let attempt=0;attempt<3;attempt++) {
      let timer;
      try {
        const result=await Promise.race([email.send({to,subject:'MindHaven check-in',text}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('timeout')),timeoutMs);timer.unref?.()})]);
        if (result?.accepted === true) return true;
      } catch { /* Retry without recording provider details. */ }
      finally { clearTimeout(timer); }
      if (attempt<2) await sleep(250 * 2 ** attempt);
    }
    console.error('Emergency alert delivery failed');
    return false;
  };
}

export async function sendEmergencyAlert(user, contact) {
  return createEmergencySender({email:createResendEmail({apiKey:process.env.RESEND_API_KEY,from:process.env.RESEND_FROM})})(user,contact);
}
