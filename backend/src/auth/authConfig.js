// Called explicitly by the future route composition; importing does not initialize services.
export function readAuthConfig(env = process.env) {
  const integer = (key, fallback, min, max) => {
    const value = env[key] === undefined ? fallback : Number(env[key]);
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid ${key}`);
    return value;
  };
  return {
    bcryptCost: integer('AUTH_BCRYPT_COST', 12, 4, 16),
    passwordMinLength: integer('AUTH_PASSWORD_MIN_LENGTH', 12, 8, 72),
    accessTtlSeconds: integer('AUTH_ACCESS_TTL_SECONDS', 900, 1, 900),
    challengeTtlMs: integer('AUTH_CHALLENGE_TTL_SECONDS', 600, 1, 600) * 1000,
    transactionOptions: {
      maxWait: integer('AUTH_TRANSACTION_MAX_WAIT_MS', 10000, 1, 60000),
      timeout: integer('AUTH_TRANSACTION_TIMEOUT_MS', 15000, 1, 60000)
    },
    jwtSecret: env.API_JWT_SECRET,
    codeSecret: env.AUTH_CODE_HMAC_SECRET,
    replayKey: env.AUTH_REFRESH_REPLAY_KEY,
    resendApiKey: env.RESEND_API_KEY,
    resendFrom: env.RESEND_FROM
  };
}
