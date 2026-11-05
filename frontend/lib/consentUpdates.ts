export const CONSENT_CHANGED_EVENT='mindhaven:consents-changed';
export function announceConsentChange(){if(typeof window!=='undefined')window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT))}
export function watchConsentUpdates(options:{windowTarget:Pick<Window,'addEventListener'|'removeEventListener'>;documentTarget:Pick<Document,'addEventListener'|'removeEventListener'|'visibilityState'>;load:()=>Promise<{purpose:string;granted:boolean}[]>;apply:(v:Record<string,boolean>)=>void;fail:(e:unknown)=>void}){
 let active=true,version=0;
 const refresh=async()=>{const current=++version;try{const rows=await options.load();if(active&&current===version)options.apply(Object.fromEntries(rows.map(x=>[x.purpose,x.granted])))}catch(e){if(active&&current===version)options.fail(e)}};
 const focus=()=>{void refresh()},visible=()=>{if(options.documentTarget.visibilityState==='visible')void refresh()};
 options.windowTarget.addEventListener('focus',focus);options.windowTarget.addEventListener(CONSENT_CHANGED_EVENT,focus);options.documentTarget.addEventListener('visibilitychange',visible);void refresh();
 return ()=>{active=false;version++;options.windowTarget.removeEventListener('focus',focus);options.windowTarget.removeEventListener(CONSENT_CHANGED_EVENT,focus);options.documentTarget.removeEventListener('visibilitychange',visible)};
}
