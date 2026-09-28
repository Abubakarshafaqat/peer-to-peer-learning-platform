export class AppError extends Error {
  /**
   * @param {string} message
   * @param {number} statusCode
   * @param {{ code?: string, details?: unknown }} [options]
   */
  constructor(message, statusCode = 500, options = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = options.code;
    this.details = options.details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }
}
