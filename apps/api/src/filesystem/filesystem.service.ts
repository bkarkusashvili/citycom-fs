import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
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
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private getCacheKey(type: string, tenantId: string, path: string, options?: object): string {
    const base = `fs:${type}:${tenantId}:${path}`;
    return options ? `${base}:${JSON.stringify(options)}` : base;
  }

  private async invalidateCache(tenantId: string, paths: string[]): Promise<void> {
    const keysToDelete: string[] = [];
    // Common limit values used in the app
    const commonLimits = [50, 100, undefined];

    for (const path of paths) {
      keysToDelete.push(this.getCacheKey('info', tenantId, path));

      // Invalidate list cache for this path with all common limits
      for (const limit of commonLimits) {
        keysToDelete.push(this.getCacheKey('list', tenantId, path, { limit }));
      }

      // Also invalidate parent directory listing
      const parentPath = path.split('/').slice(0, -1).join('/') || '/';
      for (const limit of commonLimits) {
        keysToDelete.push(this.getCacheKey('list', tenantId, parentPath, { limit }));
      }
    }
    await Promise.all(keysToDelete.map((key) => this.cacheManager.del(key)));
  }

  // Directory operations - delegate to DirectoryService
  async createDirectory(tenantId: string, dirPath: string): Promise<FsNodeData> {
    const result = await this.directoryService.create(tenantId, dirPath);
    await this.invalidateCache(tenantId, [dirPath]);
    return result;
  }

  async deleteDirectory(tenantId: string, dirPath: string): Promise<void> {
    await this.directoryService.delete(tenantId, dirPath);
    await this.invalidateCache(tenantId, [dirPath]);
  }

  async listDirectory(
    tenantId: string,
    dirPath: string,
    options: ListDirectoryOptions = {},
  ): Promise<PaginatedResult<FsNodeData>> {
    // Only cache non-paginated requests for simplicity
    if (!options.cursor) {
      const cacheKey = this.getCacheKey('list', tenantId, dirPath, { limit: options.limit });
      const cached = await this.cacheManager.get<PaginatedResult<FsNodeData>>(cacheKey);
      if (cached) {
        return cached;
      }
      const result = await this.directoryService.list(tenantId, dirPath, options);
      await this.cacheManager.set(cacheKey, result);
      return result;
    }
    return this.directoryService.list(tenantId, dirPath, options);
  }

  async copyDirectory(tenantId: string, sourcePath: string, destPath: string): Promise<FsNodeData> {
    const result = await this.directoryService.copy(tenantId, sourcePath, destPath);
    await this.invalidateCache(tenantId, [sourcePath, destPath]);
    return result;
  }

  async moveDirectory(tenantId: string, sourcePath: string, destPath: string): Promise<FsNodeData> {
    const result = await this.directoryService.move(tenantId, sourcePath, destPath);
    await this.invalidateCache(tenantId, [sourcePath, destPath]);
    return result;
  }

  // File operations - delegate to FileService
  async writeFile(tenantId: string, filePath: string, content: Buffer): Promise<FsNodeData> {
    const result = await this.fileService.write(tenantId, filePath, content);
    await this.invalidateCache(tenantId, [filePath]);
    return result;
  }

  async readFile(tenantId: string, filePath: string): Promise<Buffer> {
    return this.fileService.read(tenantId, filePath);
  }

  async deleteFile(tenantId: string, filePath: string): Promise<void> {
    await this.fileService.delete(tenantId, filePath);
    await this.invalidateCache(tenantId, [filePath]);
  }

  async copyFile(tenantId: string, sourcePath: string, destPath: string): Promise<FsNodeData> {
    const result = await this.fileService.copy(tenantId, sourcePath, destPath);
    await this.invalidateCache(tenantId, [sourcePath, destPath]);
    return result;
  }

  async moveFile(tenantId: string, sourcePath: string, destPath: string): Promise<FsNodeData> {
    const result = await this.fileService.move(tenantId, sourcePath, destPath);
    await this.invalidateCache(tenantId, [sourcePath, destPath]);
    return result;
  }

  // Common operations
  async getInfo(tenantId: string, nodePath: string): Promise<FsNodeData> {
    const normalized = normalizePath(nodePath);
    const cacheKey = this.getCacheKey('info', tenantId, normalized);

    // Check cache first
    const cached = await this.cacheManager.get<FsNodeData>(cacheKey);
    if (cached) {
      return cached;
    }

    const node = await this.prisma.fsNode.findUnique({
      where: { tenantId_path: { tenantId, path: normalized } },
    });

    if (!node) {
      throw new NotFoundException('Path not found');
    }

    const result: FsNodeData = {
      name: node.name,
      path: node.path,
      size: Number(node.size),
      mimeType: node.mimeType!,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      ownerId: tenantId,
    };

    await this.cacheManager.set(cacheKey, result);
    return result;
  }

  async exists(tenantId: string, nodePath: string): Promise<boolean> {
    const normalized = normalizePath(nodePath);

    const node = await this.prisma.fsNode.findUnique({
      where: { tenantId_path: { tenantId, path: normalized } },
    });

    return node !== null;
  }

  // Version support methods
  async getFsNodeByPath(tenantId: string, nodePath: string): Promise<{ id: string }> {
    const normalized = normalizePath(nodePath);

    const node = await this.prisma.fsNode.findUnique({
      where: { tenantId_path: { tenantId, path: normalized } },
      select: { id: true },
    });

    if (!node) {
      throw new NotFoundException('Path not found');
    }

    return node;
  }

  async updateFileBlob(tenantId: string, filePath: string, blobId: string, size: bigint): Promise<void> {
    const normalized = normalizePath(filePath);

    await this.prisma.fsNode.update({
      where: { tenantId_path: { tenantId, path: normalized } },
      data: { blobId, size },
    });

    await this.invalidateCache(tenantId, [filePath]);
  }
}
