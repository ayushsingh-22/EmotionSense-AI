export async function authRequest(path: string, body: Record<string, unknown>, accessToken?: string) {
  const base=process.env.NEXT_PUBLIC_API_URL;
  if(!base) throw new Error('Service unavailable. Please try again.');
  let result: Response;
  try {result=await fetch(`${base.replace(/\/$/,'')}/api/auth/${path}`,{method:'POST',headers:{'Content-Type':'application/json',...(accessToken?{Authorization:`Bearer ${accessToken}`}:{})},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(20000)});}
  catch {throw new Error('Service unavailable. Please try again.')}
  if(!result.ok) throw new Error(result.status===429?'Too many attempts. Please wait and try again.':result.status>=500?'Service unavailable. Please try again.':'Unable to complete the request. Check your details and try again.');
}
