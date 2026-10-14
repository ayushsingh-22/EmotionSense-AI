/**
 * Error Handling Middleware
 * Centralized error handling for the application.
 *
 * Responses never contain internal error text. 5xx and unknown errors are answered
 * with a generic message + request id; the full error (redacted) goes to the log.
 * Operational 4xx errors raised on purpose (ApiError) keep their message.
 */
import { safePublicMessage } from '../utils/publicError.js';

/**
 * Custom API Error class. Messages of ApiError are written for end users and are
 * returned as-is for 4xx statuses.
 */
export class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

const GENERIC = {
  400: 'Bad request',
  401: 'Authentication required',
  403: 'Forbidden',
  404: 'Not found',
  413: 'Payload too large',
  429: 'Too many requests',
  500: 'Internal server error'
};

/**
 * Error handler middleware
 */
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  let statusCode = Number(err.statusCode || err.status) || 500;
  if (statusCode < 400 || statusCode > 599) statusCode = 500;
  let message;

  if (err instanceof ApiError && err.isOperational && statusCode < 500) {
    message = err.message; // deliberate, user-facing text
  } else if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    message = 'File size exceeds the maximum allowed limit';
  } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
    message = 'Unexpected file field';
  } else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Invalid JSON in request body';
  } else if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = GENERIC[413];
  } else if (statusCode < 500) {
    message = safePublicMessage(err, GENERIC[statusCode] || 'Bad request');
  } else {
    message = GENERIC[500];
  }

  // Full diagnostics stay server-side (console output is redacted).
  console.error('❌ Error:', {
    requestId: req.id,
    status: statusCode,
    method: req.method,
    url: req.originalUrl?.split('?')[0],
    // body-parser messages quote the start of the request body; never log that.
    message: err.type === 'entity.parse.failed' ? 'Malformed JSON body' : err.message,
    stack: statusCode >= 500 ? err.stack : undefined
  });

  const debug = process.env.NODE_ENV === 'development' && process.env.EXPOSE_ERROR_DETAILS === 'true';
  res.status(statusCode).json({
    success: false,
    error: message,
    requestId: req.id,
    ...(debug && { stack: err.stack })
  });
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors automatically
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
