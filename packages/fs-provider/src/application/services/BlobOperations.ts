import { IBlobRepository } from '../../domain/repositories/IBlobRepository.js';
import { IBlobStorage } from '../../domain/services/IBlobStorage.js';
import { Blob, StorageProvider } from '../../domain/entities/Blob.js';
import { ContentHash } from '../../domain/value-objects/ContentHash.js';

export interface BlobOperationsConfig {
  storageProvider: StorageProvider;
}

/**
 * Handles blob storage operations including content-addressable storage,
 * deduplication, and reference counting for garbage collection.
 */
export class BlobOperations {
  constructor(
    private readonly config: BlobOperationsConfig,
    private readonly blobRepository: IBlobRepository,
    private readonly blobStorage: IBlobStorage,
  ) {}

  /**
   * Store content and return blob ID. Handles deduplication via content hash.
   * If content already exists, increments reference count and returns existing blob.
   */
  async storeContent(content: Buffer): Promise<{ blobId: string; size: number }> {
    const contentHash = ContentHash.fromContent(content);

    // Check if blob with same content already exists
    let blob = await this.blobRepository.findByContentHash(contentHash);

    if (blob) {
      // Blob exists, increment reference count
      await this.blobRepository.incrementReferenceCount(blob.id);
    } else {
      // Store new blob
      const storagePath = await this.blobStorage.store(contentHash, content);
      blob = Blob.create({
        contentHash,
        size: content.length,
        storageProvider: this.config.storageProvider,
        storagePath,
      });
      await this.blobRepository.save(blob);
    }

    return { blobId: blob.id, size: content.length };
  }

  /**
   * Read content from blob storage by blob ID.
   */
  async readContent(blobId: string): Promise<Buffer> {
    const blob = await this.blobRepository.findById(blobId);
    if (!blob) {
      throw new Error(`Blob not found: ${blobId}`);
    }
    return this.blobStorage.retrieve(blob.storagePath);
  }

  /**
   * Increment reference count for a blob (used when copying files).
   */
  async incrementReference(blobId: string): Promise<void> {
    await this.blobRepository.incrementReferenceCount(blobId);
  }

  /**
   * Decrement reference count and delete blob if no longer referenced.
   * Returns true if blob was deleted.
   */
  async decrementReference(blobId: string): Promise<boolean> {
    const newRefCount = await this.blobRepository.decrementReferenceCount(blobId);
    if (newRefCount === 0) {
      const blob = await this.blobRepository.findById(blobId);
      if (blob) {
        await this.blobStorage.delete(blob.storagePath);
        await this.blobRepository.delete(blob.id);
        return true;
      }
    }
    return false;
  }

  /**
   * Replace a file's blob reference. Decrements old blob's ref count,
   * and only if the new blob is different.
   */
  async replaceReference(oldBlobId: string, newBlobId: string): Promise<void> {
    if (oldBlobId !== newBlobId) {
      await this.decrementReference(oldBlobId);
    }
  }
}
