/** One-time local desktop OAuth flow. No credential files are written. */
import { createServer } from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
if (!stdin.isTTY || !stdout.isTTY) throw new Error('Run this script directly in a local interactive terminal.');
const reader=createInterface({input:stdin,output:stdout});
const clientId=(await reader.question('Desktop OAuth client ID: ')).trim();reader.close();
const clientSecret=await new Promise((resolve,reject)=>{
  let value=''; stdout.write('Desktop OAuth client secret (hidden): ');stdin.setRawMode(true);stdin.resume();
  const onData=buffer=>{for(const c of buffer.toString('utf8')) {
    if(c==='\u0003'){finish();reject(new Error('Cancelled'));return}
    if(c==='\r'||c==='\n'){finish();resolve(value);return}
    if(c==='\u007f'||c==='\b'){value=value.slice(0,-1);continue}
    if(c >= ' ') value+=c;
  }};
  function finish(){stdin.removeListener('data',onData);stdin.setRawMode(false);stdin.pause();stdout.write('\n')}
  stdin.on('data',onData);
});
if(!clientId || !clientSecret) throw new Error('Client ID and secret are required.');
const state=randomBytes(32).toString('base64url'), verifier=randomBytes(32).toString('base64url');
const challenge=createHash('sha256').update(verifier).digest('base64url');
let resolveCallback,rejectCallback;
const callback=new Promise((resolve,reject)=>{resolveCallback=resolve;rejectCallback=reject});
const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');const received=url.searchParams.get('state')||'';
  const actual=Buffer.from(received), expected=Buffer.from(state);
  const ok=actual.length===expected.length && timingSafeEqual(actual,expected);
  if(url.pathname!=='/oauth2callback'||!ok){res.writeHead(400);res.end('Invalid authorization response.');return}
  if(url.searchParams.has('error') || !url.searchParams.get('code')) {res.writeHead(400);res.end('Authorization was not completed.');rejectCallback(new Error('Authorization was not completed.'));return}
  res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});res.end('Authorization received. Return to the terminal.');resolveCallback(url.searchParams.get('code'));
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const redirectUri=`http://127.0.0.1:${server.address().port}/oauth2callback`;
const auth=new URL('https://accounts.google.com/o/oauth2/v2/auth');
for(const [key,value] of Object.entries({client_id:clientId,redirect_uri:redirectUri,response_type:'code',scope:'https://www.googleapis.com/auth/gmail.send',access_type:'offline',prompt:'consent',state,code_challenge:challenge,code_challenge_method:'S256'}))auth.searchParams.set(key,value);
stdout.write(`Open this URL in your browser and sign in as the dedicated sender:\n${auth.toString()}\n`);
let timer;
try {
  const code=await Promise.race([callback,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Authorization timed out.')),300000)})]);
  const body=new URLSearchParams({client_id:clientId,client_secret:clientSecret,code,code_verifier:verifier,redirect_uri:redirectUri,grant_type:'authorization_code'});
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(10000)});
  let result;try { result=await response.json() } catch { throw new Error('Authorization response was invalid.'); }
  if(!response.ok || typeof result.refresh_token!=='string' || !result.refresh_token) throw new Error('No refresh token returned. Revoke the prior grant and try again.');
  stdout.write(`\nRefresh token (copy into your local environment; do not share):\n${result.refresh_token}\n`);
} finally {clearTimeout(timer);await new Promise(resolve=>server.close(resolve))}
