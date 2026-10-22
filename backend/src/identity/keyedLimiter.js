/**
 * Small in-memory fixed-window limiter keyed by an opaque string (used per Firebase UID,
 * after the token has been verified). Per process, like the other limiters in this API.
 * Keys are hashed by the caller; this class never sees raw identifiers.
 */
export const createKeyedLimiter = ({ windowMs, limit, maxKeys = 10000, now = () => Date.now() }) => {
  const hits = new Map(); // key -> { count, resetAt }
  const sweep = (t) => {
    for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
  };
  return {
    /** Returns true when the call is allowed (and counts it). */
    take(key) {
      const t = now();
      let entry = hits.get(key);
      if (!entry || entry.resetAt <= t) {
        if (hits.size >= maxKeys) {
          sweep(t);
          if (hits.size >= maxKeys) hits.delete(hits.keys().next().value); // bounded memory
        }
        entry = { count: 0, resetAt: t + windowMs };
        hits.set(key, entry);
      }
      entry.count += 1;
      return entry.count <= limit;
    },
    /** True when the key has used up its budget in the current window. Does NOT count a hit. */
    isLimited(key) {
      const e = hits.get(key);
      return !!e && e.resetAt > now() && e.count >= limit;
    },
    retryAfterSec(key) {
      const e = hits.get(key);
      return e ? Math.max(1, Math.ceil((e.resetAt - now()) / 1000)) : 1;
    },
    size: () => hits.size
  };
};
