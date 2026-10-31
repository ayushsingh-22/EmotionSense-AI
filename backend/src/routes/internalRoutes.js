import express from 'express';
import rateLimit from 'express-rate-limit';
import { requireCronSecret } from '../middleware/auth.js';
import cronScheduler from '../journal-service/cronScheduler.js';
import logger from '../utils/logger.js';

export function createInternalRouter(scheduler = cronScheduler) {
  const router = express.Router();
  router.post('/journal/run', rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: true, legacyHeaders: false }), requireCronSecret, (_req, res) => {
    setImmediate(() => { scheduler.runNightly().catch(error => logger.error(error)); });
    return res.status(202).json({ accepted: true });
  });
  router.get('/client-ip', rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: true, legacyHeaders: false }), requireCronSecret, (req, res) => {
    const entries = (req.get('x-forwarded-for') || '').split(',').map(value => value.trim()).filter(Boolean).length;
    return res.json({ ip: req.ip, forwardedForEntries: entries, trustProxyHops: req.app.get('trust proxy') });
  });
  return router;
}
export default createInternalRouter();
