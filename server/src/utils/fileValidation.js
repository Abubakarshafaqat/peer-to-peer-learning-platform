import path from 'path';
import { fileTypeFromBuffer } from 'file-type';
import { AppError } from '../utils/AppError.js';
import { SAFE_UPLOAD_MIME_TYPES, PLATFORM_MAX_UPLOAD_MB } from '../config/constants.js';

/** Extensions we treat as “real” when scanning for double-extension tricks */
const KNOWN_EXTS = new Set([
  'pdf',
  'doc',
  'docx',
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'exe',
  'bat',
  'cmd',
  'js',
  'msi',
  'scr',
  'com',
  'dll',
  'jar',
  'sh',
  'php',
  'html',
  'htm',
]);

/** Map magic-byte MIME → canonical allowlist MIME */
const MAGIC_TO_CANONICAL = {
  'application/pdf': 'application/pdf',
  'image/jpeg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
  'image/gif': 'image/gif',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Old OLE .doc
  'application/x-cfb': 'application/msword',
  'application/msword': 'application/msword',
};

const EXT_TO_MIME = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export function sanitizeOriginalFilename(name = '') {
  const base = path.basename(String(name || 'file')).replace(/\0/g, '');
  const cleaned = base.replace(/[^\w.\- ()[\]]+/g, '_').replace(/_{2,}/g, '_').trim();
  const limited = cleaned.slice(0, 180) || 'file';
  // Prevent hidden/relative names
  if (limited === '.' || limited === '..') return 'file';
  return limited;
}

export function hasDangerousDoubleExtension(filename = '') {
  const base = path.basename(String(filename)).toLowerCase();
  const parts = base.split('.').filter(Boolean);
  if (parts.length < 3) return false; // name + one ext
  // e.g. report.pdf.exe or malware.exe.pdf
  const exts = parts.slice(1);
  const knownCount = exts.filter((e) => KNOWN_EXTS.has(e)).length;
  return knownCount >= 2;
}

/**
 * Validate buffer + declared type against tenant allowlist.
 * @returns {{ mimeType: string, resourceType: 'image'|'raw', originalName: string }}
 */
export async function assertSafeUploadFile(file, { allowedMimeTypes } = {}) {
  if (!file?.buffer) {
    throw new AppError('File is required', 400, { code: 'NO_FILE' });
  }
  if (!file.size || file.size <= 0 || file.buffer.length === 0) {
    throw new AppError('Empty files are not allowed', 400, { code: 'EMPTY_FILE' });
  }

  const originalName = sanitizeOriginalFilename(file.originalname);
  if (hasDangerousDoubleExtension(originalName)) {
    throw new AppError('Filename has a disallowed double extension', 400, {
      code: 'DANGEROUS_FILENAME',
    });
  }

  const allow = new Set(
    (allowedMimeTypes?.length ? allowedMimeTypes : SAFE_UPLOAD_MIME_TYPES).map((m) =>
      String(m).toLowerCase(),
    ),
  );

  const detected = await fileTypeFromBuffer(file.buffer);
  if (!detected?.mime) {
    throw new AppError('Could not determine file type from content', 400, {
      code: 'UNKNOWN_FILE_TYPE',
    });
  }

  const canonical = MAGIC_TO_CANONICAL[detected.mime];
  if (!canonical) {
    throw new AppError(`File content type "${detected.mime}" is not allowed`, 400, {
      code: 'INVALID_FILE_TYPE',
    });
  }

  if (!allow.has(canonical)) {
    throw new AppError('This file type is not allowed for your university', 400, {
      code: 'FILE_TYPE_NOT_ALLOWED',
      details: { mimeType: canonical },
    });
  }

  // Extension must agree with magic bytes (blocks .exe renamed to .pdf)
  const ext = path.extname(originalName).toLowerCase();
  const extMime = EXT_TO_MIME[ext];
  if (!extMime || extMime !== canonical) {
    throw new AppError('File extension does not match file content', 400, {
      code: 'EXTENSION_MISMATCH',
    });
  }

  // Client Content-Type, if present, must not claim a different family
  const declared = String(file.mimetype || '').toLowerCase();
  if (declared && declared !== 'application/octet-stream') {
    const declaredCanonical = MAGIC_TO_CANONICAL[declared] || declared;
    if (declaredCanonical !== canonical) {
      throw new AppError('Declared Content-Type does not match file content', 400, {
        code: 'CONTENT_TYPE_MISMATCH',
      });
    }
  }

  const resourceType = canonical.startsWith('image/') ? 'image' : 'raw';
  return { mimeType: canonical, resourceType, originalName };
}

export function assertWithinUploadLimit(fileSizeBytes, maxUploadMB) {
  const mb = Number(maxUploadMB);
  const capped = Math.min(
    Number.isFinite(mb) && mb > 0 ? mb : PLATFORM_MAX_UPLOAD_MB,
    PLATFORM_MAX_UPLOAD_MB,
  );
  const maxBytes = capped * 1024 * 1024;
  if (fileSizeBytes > maxBytes) {
    throw new AppError(`File too large. Max ${capped} MB for this university`, 413, {
      code: 'FILE_TOO_LARGE',
      details: { maxUploadMB: capped },
    });
  }
  return capped;
}

export function tenantFolderPath(tenantId, materialId) {
  const tid = String(tenantId || '').replace(/[^a-f0-9]/gi, '');
  const mid = String(materialId || '').replace(/[^a-f0-9]/gi, '');
  if (!tid || !mid) {
    throw new AppError('Invalid storage path context', 500, { code: 'STORAGE_PATH' });
  }
  return `tenants/${tid}/materials/${mid}`;
}

export { PLATFORM_MAX_UPLOAD_MB, EXT_TO_MIME };
