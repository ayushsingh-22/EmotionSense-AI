import fs from 'node:fs/promises';
import safeLog from '../utils/logger.js';
const codes=new Set(['tls_certificate_error','rate_limit_exceeded','invalid_api_key','invalid_request_error','model_decommissioned','model_not_found','insufficient_quota','authentication_error','permission_error','server_error','rate_limit_error','provider_network_error']);
const safeCode=value=>codes.has(value)?value:undefined;
function failure(status,code){const error=new Error('Speech transcription unavailable');error.diagnostic={stage:'provider',provider:'groq',...(Number.isInteger(status)&&status>=100&&status<=599?{status}:{}),...(safeCode(code)?{code}: {})};return error}

// Groq transcription API: https://console.groq.com/docs/speech-to-text
export async function transcribeWithGroq({audioPath,apiKey,model,language,temperature=0,responseFormat='verbose_json',fetchImpl=fetch,timeoutMs=30000}) {
 const form=new FormData();const bytes=await fs.readFile(audioPath);
 form.append('file',new Blob([bytes],{type:'audio/wav'}),'audio.wav');form.append('model',model);form.append('temperature',String(temperature));form.append('response_format',responseFormat);
 form.append('timestamp_granularities[]','word');form.append('timestamp_granularities[]','segment');if(language)form.append('language',language);
 try{
  const send=()=>fetchImpl('https://api.groq.com/openai/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`},body:form,signal:AbortSignal.timeout(timeoutMs)});
  let response;try{response=await send()}catch(error){if(error.cause?.code!=='SELF_SIGNED_CERT_IN_CHAIN')throw error;safeLog.warn({provider:'groq',providerErrorCode:'tls_certificate_error'});response=await send()}
  if(!response.ok){const body=await response.json().catch(()=>null);safeLog.error({provider:'groq',status:response.status,providerErrorCode:body?.error?.code,providerErrorType:body?.error?.type});throw failure(response.status,body?.error?.code||body?.error?.type)}
  return await response.json();
 }catch(error){if(error.diagnostic)throw error;const code=error.cause?.code==='SELF_SIGNED_CERT_IN_CHAIN'?'tls_certificate_error':'provider_network_error';safeLog.error({provider:'groq',providerErrorCode:code});throw failure(undefined,code)}
}
