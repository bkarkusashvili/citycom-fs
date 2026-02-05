/**
 * Interface for storage providers (local filesystem, S3, etc.)
 */
export interface StorageProvider {
  /**
   * Store content and return the storage path/key
   */
  store(key: string, content: Buffer): Promise<string>;

  /**
   * Read content from storage
   */
  read(storagePath: string): Promise<Buffer>;

  /**
   * Delete content from storage
   */
  delete(storagePath: string): Promise<void>;

  /**
   * Check if content exists
   */
  exists(storagePath: string): Promise<boolean>;
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
export const LOCAL_STORAGE_PROVIDER = 'LOCAL_STORAGE_PROVIDER';
export const S3_STORAGE_PROVIDER = 'S3_STORAGE_PROVIDER';
