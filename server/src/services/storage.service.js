/**
 * Storage service abstraction (Cloudinary later; swappable for S3/Firebase).
 * Phase 0: interface stub only.
 */
export class StorageService {
  async upload(_file, _options = {}) {
    throw new Error('StorageService.upload not implemented (Phase 2)');
  }

  async delete(_publicId) {
    throw new Error('StorageService.delete not implemented (Phase 2)');
  }

  async getSignedUrl(_deliveryRef, _ttlSeconds = 300) {
    throw new Error('StorageService.getSignedUrl not implemented (Phase 2)');
  }
}

export const storageService = new StorageService();
