import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma.service';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface BlobInfo {
  id: string;
  contentHash: string;
  size: number;
  storagePath: string;
}

@Injectable()
export class BlobService {
  private readonly logger = new Logger(BlobService.name);
  private readonly blobBasePath: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.blobBasePath = configService.get('BLOB_STORAGE_PATH', './data/blobs');
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
      // Store new blob
      const subDir = contentHash.substring(0, 2);
      const storagePath = path.join(this.blobBasePath, subDir, contentHash);

      await fs.mkdir(path.dirname(storagePath), { recursive: true });
      await fs.writeFile(storagePath, content);

      blob = await this.prisma.blob.create({
        data: {
          contentHash,
          size: content.length,
          storageProvider: 'local',
          storagePath,
        },
      });
      this.logger.debug({ message: 'Blob stored', contentHash, size: content.length });
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

    return fs.readFile(blob.storagePath);
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
      try {
        await fs.unlink(blob.storagePath);
      } catch (e) {
        // Ignore if file doesn't exist
      }
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
