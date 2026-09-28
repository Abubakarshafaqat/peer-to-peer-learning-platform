import { AppError } from '../utils/AppError.js';
import { sendError } from '../utils/apiResponse.js';
import { env } from '../config/env.js';

export function notFoundHandler(req, _res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, { code: 'NOT_FOUND' }));
}

export function errorHandler(err, _req, res, _next) {
  let status = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let code = err.code;
  let details = err.details;

  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
    details = Object.values(err.errors || {}).map((e) => e.message);
  }

  if (err.code === 11000) {
    status = 409;
    message = 'Duplicate key';
    code = 'DUPLICATE_KEY';
    details = err.keyValue;
  }

  if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid id';
    code = 'INVALID_ID';
  }

  if (env.NODE_ENV !== 'production' && status >= 500) {
    console.error(err);
  }

  return sendError(res, {
    message,
    status,
    code,
    details: env.NODE_ENV === 'production' && status >= 500 ? undefined : details,
  });
}
