import multer from 'multer';
import { AppError } from '../utils/AppError.js';
import { PLATFORM_MAX_UPLOAD_MB } from '../config/constants.js';

/**
 * Multer hard ceiling = platform max. Per-tenant maxUploadMB is enforced
 * in the material service after the file is in memory (413).
 */
const memory = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: PLATFORM_MAX_UPLOAD_MB * 1024 * 1024,
  },
  // Content validation (magic bytes, tenant allowlist) happens after upload middleware
  fileFilter(_req, _file, cb) {
    return cb(null, true);
  },
});

export const uploadMaterialFile = memory.single('file');

export function handleMulterError(err, _req, _res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(
        new AppError(`File too large. Platform maximum is ${PLATFORM_MAX_UPLOAD_MB} MB`, 413, {
          code: 'FILE_TOO_LARGE',
        }),
      );
    }
    return next(new AppError(err.message, 400, { code: 'UPLOAD_ERROR' }));
  }
  return next(err);
}
