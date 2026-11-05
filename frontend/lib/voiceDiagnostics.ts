const stages=new Set(['input','audio_conversion','provider']);
const codes=new Set(['tls_certificate_error','rate_limit_exceeded','invalid_api_key','invalid_request_error','model_decommissioned','model_not_found','insufficient_quota','authentication_error','permission_error','server_error','rate_limit_error','provider_network_error']);
export function safeVoiceDiagnostic(value:unknown):{stage:string;provider?:string;status?:number;code?:string}|null{
 if(!value||typeof value!=='object')return null;const data=value as Record<string,unknown>;if(typeof data.stage!=='string'||!stages.has(data.stage))return null;
 const output:{stage:string;provider?:string;status?:number;code?:string}={stage:data.stage};if(data.provider==='groq')output.provider='groq';if(typeof data.status==='number'&&Number.isInteger(data.status)&&data.status>=100&&data.status<=599)output.status=data.status;if(typeof data.code==='string'&&codes.has(data.code))output.code=data.code;return output;
}
