/**
 * Request Logger Middleware
 * Logs incoming requests for debugging and monitoring
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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
  if (process.env.NODE_ENV === 'production') {
    const logDir = path.join(__dirname, '..', '..', 'logs');
    const logFile = path.join(logDir, `requests-${new Date().toISOString().split('T')[0]}.log`);
    
    fs.appendFile(logFile, logMessage + '\n', (err) => {
      if (err) console.error('Failed to write log:', err);
    });
  }
};

/**
 * Request logger middleware
 */
export const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log request
  const requestLog = `[${getTimestamp()}] ${req.id ?? '-'} ${req.method} ${req.originalUrl.split('?')[0]} - IP: ${req.ip}`;
  console.log(`📥 ${requestLog}`);
  writeLogToFile(requestLog);

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const responseLog = `[${getTimestamp()}] ${req.id ?? '-'} ${req.method} ${req.originalUrl.split('?')[0]} - ${res.statusCode} - ${duration}ms`;
    
    if (res.statusCode >= 400) {
      console.error(`📤❌ ${responseLog}`);
    } else {
      console.log(`📤✅ ${responseLog}`);
    }
    
    writeLogToFile(responseLog);
  });

  next();
};
