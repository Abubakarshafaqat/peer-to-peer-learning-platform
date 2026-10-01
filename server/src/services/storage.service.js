import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { tenantFolderPath } from '../utils/fileValidation.js';

const LOCAL_UPLOAD_DIR = path.resolve(process.cwd(), 'storage');
const SIGNED_URL_TTL_SEC = 300;

function cloudinaryConfigured() {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Storage abstraction — Cloudinary when configured, otherwise local disk.
 * Paths are always tenants/{tenantId}/materials/{materialId} (ids, never slug).
 */
class StorageService {
  constructor() {
    this.provider = cloudinaryConfigured() ? 'cloudinary' : 'local';
    if (this.provider === 'cloudinary') {
      cloudinary.config({
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET,
        secure: true,
      });
    }
  }

  get signedUrlTtlSeconds() {
    return SIGNED_URL_TTL_SEC;
  }

  /**
   * @param {{ buffer: Buffer, originalname: string, mimetype: string, size: number }} file
   * @param {{ tenantId: string, materialId: string, resourceType?: 'image'|'raw', mimeType?: string, originalName?: string }} ctx
   */
  async upload(file, ctx = {}) {
    if (!file?.buffer) {
      throw new AppError('No file provided', 400, { code: 'NO_FILE' });
    }
    if (!ctx.tenantId || !ctx.materialId) {
      throw new AppError('Upload requires tenant and material ids', 500, {
        code: 'STORAGE_CONTEXT',
      });
    }

    // Never trust folder/publicId/tenantId from the HTTP body — only ALS/service ctx
    const folder = tenantFolderPath(ctx.tenantId, ctx.materialId);
    const resourceType = ctx.resourceType || (file.mimetype?.startsWith('image/') ? 'image' : 'raw');
    const mimeType = ctx.mimeType || file.mimetype;
    const originalName = ctx.originalName || file.originalname;

    if (this.provider === 'cloudinary') {
      return this.#uploadCloudinary(file, { folder, resourceType, mimeType, originalName });
    }
    return this.#uploadLocal(file, { folder, resourceType, mimeType, originalName });
  }

  async delete(publicId, provider = this.provider, { resourceType } = {}) {
    if (!publicId) return;
    if (provider === 'cloudinary') {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType || 'auto',
        type: 'authenticated',
        invalidate: true,
      });
      return;
    }
    const filePath = path.join(LOCAL_UPLOAD_DIR, publicId);
    await fs.unlink(filePath).catch(() => {});
  }

  /** Retry Cloudinary/local delete; log failures instead of silently dropping. */
  async deleteWithRetry(publicId, provider = this.provider, opts = {}) {
    const attempts = opts.attempts || 3;
    let lastErr;
    for (let i = 1; i <= attempts; i += 1) {
      try {
        await this.delete(publicId, provider, opts);
        return;
      } catch (err) {
        lastErr = err;
        console.error('[storage] delete failed', {
          publicId,
          provider,
          attempt: i,
          message: err?.message,
        });
        if (i < attempts) await sleep(200 * i);
      }
    }
    throw lastErr || new AppError('Storage delete failed', 500, { code: 'STORAGE_DELETE' });
  }

  /**
   * Short-lived authenticated Cloudinary URL. Local returns null (stream via API).
   */
  async getSignedUrl(fileMeta, ttlSeconds = SIGNED_URL_TTL_SEC) {
    if (fileMeta.provider !== 'cloudinary') return null;
    const resourceType =
      fileMeta.resourceType || (fileMeta.mimeType?.startsWith('image/') ? 'image' : 'raw');
    return cloudinary.url(fileMeta.publicId, {
      resource_type: resourceType,
      type: 'authenticated',
      sign_url: true,
      secure: true,
      expires_at: Math.floor(Date.now() / 1000) + ttlSeconds,
    });
  }

  openLocalStream(publicId) {
    const filePath = path.join(LOCAL_UPLOAD_DIR, publicId);
    return createReadStream(filePath);
  }

  isTenantLayoutPublicId(publicId) {
    return /^tenants\/[a-f0-9]+\/materials\/[a-f0-9]+(\/|$)/i.test(String(publicId || ''));
  }

  async #uploadLocal(file, { folder, resourceType, mimeType, originalName }) {
    const dir = path.join(LOCAL_UPLOAD_DIR, folder);
    await fs.mkdir(dir, { recursive: true });
    const assetName = `asset${path.extname(originalName) || ''}`;
    const relativeId = `${folder}/${assetName}`.replace(/\\/g, '/');
    const filePath = path.join(LOCAL_UPLOAD_DIR, relativeId);
    await fs.writeFile(filePath, file.buffer);

    return {
      publicId: relativeId,
      deliveryRef: relativeId,
      provider: 'local',
      resourceType,
      mimeType,
      size: file.size,
      bytes: file.size,
      originalName,
    };
  }

  async #uploadCloudinary(file, { folder, resourceType, mimeType, originalName }) {
    const publicId = `${folder}/asset`;

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: resourceType,
          type: 'authenticated',
          access_mode: 'authenticated',
          overwrite: true,
          invalidate: true,
        },
        (err, uploaded) => {
          if (err) reject(err);
          else resolve(uploaded);
        },
      );
      stream.end(file.buffer);
    });

    return {
      publicId: result.public_id,
      deliveryRef: result.public_id,
      provider: 'cloudinary',
      resourceType,
      mimeType,
      size: file.size,
      bytes: result.bytes || file.size,
      originalName,
    };
  }
}

export const storageService = new StorageService();
export { SIGNED_URL_TTL_SEC };
