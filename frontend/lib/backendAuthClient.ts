export function backendUrl(): string {
  const value=process.env.NEXT_PUBLIC_API_URL;
  if(!value) throw new Error('Backend URL is not configured');
  return value.replace(/\/$/,'');
}
