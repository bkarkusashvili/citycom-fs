import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { BlobService } from './blob.service';
import { FsNodeData, ListDirectoryOptions, PaginatedResult } from '../utils/types';
import { normalizePath, getParentPath, getBasename } from '../utils/path.utils';

@Injectable()
export class DirectoryService {
  private readonly logger = new Logger(DirectoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blobService: BlobService,
  ) {}

  async create(tenantId: string, dirPath: string): Promise<FsNodeData> {
    const normalized = normalizePath(dirPath);
    this.logger.log({ message: 'Creating directory', tenantId, path: normalized });

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

  async delete(tenantId: string, dirPath: string): Promise<void> {
    const normalized = normalizePath(dirPath);
    this.logger.log({ message: 'Deleting directory', tenantId, path: normalized });

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
        await this.blobService.decrementReference(file.blobId);
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

  async list(
    tenantId: string,
    dirPath: string,
    options: ListDirectoryOptions = {},
  ): Promise<PaginatedResult<FsNodeData>> {
    const normalized = normalizePath(dirPath);
    const limit = options.limit ?? 100;

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

    // Build where clause with cursor support
    const whereClause: any = { tenantId, parentId };
    if (options.cursor) {
      whereClause.id = { gt: options.cursor };
    }

    const children = await this.prisma.fsNode.findMany({
      where: whereClause,
      orderBy: [{ type: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });

    const hasMore = children.length > limit;
    const items = hasMore ? children.slice(0, limit) : children;
    const nextCursor = hasMore ? items[items.length - 1].id : undefined;

    return {
      items: items.map((node) => this.toFsNodeData(node, tenantId)),
      nextCursor,
      hasMore,
    };
  }

  async copy(tenantId: string, sourcePath: string, destPath: string): Promise<FsNodeData> {
    const normalizedSource = normalizePath(sourcePath);
    const normalizedDest = normalizePath(destPath);
    this.logger.log({ message: 'Copying directory', tenantId, from: normalizedSource, to: normalizedDest });

    // Validate source exists and is a directory
    const sourceDir = await this.prisma.fsNode.findUnique({
      where: { tenantId_path: { tenantId, path: normalizedSource } },
    });

    if (!sourceDir) {
      throw new NotFoundException('Source directory not found');
    }

    if (sourceDir.type !== 'directory') {
      throw new BadRequestException('Source is not a directory');
    }

    // Prevent copying into itself
    if (normalizedDest.startsWith(normalizedSource + '/') || normalizedDest === normalizedSource) {
      throw new BadRequestException('Cannot copy directory into itself');
    }

    // Check destination doesn't already exist
    const existingDest = await this.prisma.fsNode.findUnique({
      where: { tenantId_path: { tenantId, path: normalizedDest } },
    });

    if (existingDest) {
      throw new BadRequestException('Destination already exists');
    }

    // Create the destination directory
    await this.create(tenantId, normalizedDest);

    // Get all descendants of source directory
    const descendants = await this.prisma.fsNode.findMany({
      where: {
        tenantId,
        path: { startsWith: normalizedSource + '/' },
      },
      orderBy: { path: 'asc' },
    });

    // Copy each descendant
    for (const node of descendants) {
      const relativePath = node.path.substring(normalizedSource.length);
      const newPath = normalizedDest + relativePath;

      if (node.type === 'directory') {
        await this.create(tenantId, newPath);
      } else {
        // Copy file - increment blob reference
        if (node.blobId) {
          await this.blobService.incrementReference(node.blobId);
        }

        // Get parent for the new file
        const newParentPath = getParentPath(newPath);
        let newParentId: string | null = null;
        if (newParentPath && newParentPath !== '/') {
          const parent = await this.prisma.fsNode.findUnique({
            where: { tenantId_path: { tenantId, path: newParentPath } },
          });
          newParentId = parent?.id ?? null;
        }

        await this.prisma.fsNode.create({
          data: {
            tenantId,
            name: node.name,
            path: newPath,
            type: 'file',
            parentId: newParentId,
            blobId: node.blobId,
            size: node.size,
            mimeType: node.mimeType,
          },
        });
      }
    }

    const result = await this.prisma.fsNode.findUnique({
      where: { tenantId_path: { tenantId, path: normalizedDest } },
    });

    return this.toFsNodeData(result!, tenantId);
  }

  async move(tenantId: string, sourcePath: string, destPath: string): Promise<FsNodeData> {
    const normalizedSource = normalizePath(sourcePath);
    const normalizedDest = normalizePath(destPath);
    this.logger.log({ message: 'Moving directory', tenantId, from: normalizedSource, to: normalizedDest });

    // Cannot move root
    if (normalizedSource === '/') {
      throw new BadRequestException('Cannot move root directory');
    }

    // Validate source exists and is a directory
    const sourceDir = await this.prisma.fsNode.findUnique({
      where: { tenantId_path: { tenantId, path: normalizedSource } },
    });

    if (!sourceDir) {
      throw new NotFoundException('Source directory not found');
    }

    if (sourceDir.type !== 'directory') {
      throw new BadRequestException('Source is not a directory');
    }

    // Prevent moving into itself
    if (normalizedDest.startsWith(normalizedSource + '/')) {
      throw new BadRequestException('Cannot move directory into itself');
    }

    // Check destination doesn't already exist
    const existingDest = await this.prisma.fsNode.findUnique({
      where: { tenantId_path: { tenantId, path: normalizedDest } },
    });

    if (existingDest) {
      throw new BadRequestException('Destination already exists');
    }

    // Find new parent for the moved directory
    const destParentPath = getParentPath(normalizedDest);
    let destParentId: string | null = null;

    if (destParentPath && destParentPath !== '/') {
      const destParent = await this.prisma.fsNode.findUnique({
        where: { tenantId_path: { tenantId, path: destParentPath } },
      });
      if (!destParent) {
        throw new NotFoundException('Destination parent directory not found');
      }
      if (destParent.type !== 'directory') {
        throw new BadRequestException('Destination parent is not a directory');
      }
      destParentId = destParent.id;
    }

    // Update the source directory itself
    await this.prisma.fsNode.update({
      where: { id: sourceDir.id },
      data: {
        name: getBasename(normalizedDest),
        path: normalizedDest,
        parentId: destParentId,
      },
    });

    // Update all descendants' paths
    const descendants = await this.prisma.fsNode.findMany({
      where: {
        tenantId,
        path: { startsWith: normalizedSource + '/' },
      },
    });

    for (const node of descendants) {
      const newPath = normalizedDest + node.path.substring(normalizedSource.length);
      await this.prisma.fsNode.update({
        where: { id: node.id },
        data: { path: newPath },
      });
    }

    const result = await this.prisma.fsNode.findUnique({
      where: { tenantId_path: { tenantId, path: normalizedDest } },
    });

    return this.toFsNodeData(result!, tenantId);
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
