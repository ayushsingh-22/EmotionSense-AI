'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authRequest } from '@/lib/publicAuth';

export default function VerifyEmailPage(){
  const [email,setEmail]=useState(''),[otp,setOtp]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[until,setUntil]=useState(0),[now,setNow]=useState(Date.now());const router=useRouter();
  useEffect(()=>{setEmail(sessionStorage.getItem('mindhaven-verification-email')||'');const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id)},[]);
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);try{await authRequest('verify-email',{email,otp});sessionStorage.removeItem('mindhaven-verification-email');router.push('/auth/login')}catch(err){setMessage(err instanceof Error?err.message:'Unable to verify.')}finally{setBusy(false)}}
  async function resend(){setBusy(true);try{await authRequest('resend-verification',{email});setUntil(Date.now()+60000);setMessage('If eligible, a code will be sent. Please wait before requesting another.')}catch(err){setMessage(err instanceof Error?err.message:'Unable to send.')}finally{setBusy(false)}}
  return <main className="mx-auto max-w-md p-6"><h1 className="text-2xl font-semibold">Verify your email</h1><p className="mt-2">If eligible, a six-digit code has been sent.</p><form onSubmit={submit} className="mt-6 space-y-4"><label className="block">Email<input className="block w-full border p-2" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="block">Verification code<input className="block w-full border p-2" inputMode="numeric" pattern="[0-9]{6}" required value={otp} onChange={e=>setOtp(e.target.value)}/></label><button disabled={busy} className="rounded bg-blue-700 px-4 py-2 text-white">Verify</button></form><button disabled={busy||now<until} onClick={resend} className="mt-4 underline">{now<until?`Request another code in ${Math.ceil((until-now)/1000)}s`:'Resend code'}</button>{message&&<p role="status" className="mt-4">{message}</p>}</main>;
}
