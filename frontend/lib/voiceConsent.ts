let pending:Promise<boolean>|null=null;
export function requestVoiceConsent():Promise<boolean>{
 if(typeof window==='undefined')return Promise.resolve(false);
 if(!pending) pending=new Promise<boolean>(resolve=>{
   const handled=window.dispatchEvent(new CustomEvent('mindhaven:voice-consent',{cancelable:true,detail:{resolve}}));
   if(handled)resolve(false);
 }).finally(()=>{pending=null});
 return pending;
}
