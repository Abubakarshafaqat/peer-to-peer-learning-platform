import multer from 'multer';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

function getExt(filename = '') {
  const i = filename.lastIndexOf('.');
  return i >= 0 ? filename.slice(i).toLowerCase() : '';
}

const memory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.min(5, env.MAX_UPLOAD_MB) * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ext = getExt(file.originalname);
    if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXT.has(ext)) {
      return cb(
        new AppError('Avatar must be JPG, PNG, WEBP, or GIF', 400, { code: 'INVALID_FILE_TYPE' }),
      );
    }
    return cb(null, true);
  },
});

export const uploadAvatarFile = memory.single('avatar');
