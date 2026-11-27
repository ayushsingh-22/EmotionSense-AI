/** HTTP media is allowed only with an explicit development environment. */
export function validMediaBaseUrl(value, environment = process.env.NODE_ENV) {
 try {
  const url = new URL(value);
  return (url.protocol === 'https:' || (url.protocol === 'http:' && environment === 'development')) &&
   !url.username && !url.password && !url.search && !url.hash && url.pathname === '/media/';
 } catch { return false; }
}
export function assertMediaBaseUrl(env = process.env) {
 // `?? null`: an unset NODE_ENV in `env` must never fall back to the global process value.
 if (env.PUBLIC_MEDIA_BASE_URL && !validMediaBaseUrl(env.PUBLIC_MEDIA_BASE_URL, env.NODE_ENV ?? null))
  throw new Error('PUBLIC_MEDIA_BASE_URL must use HTTPS and end in /media/; HTTP is development-only');
}
