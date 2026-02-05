import { Injectable, NotFoundException, BadRequestException, Logger, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { BlobService } from './blob.service';
import { DirectoryService } from './directory.service';
import { FsNodeData } from '../utils/types';
import { normalizePath, getParentPath, getBasename } from '../utils/path.utils';

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blobService: BlobService,
    private readonly directoryService: DirectoryService,
  ) {}

  async write(tenantId: string, filePath: string, content: Buffer): Promise<FsNodeData> {
    const normalized = normalizePath(filePath);
    const fileName = getBasename(normalized);
    const parentPath = getParentPath(normalized);
    this.logger.log({ message: 'Writing file', tenantId, path: normalized, size: content.length });

    // Ensure parent directory exists
    let parentId: string | null = null;
    if (parentPath && parentPath !== '/') {
      await this.directoryService.create(tenantId, parentPath);
      const parent = await this.prisma.fsNode.findUnique({
        where: { tenantId_path: { tenantId, path: parentPath } },
      });
      parentId = parent?.id ?? null;
    }

    // Store blob content (handles deduplication)
    const blobInfo = await this.blobService.storeContent(content);

    // Get mime type
    const mimeType = this.blobService.getMimeType(fileName);

    // Check if file already exists
    const existingFile = await this.prisma.fsNode.findUnique({
      where: { tenantId_path: { tenantId, path: normalized } },
    });

    if (existingFile) {
      if (existingFile.type !== 'file') {
        throw new BadRequestException('Path is a directory');
      }

      // Decrement old blob reference if different
      if (existingFile.blobId && existingFile.blobId !== blobInfo.id) {
        await this.blobService.decrementReference(existingFile.blobId);
      }

      // Update file
      const updated = await this.prisma.fsNode.update({
        where: { id: existingFile.id },
        data: {
          blobId: blobInfo.id,
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
        blobId: blobInfo.id,
        size: content.length,
        mimeType,
      },
    });

    return this.toFsNodeData(file, tenantId);
  }

  async read(tenantId: string, filePath: string): Promise<Buffer> {
    const normalized = normalizePath(filePath);

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

    return this.blobService.readContent(file.blobId!);
  }

  async delete(tenantId: string, filePath: string): Promise<void> {
    const normalized = normalizePath(filePath);
    this.logger.log({ message: 'Deleting file', tenantId, path: normalized });

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
      await this.blobService.decrementReference(file.blobId);
    }

    await this.prisma.fsNode.delete({ where: { id: file.id } });
  }

  async copy(tenantId: string, sourcePath: string, destPath: string): Promise<FsNodeData> {
    const normalizedSource = normalizePath(sourcePath);
    const normalizedDest = normalizePath(destPath);
    this.logger.log({ message: 'Copying file', tenantId, from: normalizedSource, to: normalizedDest });

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
    const destParentPath = getParentPath(normalizedDest);
    let destParentId: string | null = null;

    if (destParentPath && destParentPath !== '/') {
      await this.directoryService.create(tenantId, destParentPath);
      const parent = await this.prisma.fsNode.findUnique({
        where: { tenantId_path: { tenantId, path: destParentPath } },
      });
      destParentId = parent?.id ?? null;
    }

    // Increment blob reference
    if (sourceFile.blobId) {
      await this.blobService.incrementReference(sourceFile.blobId);
    }

    // Create new file
    const newFile = await this.prisma.fsNode.create({
      data: {
        tenantId,
        name: getBasename(normalizedDest),
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

  async move(tenantId: string, sourcePath: string, destPath: string): Promise<FsNodeData> {
    const normalizedSource = normalizePath(sourcePath);
    const normalizedDest = normalizePath(destPath);
    this.logger.log({ message: 'Moving file', tenantId, from: normalizedSource, to: normalizedDest });

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
    const destParentPath = getParentPath(normalizedDest);
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
        name: getBasename(normalizedDest),
        path: normalizedDest,
        parentId: destParentId,
      },
    });

    return this.toFsNodeData(updated, tenantId);
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
