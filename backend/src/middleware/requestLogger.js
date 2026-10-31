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
export const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log request
  const requestLog = `[${getTimestamp()}] ${req.id ?? '-'} ${req.method}`;
  safeLog.log(`📥 ${requestLog}`);
  writeLogToFile(requestLog);

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const responseLog = `[${getTimestamp()}] ${req.id ?? '-'} ${req.method} - ${res.statusCode} - ${duration}ms`;
    
    if (res.statusCode >= 400) {
      safeLog.error(`📤❌ ${responseLog}`);
    } else {
      safeLog.log(`📤✅ ${responseLog}`);
    }
    
    writeLogToFile(responseLog);
  });

  next();
};
