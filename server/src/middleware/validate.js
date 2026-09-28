import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';

/**
 * Validate req body/query/params with a Zod schema.
 * @param {import('zod').ZodTypeAny} schema
 * @param {'body'|'query'|'params'} source
 */
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(
          new AppError('Validation failed', 400, {
            code: 'VALIDATION_ERROR',
            details: err.flatten(),
          }),
        );
      }
      return next(err);
    }
  };
}
