import { promises as fs } from 'fs';
import * as path from 'path';
import { IBlobStorage } from '../../domain/services/IBlobStorage.js';
import { ContentHash } from '../../domain/value-objects/ContentHash.js';

export interface LocalBlobStorageConfig {
  basePath: string;
}

export class LocalBlobStorage implements IBlobStorage {
  constructor(private readonly config: LocalBlobStorageConfig) {}

  private getStoragePath(hash: ContentHash): string {
    // Use first 2 chars as subdirectory for better file distribution
    const hashStr = hash.value;
    const subDir = hashStr.substring(0, 2);
    return path.join(this.config.basePath, subDir, hashStr);
  }

  async store(hash: ContentHash, content: Buffer): Promise<string> {
    const storagePath = this.getStoragePath(hash);
    const dir = path.dirname(storagePath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Write file only if it doesn't exist (idempotent)
    try {
      await fs.access(storagePath);
      // File already exists, skip write
    } catch {
      await fs.writeFile(storagePath, content);
    }

    return storagePath;
  }

  async retrieve(storagePath: string): Promise<Buffer> {
    try {
      return await fs.readFile(storagePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Blob not found at path: ${storagePath}`);
      }
      throw error;
    }
  }

  async delete(storagePath: string): Promise<void> {
    try {
      await fs.unlink(storagePath);

      // Try to remove empty parent directory
      const dir = path.dirname(storagePath);
      const files = await fs.readdir(dir);
      if (files.length === 0) {
        await fs.rmdir(dir);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // Ignore if file doesn't exist
    }
  }

  async exists(storagePath: string): Promise<boolean> {
    try {
      await fs.access(storagePath);
      return true;
    } catch {
      return false;
    }
  }
}
