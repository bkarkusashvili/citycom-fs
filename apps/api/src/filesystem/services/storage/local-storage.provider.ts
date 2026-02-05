import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { StorageProvider } from './storage-provider.interface';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly basePath: string;

  constructor(private readonly configService: ConfigService) {
    this.basePath = configService.get('BLOB_STORAGE_PATH', './data/blobs');
    this.logger.log(`Local storage initialized at: ${this.basePath}`);
  }

  async store(key: string, content: Buffer): Promise<string> {
    const subDir = key.substring(0, 2);
    const storagePath = path.join(this.basePath, subDir, key);

    await fs.mkdir(path.dirname(storagePath), { recursive: true });
    await fs.writeFile(storagePath, content);

    this.logger.debug(`Stored blob locally: ${storagePath}`);
    return storagePath;
  }

  async read(storagePath: string): Promise<Buffer> {
    return fs.readFile(storagePath);
  }

  async delete(storagePath: string): Promise<void> {
    try {
      await fs.unlink(storagePath);
      this.logger.debug(`Deleted blob: ${storagePath}`);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist, ignore
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
