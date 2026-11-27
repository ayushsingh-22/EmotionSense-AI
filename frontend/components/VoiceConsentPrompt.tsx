'use client';
import { useEffect,useState } from 'react';
import { wellbeing } from '@/lib/wellbeing';
import { Button } from '@/components/ui/button';
export function VoiceConsentPrompt(){
 const [reply,setReply]=useState<null|((ok:boolean)=>void)>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 useEffect(()=>{const handler=(event:Event)=>{event.preventDefault();const e=event as CustomEvent<{resolve:(ok:boolean)=>void}>;setReply(()=>e.detail.resolve)};window.addEventListener('mindhaven:voice-consent',handler);return()=>window.removeEventListener('mindhaven:voice-consent',handler)},[]);
 if(!reply)return null;
 const close=(value:boolean)=>{reply(value);setReply(null);setError('')};
 return <div role="dialog" aria-modal="true" aria-labelledby="voice-consent-title" className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4"><div className="w-full max-w-md space-y-4 rounded-xl bg-background p-6 shadow-xl"><h2 id="voice-consent-title" className="text-xl font-semibold">Allow voice processing?</h2><p>Your audio is sent to our speech provider to process your recording. You can turn this off later in Privacy &amp; consent.</p>{error&&<p role="alert" className="text-destructive">{error}</p>}<div className="flex gap-3"><Button disabled={busy} onClick={async()=>{setBusy(true);try{await wellbeing.consent('voice_processing',true);close(true)}catch{setError('Could not save your choice. Please try again.')}finally{setBusy(false)}}}>Allow</Button><Button variant="outline" disabled={busy} onClick={()=>close(false)}>Not now</Button></div></div></div>
}
