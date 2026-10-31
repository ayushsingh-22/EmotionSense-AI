import { randomBytes } from 'node:crypto';
import logger from '../utils/logger.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const header = value => {
  if (typeof value !== 'string' || !value || /[\r\n\x00-\x1f\x7f]/.test(value)) throw new Error('Invalid email header');
  return value;
};
const address = value => {
  header(value);
  if (value.length > 254 || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value)) throw new Error('Invalid email address');
  return value;
};
const encodedWord = value => {
  const chunks=[]; let chunk=''; let bytes=0;
  for (const character of header(value)) { const size=Buffer.byteLength(character); if(bytes+size>30){chunks.push(chunk);chunk='';bytes=0} chunk+=character;bytes+=size }
  if(chunk) chunks.push(chunk);
  return chunks.map(part=>`=?UTF-8?B?${Buffer.from(part,'utf8').toString('base64')}?=`).join('\r\n ');
};
const wrapped = value => Buffer.from(value,'utf8').toString('base64').replace(/.{1,76}/g,'$&\r\n').trimEnd();
export function buildGmailMime({ sender, fromName, to, subject, text }) {
  address(sender); address(to); header(fromName); header(subject);
  if (typeof text !== 'string') throw new Error('Invalid email body');
  const boundary = `mindhaven-${randomBytes(18).toString('hex')}`;
  const html = `<p>${escapeHtml(text).replace(/\n/g,'<br>')}</p>`;
  return [
    `From: ${encodedWord(fromName)} <${sender}>`, `To: <${to}>`, `Subject: ${encodedWord(subject)}`,
    'MIME-Version: 1.0', `Content-Type: multipart/alternative; boundary="${boundary}"`, '',
    `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrapped(text),
    `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrapped(html),
    `--${boundary}--`, ''
  ].join('\r\n');
}

export function createGmailEmail({clientId,clientSecret,refreshToken,sender,fromName='MindHaven',fetchImpl=fetch,timeoutMs=10000,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),attempts=3}={}) {
  let accessToken=null, expiresAt=0, inflight=null;
  const configured=()=>{ if(!clientId || !clientSecret || !refreshToken || !sender || !fromName) return false; try { address(sender); header(fromName); return true } catch { return false } };
  async function call(url,options,readJson=false) {
    const controller=new AbortController();let timer;
    try { return await Promise.race([(async()=>{const response=await fetchImpl(url,{...options,signal:controller.signal});let parsed={};if(readJson){try{parsed=await response.json()}catch{}}return {response,parsed}})(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('timeout'))},timeoutMs)})]); }
    finally { clearTimeout(timer); }
  }
  async function token() {
    if(accessToken && Date.now() < expiresAt-60000) return accessToken;
    if(!inflight) inflight=(async()=>{
      const body=new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refreshToken,grant_type:'refresh_token'});
      const {response,parsed}=await call(TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body},true);
      if(!response.ok) {
        if(parsed.error==='invalid_grant') { logger.error({event:'gmail refresh token invalid',provider:'google'});const error=new Error('Gmail authorization invalid');error.permanent=true;throw error }
        const error=new Error('Gmail authorization unavailable');error.retryable=response.status===429||response.status>=500;throw error;
      }
      if(typeof parsed.access_token!=='string'||!parsed.access_token) throw new Error('Gmail authorization unavailable');
      accessToken=parsed.access_token;expiresAt=Date.now()+(Number(parsed.expires_in)||3600)*1000;return accessToken;
    })().finally(()=>{inflight=null});
    return inflight;
  }
  return {
    handlesRetries:true,
    configured,
    async send(message) {
      if(!configured()) throw new Error('Email provider not configured');
      const raw=Buffer.from(buildGmailMime({...message,sender,fromName}),'utf8').toString('base64url');
      for(let attempt=0;attempt<attempts;attempt++) {
        try {
          const bearer=await token();
          const {response}=await call(SEND_URL,{method:'POST',headers:{Authorization:`Bearer ${bearer}`,'Content-Type':'application/json'},body:JSON.stringify({raw})});
          if(response.ok) return {accepted:true};
          if(response.status===401 && attempt<attempts-1) { accessToken=null; expiresAt=0; await sleep(250*2**attempt); continue; }
          const error=new Error('Gmail delivery failed');error.retryable=response.status===429||response.status>=500;throw error;
        } catch(error) {
          if(error.permanent || error.retryable===false || attempt===attempts-1) throw new Error('Email provider request failed');
          await sleep(250*2**attempt);
        }
      }
      throw new Error('Email provider request failed');
    }
  };
}
