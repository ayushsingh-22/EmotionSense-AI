import prisma from '../lib/prisma.js';
import { currentConsent, lockConsent } from '../wellbeing/consents.js';
import safeLog from './logger.js';
import { createEmailAdapter } from '../auth/emailService.js';

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

export function createEmergencySender({ email, beforeAttempt = async () => true, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), timeoutMs = 10000 } = {}) {
  if (!email) throw new Error('Email adapter required');
  return async (user, contact) => {
    const to=contact?.contact_email || contact?.email;
    if (!to) return false;
    const text=emergencyAlertText(user);
    for (let attempt=0;attempt<(email.handlesRetries ? 1 : 3);attempt++) {
      let timer;
      try {
        if (!email.handlesRetries && !(await beforeAttempt())) return false;
        const result = email.handlesRetries ? await email.send({to,subject:'MindHaven check-in',text},{beforeAttempt}) : await Promise.race([email.send({to,subject:'MindHaven check-in',text}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('timeout')),timeoutMs);timer.unref?.()})]);
        if (result?.accepted === true) return true;
      } catch { /* Retry without recording provider details. */ }
      finally { clearTimeout(timer); }
      if (!email.handlesRetries && attempt<2) await sleep(250 * 2 ** attempt);
    }
    safeLog.error('Emergency alert delivery failed');
    return false;
  };
}

export function createGuardedEmergencySender({db,email,sleep}) {
  return async (user,contact) => {
    if (!user?.id) return false;
    const requested=contact?.contact_email || contact?.email;
    const allowed=async client=>{
      const stored=await client.emergencyContact.findUnique({where:{userId:user.id},select:{notifyEnabled:true,contactEmail:true}});
      const consent=await currentConsent(client,user.id,'emergency_alert_sharing');
      return !!(stored?.notifyEnabled && consent?.granted && requested && stored.contactEmail.toLowerCase()===requested.toLowerCase());
    };
    let eventId, withdrawn=false;
    try {
      eventId=await db.$transaction(async tx=>{
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`emergency-contact:${user.id}`}, 0))::text`;
        await lockConsent(tx,user.id,'emergency_alert_sharing');
        if(!await allowed(tx))return null;
        const row=await tx.alertLog.create({data:{userId:user.id,alertType:'emergency_dispatch',additionalData:{status:'dispatching'}} ,select:{id:true}});
        return row.id;
      },{maxWait:10000,timeout:15000});
      if(!eventId)return false;
      const send=createEmergencySender({email,sleep,beforeAttempt:async()=>{try{const ok=await allowed(db);if(!ok)withdrawn=true;return ok}catch{return false}}});
      const accepted=await send(user,contact);
      await db.alertLog.updateMany({where:{id:eventId,userId:user.id},data:{additionalData:{status:accepted?'accepted':withdrawn?'withdrawn_or_disabled':'failed',alertSent:accepted}}});
      return accepted;
    } catch { safeLog.error('Emergency alert delivery failed'); return false; }
  };
}
export async function sendEmergencyAlert(user, contact) {
  return createGuardedEmergencySender({db:prisma,email:createEmailAdapter()})(user,contact);
}
