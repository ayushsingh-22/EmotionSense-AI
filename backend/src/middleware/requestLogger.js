import safeLog from '../utils/logger.js';
/**
 * Request Logger Middleware
 * Logs incoming requests for debugging and monitoring
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { isProduction } from '../config/environment.js';
import { redact } from '../utils/logRedaction.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Format timestamp
 */
const getTimestamp = () => {
  return new Date().toISOString();
};

/**
 * Write log to file (if enabled)
 */
const writeLogToFile = (logMessage) => {
  if (!isProduction()) {
    const logDir = path.join(__dirname, '..', '..', 'logs');
    const logFile = path.join(logDir, `requests-${new Date().toISOString().split('T')[0]}.log`);
    
    fs.appendFile(logFile, redact(logMessage) + '\n', (err) => {
      if (err) safeLog.error('Failed to write log:', err);
    });
  }
};

/**
 * Request logger middleware
 */
/**
 * Route TEMPLATE for a request (e.g. /api/me/journals/:id), never the raw URL,
 * so ids, emails or query strings cannot reach the logs. Mount paths in
 * server.js are static strings, so baseUrl is safe; the logger re-validates.
 */
export const routeTemplate = (req) => {
  const base = typeof req.baseUrl === 'string' ? req.baseUrl : '';
  const path = typeof req.route?.path === 'string' ? req.route.path : '';
  const template = (base + path) || null;
  return template && template !== '/' ? template.replace(/\/$/, '') : '/unrouted';
};

/** One structured, PII-free line per finished request (method, route template, status, duration, request id). */
export const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const line = { event: 'http request', method: req.method, route: routeTemplate(req), status: res.statusCode, durationMs, requestId: req.id };
    if (res.statusCode >= 500) safeLog.error(line);
    else if (res.statusCode >= 400) safeLog.warn(line);
    else safeLog.info(line);
    writeLogToFile(`[${getTimestamp()}] ${req.id ?? '-'} ${req.method} ${line.route} - ${res.statusCode} - ${durationMs}ms`);
  });
  next();
};
