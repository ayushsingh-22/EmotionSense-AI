import { readAuthConfig } from './authConfig.js';
import logger from '../utils/logger.js';
import { createPasswordService } from './passwordService.js';
import { createTokenService } from './tokenService.js';
import { createSessionService } from './sessionService.js';
import { createChallengeService } from './challengeService.js';
import { createEmailAdapter } from './emailService.js';

/** Must equal the website's PASSWORD_MIN_LENGTH (pinned in contracts/auth-register.json). */
export const PASSWORD_MIN_LENGTH_CONTRACT = 12;

// Compose backend-owned authentication services without network calls at initialization.
export function createAuthServices({ prisma, env = process.env, fetchImpl = fetch }) {
  const config = readAuthConfig(env);
  const secrets = [config.jwtSecret, config.codeSecret, config.replayKey];
  if (secrets.some(s => typeof s !== 'string') || new Set(secrets).size !== secrets.length) throw new Error('Auth secrets must be configured and distinct');
  const passwords = createPasswordService({ cost: config.bcryptCost, minLength: config.passwordMinLength });
  // The website enforces PASSWORD_MIN_LENGTH_CONTRACT; an env override that differs makes
  // signups fail (stricter) or the form misleading (looser). Not fatal, but visible in logs.
  if (config.passwordMinLength !== PASSWORD_MIN_LENGTH_CONTRACT) logger.warn({ event: 'auth password minimum mismatch', code: 'VALIDATION_FAILED' });
  const tokens = createTokenService({ secret: config.jwtSecret, ttlSeconds: config.accessTtlSeconds });
  const sessions = createSessionService({ prisma, tokens, replayKey: config.replayKey, transactionOptions: config.transactionOptions });
  const challenges = createChallengeService({ prisma, secret: config.codeSecret, ttlMs: config.challengeTtlMs, transactionOptions: config.transactionOptions });
  const email = createEmailAdapter({ env, fetchImpl });
  if (!email.configured?.()) logger.warn({event:'email configuration incomplete'});
  return { passwords, tokens, sessions, challenges, email, transactionOptions: config.transactionOptions };
}
