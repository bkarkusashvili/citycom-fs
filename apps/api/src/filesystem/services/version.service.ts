import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { BlobService } from './blob.service';

export interface FileVersionInfo {
  id: string;
  version: number;
  size: number;
  createdAt: Date;
  createdBy: string;
}

@Injectable()
export class VersionService {
  private readonly logger = new Logger(VersionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blobService: BlobService,
  ) {}

  /**
   * Create a new version record for a file before it gets overwritten
   */
  async createVersion(
    fsNodeId: string,
    blobId: string,
    size: bigint,
    userId: string,
  ): Promise<FileVersionInfo> {
    // Get the current max version for this file
    const maxVersion = await this.prisma.fileVersion.aggregate({
      where: { fsNodeId },
      _max: { version: true },
    });

    const nextVersion = (maxVersion._max.version ?? 0) + 1;

    // Increment blob reference count since version now references it
    await this.blobService.incrementReference(blobId);

    const version = await this.prisma.fileVersion.create({
      data: {
        fsNodeId,
        blobId,
        version: nextVersion,
        size,
        createdBy: userId,
      },
    });

    this.logger.log({
      message: 'Version created',
      fsNodeId,
      version: nextVersion,
      blobId,
    });

    return {
      id: version.id,
      version: version.version,
      size: Number(version.size),
      createdAt: version.createdAt,
      createdBy: version.createdBy,
    };
  }

  /**
   * List all versions for a file
   */
  async listVersions(fsNodeId: string): Promise<FileVersionInfo[]> {
    const versions = await this.prisma.fileVersion.findMany({
      where: { fsNodeId },
      orderBy: { version: 'desc' },
    });

    return versions.map((v) => ({
      id: v.id,
      version: v.version,
      size: Number(v.size),
      createdAt: v.createdAt,
      createdBy: v.createdBy,
    }));
  }

  /**
   * Get a specific version
   */
  async getVersion(fsNodeId: string, version: number): Promise<FileVersionInfo | null> {
    const v = await this.prisma.fileVersion.findUnique({
      where: {
        fsNodeId_version: { fsNodeId, version },
      },
    });

    if (!v) return null;

    return {
      id: v.id,
      version: v.version,
      size: Number(v.size),
      createdAt: v.createdAt,
      createdBy: v.createdBy,
    };
  }

  /**
   * Read content of a specific version
   */
  async readVersionContent(fsNodeId: string, version: number): Promise<Buffer> {
    const v = await this.prisma.fileVersion.findUnique({
      where: {
        fsNodeId_version: { fsNodeId, version },
      },
    });

    if (!v) {
      throw new Error(`Version ${version} not found for file ${fsNodeId}`);
    }

    return this.blobService.readContent(v.blobId);
  }

  /**
   * Restore a file to a specific version
   * Returns the new blob info that should be set on the FsNode
   */
  async restoreVersion(
    fsNodeId: string,
    version: number,
    userId: string,
  ): Promise<{ blobId: string; size: bigint }> {
    const v = await this.prisma.fileVersion.findUnique({
      where: {
        fsNodeId_version: { fsNodeId, version },
      },
    });

    if (!v) {
      throw new Error(`Version ${version} not found for file ${fsNodeId}`);
    }

    // Get current file state to save as a version before restoring
    const currentFile = await this.prisma.fsNode.findUnique({
      where: { id: fsNodeId },
    });

    if (currentFile?.blobId) {
      // Save current state as a new version
      await this.createVersion(fsNodeId, currentFile.blobId, currentFile.size, userId);
    }

    // Increment reference for the restored blob
    await this.blobService.incrementReference(v.blobId);

    this.logger.log({
      message: 'Version restored',
      fsNodeId,
      restoredVersion: version,
    });

    return {
      blobId: v.blobId,
      size: v.size,
    };
  }

  /**
   * Delete all versions for a file (called when file is deleted)
   */
  async deleteAllVersions(fsNodeId: string): Promise<void> {
    const versions = await this.prisma.fileVersion.findMany({
      where: { fsNodeId },
    });

    // Decrement blob references for each version
    for (const v of versions) {
      await this.blobService.decrementReference(v.blobId);
    }

    await this.prisma.fileVersion.deleteMany({
      where: { fsNodeId },
    });

    this.logger.log({
      message: 'All versions deleted',
      fsNodeId,
      count: versions.length,
    });
  }
}
