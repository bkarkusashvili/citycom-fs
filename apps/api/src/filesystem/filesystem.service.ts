import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../infrastructure/prisma.service';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface FsNodeData {
  name: string;
  path: string;
  size: number;
  mimeType: string;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
}

@Injectable()
export class FilesystemService {
  private readonly blobBasePath: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.blobBasePath = configService.get('BLOB_STORAGE_PATH', './data/blobs');
  }

  private normalizePath(inputPath: string): string {
    let normalized = inputPath.replace(/\\/g, '/').replace(/\/+/g, '/');
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }

  private getParentPath(filePath: string): string | null {
    const normalized = this.normalizePath(filePath);
    if (normalized === '/') return null;
    const parent = normalized.substring(0, normalized.lastIndexOf('/')) || '/';
    return parent;
  }

  async createDirectory(tenantId: string, dirPath: string): Promise<FsNodeData> {
    const normalized = this.normalizePath(dirPath);

    // Check if already exists
    const existing = await this.prisma.fsNode.findUnique({
      where: { tenantId_path: { tenantId, path: normalized } },
    });

    if (existing) {
      if (existing.type === 'directory') {
        return this.toFsNodeData(existing, tenantId);
      }
      throw new BadRequestException('Path already exists as a file');
    }

    // Create parent directories recursively
    const segments = normalized.split('/').filter(Boolean);
    let currentPath = '';
    let parentId: string | null = null;

    for (const segment of segments) {
      currentPath = currentPath + '/' + segment;

      let node = await this.prisma.fsNode.findUnique({
        where: { tenantId_path: { tenantId, path: currentPath } },
      });

      if (!node) {
        node = await this.prisma.fsNode.create({
          data: {
            tenantId,
            name: segment,
            path: currentPath,
            type: 'directory',
            parentId,
            mimeType: 'inode/directory',
          },
        });
      } else if (node.type !== 'directory') {
        throw new BadRequestException(`${segment} is a file, not a directory`);
      }

      parentId = node.id;
    }

    const result = await this.prisma.fsNode.findUnique({
      where: { tenantId_path: { tenantId, path: normalized } },
    });

    return this.toFsNodeData(result!, tenantId);
  }

  async deleteDirectory(tenantId: string, dirPath: string): Promise<void> {
    const normalized = this.normalizePath(dirPath);

    if (normalized === '/') {
      throw new BadRequestException('Cannot delete root directory');
    }

    const directory = await this.prisma.fsNode.findUnique({
      where: { tenantId_path: { tenantId, path: normalized } },
    });

    if (!directory) {
      throw new NotFoundException('Directory not found');
    }

    if (directory.type !== 'directory') {
      throw new BadRequestException('Path is not a directory');
    }

    // Get all files to clean up blobs
    const files = await this.prisma.fsNode.findMany({
      where: {
        tenantId,
        path: { startsWith: normalized + '/' },
        type: 'file',
      },
    });

    // Decrement blob references
    for (const file of files) {
      if (file.blobId) {
        await this.decrementBlobRef(file.blobId);
      }
    }

    // Delete all descendants and the directory
    await this.prisma.fsNode.deleteMany({
      where: {
        tenantId,
        OR: [
          { path: normalized },
          { path: { startsWith: normalized + '/' } },
        ],
      },
    });
  }

  async listDirectory(tenantId: string, dirPath: string): Promise<FsNodeData[]> {
    const normalized = this.normalizePath(dirPath);

    if (normalized !== '/') {
      const directory = await this.prisma.fsNode.findUnique({
        where: { tenantId_path: { tenantId, path: normalized } },
      });

      if (!directory) {
        throw new NotFoundException('Directory not found');
      }

      if (directory.type !== 'directory') {
        throw new BadRequestException('Path is not a directory');
      }
    }

    const parentId = normalized === '/'
      ? null
      : (await this.prisma.fsNode.findUnique({
          where: { tenantId_path: { tenantId, path: normalized } },
        }))?.id ?? null;

    const children = await this.prisma.fsNode.findMany({
      where: { tenantId, parentId },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    return children.map((node) => this.toFsNodeData(node, tenantId));
  }

  async writeFile(
    tenantId: string,
    filePath: string,
    content: Buffer,
  ): Promise<FsNodeData> {
    const normalized = this.normalizePath(filePath);
    const fileName = path.basename(normalized);
    const parentPath = this.getParentPath(normalized);

    // Ensure parent directory exists
    let parentId: string | null = null;
    if (parentPath && parentPath !== '/') {
      await this.createDirectory(tenantId, parentPath);
      const parent = await this.prisma.fsNode.findUnique({
        where: { tenantId_path: { tenantId, path: parentPath } },
      });
      parentId = parent?.id ?? null;
    }

    // Calculate content hash
    const contentHash = crypto.createHash('sha256').update(content).digest('hex');

    // Check if blob exists
    let blob = await this.prisma.blob.findUnique({
      where: { contentHash },
    });

    if (blob) {
      // Increment reference count
      await this.prisma.blob.update({
        where: { id: blob.id },
        data: { referenceCount: { increment: 1 } },
      });
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
    }

    // Get mime type
    const mimeType = this.getMimeType(fileName);

    // Check if file already exists
    const existingFile = await this.prisma.fsNode.findUnique({
      where: { tenantId_path: { tenantId, path: normalized } },
    });

    if (existingFile) {
      if (existingFile.type !== 'file') {
        throw new BadRequestException('Path is a directory');
      }

      // Decrement old blob reference
      if (existingFile.blobId && existingFile.blobId !== blob.id) {
        await this.decrementBlobRef(existingFile.blobId);
      }

      // Update file
      const updated = await this.prisma.fsNode.update({
        where: { id: existingFile.id },
        data: {
          blobId: blob.id,
          size: content.length,
          mimeType,
        },
      });

      return this.toFsNodeData(updated, tenantId);
    }

    // Create new file
    const file = await this.prisma.fsNode.create({
      data: {
        tenantId,
        name: fileName,
        path: normalized,
        type: 'file',
        parentId,
        blobId: blob.id,
        size: content.length,
        mimeType,
      },
    });

    return this.toFsNodeData(file, tenantId);
  }

  async readFile(tenantId: string, filePath: string): Promise<Buffer> {
    const normalized = this.normalizePath(filePath);

    const file = await this.prisma.fsNode.findUnique({
      where: { tenantId_path: { tenantId, path: normalized } },
      include: { blob: true },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.type !== 'file') {
      throw new BadRequestException('Path is a directory');
    }

    if (!file.blob) {
      throw new NotFoundException('File content not found');
    }

    return fs.readFile(file.blob.storagePath);
  }

  async deleteFile(tenantId: string, filePath: string): Promise<void> {
    const normalized = this.normalizePath(filePath);

    const file = await this.prisma.fsNode.findUnique({
      where: { tenantId_path: { tenantId, path: normalized } },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.type !== 'file') {
      throw new BadRequestException('Path is a directory');
    }

    if (file.blobId) {
      await this.decrementBlobRef(file.blobId);
    }

    await this.prisma.fsNode.delete({ where: { id: file.id } });
  }

  async copyFile(tenantId: string, sourcePath: string, destPath: string): Promise<FsNodeData> {
    const normalizedSource = this.normalizePath(sourcePath);
    const normalizedDest = this.normalizePath(destPath);

    const sourceFile = await this.prisma.fsNode.findUnique({
      where: { tenantId_path: { tenantId, path: normalizedSource } },
    });

    if (!sourceFile) {
      throw new NotFoundException('Source file not found');
    }

    if (sourceFile.type !== 'file') {
      throw new BadRequestException('Source is not a file');
    }

    // Check destination doesn't exist
    const existingDest = await this.prisma.fsNode.findUnique({
      where: { tenantId_path: { tenantId, path: normalizedDest } },
    });

    if (existingDest) {
      throw new BadRequestException('Destination already exists');
    }

    // Ensure parent directory exists
    const destParentPath = this.getParentPath(normalizedDest);
    let destParentId: string | null = null;

    if (destParentPath && destParentPath !== '/') {
      await this.createDirectory(tenantId, destParentPath);
      const parent = await this.prisma.fsNode.findUnique({
        where: { tenantId_path: { tenantId, path: destParentPath } },
      });
      destParentId = parent?.id ?? null;
    }

    // Increment blob reference
    if (sourceFile.blobId) {
      await this.prisma.blob.update({
        where: { id: sourceFile.blobId },
        data: { referenceCount: { increment: 1 } },
      });
    }

    // Create new file
    const newFile = await this.prisma.fsNode.create({
      data: {
        tenantId,
        name: path.basename(normalizedDest),
        path: normalizedDest,
        type: 'file',
        parentId: destParentId,
        blobId: sourceFile.blobId,
        size: sourceFile.size,
        mimeType: sourceFile.mimeType,
      },
    });

    return this.toFsNodeData(newFile, tenantId);
  }

  async moveFile(tenantId: string, sourcePath: string, destPath: string): Promise<FsNodeData> {
    const normalizedSource = this.normalizePath(sourcePath);
    const normalizedDest = this.normalizePath(destPath);

    const sourceFile = await this.prisma.fsNode.findUnique({
      where: { tenantId_path: { tenantId, path: normalizedSource } },
    });

    if (!sourceFile) {
      throw new NotFoundException('Source file not found');
    }

    if (sourceFile.type !== 'file') {
      throw new BadRequestException('Source is not a file');
    }

    // Check destination doesn't exist
    const existingDest = await this.prisma.fsNode.findUnique({
      where: { tenantId_path: { tenantId, path: normalizedDest } },
    });

    if (existingDest) {
      throw new BadRequestException('Destination already exists');
    }

    // Find new parent
    const destParentPath = this.getParentPath(normalizedDest);
    let destParentId: string | null = null;

    if (destParentPath && destParentPath !== '/') {
      const parent = await this.prisma.fsNode.findUnique({
        where: { tenantId_path: { tenantId, path: destParentPath } },
      });
      if (!parent) {
        throw new NotFoundException('Destination parent directory not found');
      }
      destParentId = parent.id;
    }

    // Update file
    const updated = await this.prisma.fsNode.update({
      where: { id: sourceFile.id },
      data: {
        name: path.basename(normalizedDest),
        path: normalizedDest,
        parentId: destParentId,
      },
    });

    return this.toFsNodeData(updated, tenantId);
  }

  async getInfo(tenantId: string, nodePath: string): Promise<FsNodeData> {
    const normalized = this.normalizePath(nodePath);

    const node = await this.prisma.fsNode.findUnique({
      where: { tenantId_path: { tenantId, path: normalized } },
    });

    if (!node) {
      throw new NotFoundException('Path not found');
    }

    return this.toFsNodeData(node, tenantId);
  }

  async exists(tenantId: string, nodePath: string): Promise<boolean> {
    const normalized = this.normalizePath(nodePath);

    const node = await this.prisma.fsNode.findUnique({
      where: { tenantId_path: { tenantId, path: normalized } },
    });

    return node !== null;
  }

  private async decrementBlobRef(blobId: string): Promise<void> {
    const blob = await this.prisma.blob.update({
      where: { id: blobId },
      data: { referenceCount: { decrement: 1 } },
    });

    if (blob.referenceCount <= 0) {
      // Delete blob file
      try {
        await fs.unlink(blob.storagePath);
      } catch (e) {
        // Ignore if file doesn't exist
      }

      await this.prisma.blob.delete({ where: { id: blobId } });
    }
  }

  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  private toFsNodeData(node: any, tenantId: string): FsNodeData {
    return {
      name: node.name,
      path: node.path,
      size: Number(node.size),
      mimeType: node.mimeType,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      ownerId: tenantId,
    };
  }
}
