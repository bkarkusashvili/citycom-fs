import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../infrastructure/prisma.service';
import { DirectoryService, FileService } from './services';
import { FsNodeData, ListDirectoryOptions, PaginatedResult, normalizePath } from './utils';

// Re-export types for backward compatibility
export { FsNodeData } from './utils/types';

@Injectable()
export class FilesystemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly directoryService: DirectoryService,
    private readonly fileService: FileService,
  ) {}

  // Directory operations - delegate to DirectoryService
  async createDirectory(tenantId: string, dirPath: string): Promise<FsNodeData> {
    return this.directoryService.create(tenantId, dirPath);
  }

  async deleteDirectory(tenantId: string, dirPath: string): Promise<void> {
    return this.directoryService.delete(tenantId, dirPath);
  }

  async listDirectory(
    tenantId: string,
    dirPath: string,
    options: ListDirectoryOptions = {},
  ): Promise<PaginatedResult<FsNodeData>> {
    return this.directoryService.list(tenantId, dirPath, options);
  }

  async copyDirectory(tenantId: string, sourcePath: string, destPath: string): Promise<FsNodeData> {
    return this.directoryService.copy(tenantId, sourcePath, destPath);
  }

  async moveDirectory(tenantId: string, sourcePath: string, destPath: string): Promise<FsNodeData> {
    return this.directoryService.move(tenantId, sourcePath, destPath);
  }

  // File operations - delegate to FileService
  async writeFile(tenantId: string, filePath: string, content: Buffer): Promise<FsNodeData> {
    return this.fileService.write(tenantId, filePath, content);
  }

  async readFile(tenantId: string, filePath: string): Promise<Buffer> {
    return this.fileService.read(tenantId, filePath);
  }

  async deleteFile(tenantId: string, filePath: string): Promise<void> {
    return this.fileService.delete(tenantId, filePath);
  }

  async copyFile(tenantId: string, sourcePath: string, destPath: string): Promise<FsNodeData> {
    return this.fileService.copy(tenantId, sourcePath, destPath);
  }

  async moveFile(tenantId: string, sourcePath: string, destPath: string): Promise<FsNodeData> {
    return this.fileService.move(tenantId, sourcePath, destPath);
  }

  // Common operations
  async getInfo(tenantId: string, nodePath: string): Promise<FsNodeData> {
    const normalized = normalizePath(nodePath);

    const node = await this.prisma.fsNode.findUnique({
      where: { tenantId_path: { tenantId, path: normalized } },
    });

    if (!node) {
      throw new NotFoundException('Path not found');
    }

    return {
      name: node.name,
      path: node.path,
      size: Number(node.size),
      mimeType: node.mimeType!,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      ownerId: tenantId,
    };
  }

  async exists(tenantId: string, nodePath: string): Promise<boolean> {
    const normalized = normalizePath(nodePath);

    const node = await this.prisma.fsNode.findUnique({
      where: { tenantId_path: { tenantId, path: normalized } },
    });

    return node !== null;
  }
}
