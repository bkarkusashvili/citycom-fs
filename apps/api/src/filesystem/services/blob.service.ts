import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import {
  StorageProvider,
  STORAGE_PROVIDER,
  LOCAL_STORAGE_PROVIDER,
  S3_STORAGE_PROVIDER,
} from './storage';
import * as crypto from 'crypto';
import * as path from 'path';

export interface BlobInfo {
  id: string;
  contentHash: string;
  size: number;
  storagePath: string;
}

@Injectable()
export class BlobService {
  private readonly logger = new Logger(BlobService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: StorageProvider,
    @Inject(LOCAL_STORAGE_PROVIDER) private readonly localProvider: StorageProvider,
    @Optional() @Inject(S3_STORAGE_PROVIDER) private readonly s3Provider: StorageProvider | null,
  ) {
    this.logger.log(`BlobService initialized with ${storageProvider.constructor.name}`);
  }

  private getProviderForBlob(storageProviderType: string): StorageProvider {
    if (storageProviderType === 's3' && this.s3Provider) {
      return this.s3Provider;
    }
    return this.localProvider;
  }

  async storeContent(content: Buffer): Promise<BlobInfo> {
    const contentHash = crypto.createHash('sha256').update(content).digest('hex');

    // Check if blob exists (deduplication)
    let blob = await this.prisma.blob.findUnique({
      where: { contentHash },
    });

    if (blob) {
      // Increment reference count
      blob = await this.prisma.blob.update({
        where: { id: blob.id },
        data: { referenceCount: { increment: 1 } },
      });
      this.logger.debug({ message: 'Blob deduplicated', contentHash, refCount: blob.referenceCount });
    } else {
      // Store new blob using the storage provider
      const storagePath = await this.storageProvider.store(contentHash, content);
      const storageProviderType = this.storageProvider.constructor.name.includes('S3') ? 's3' : 'local';

      blob = await this.prisma.blob.create({
        data: {
          contentHash,
          size: content.length,
          storageProvider: storageProviderType,
          storagePath,
        },
      });
      this.logger.debug({ message: 'Blob stored', contentHash, size: content.length, provider: storageProviderType });
    }

    return {
      id: blob.id,
      contentHash: blob.contentHash,
      size: Number(blob.size),
      storagePath: blob.storagePath,
    };
  }

  async readContent(blobId: string): Promise<Buffer> {
    const blob = await this.prisma.blob.findUnique({
      where: { id: blobId },
    });

    if (!blob) {
      throw new Error(`Blob not found: ${blobId}`);
    }

    // Use the provider that matches where the blob is stored
    const provider = this.getProviderForBlob(blob.storageProvider);
    return provider.read(blob.storagePath);
  }

  async incrementReference(blobId: string): Promise<void> {
    await this.prisma.blob.update({
      where: { id: blobId },
      data: { referenceCount: { increment: 1 } },
    });
  }

  async decrementReference(blobId: string): Promise<void> {
    const blob = await this.prisma.blob.update({
      where: { id: blobId },
      data: { referenceCount: { decrement: 1 } },
    });

    if (blob.referenceCount <= 0) {
      this.logger.log({ message: 'Deleting orphan blob', blobId, contentHash: blob.contentHash });
      const provider = this.getProviderForBlob(blob.storageProvider);
      await provider.delete(blob.storagePath);
      await this.prisma.blob.delete({ where: { id: blobId } });
    }
  }

  getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.md': 'text/markdown',
      '.csv': 'text/csv',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}
