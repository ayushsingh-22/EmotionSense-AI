import { readAuthConfig } from './authConfig.js';
import { createPasswordService } from './passwordService.js';
import { createTokenService } from './tokenService.js';
import { createSessionService } from './sessionService.js';
import { createChallengeService } from './challengeService.js';
import { createResendEmail } from './emailService.js';

// Explicit composition only. No server routes, network calls or startup side effects in B1.
export function createAuthServices({ prisma, env = process.env, fetchImpl = fetch }) {
  const config = readAuthConfig(env);
  const secrets = [config.jwtSecret, config.codeSecret, config.replayKey];
  if (secrets.some(s => typeof s !== 'string') || new Set(secrets).size !== secrets.length) throw new Error('Auth secrets must be configured and distinct');
  const passwords = createPasswordService({ cost: config.bcryptCost, minLength: config.passwordMinLength });
  const tokens = createTokenService({ secret: config.jwtSecret, ttlSeconds: config.accessTtlSeconds });
  const sessions = createSessionService({ prisma, tokens, replayKey: config.replayKey });
  const challenges = createChallengeService({ prisma, secret: config.codeSecret, ttlMs: config.challengeTtlMs });
  const email = createResendEmail({ apiKey: config.resendApiKey, from: config.resendFrom, fetchImpl });
  return { passwords, tokens, sessions, challenges, email };
}
