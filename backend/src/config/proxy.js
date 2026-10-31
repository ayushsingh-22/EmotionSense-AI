export function resolveTrustProxyHops(env = process.env) {
  const value = env.TRUST_PROXY_HOPS ?? '1';
  if (!/^(0|[1-9]\d*)$/.test(value) || Number(value) > 10) throw new Error('Invalid TRUST_PROXY_HOPS');
  return Number(value);
}
