import { IFsProvider } from '../interfaces/IFsProvider.js';
import { IFsNodeRepository } from '../../domain/repositories/IFsNodeRepository.js';
import { IBlobRepository } from '../../domain/repositories/IBlobRepository.js';
import { IBlobStorage } from '../../domain/services/IBlobStorage.js';
import { FsNodeData } from '../../domain/entities/FsNode.js';
import { StorageProvider } from '../../domain/entities/Blob.js';
import { Path } from '../../domain/value-objects/Path.js';
import { BlobOperations } from './BlobOperations.js';
import { DirectoryOperations } from './DirectoryOperations.js';
import { FileOperations } from './FileOperations.js';

// Re-export error types for backward compatibility
export { FsProviderError, ErrorCodes, type ErrorCode } from './FsProviderError.js';

export interface FsProviderServiceConfig {
  tenantId: string;
  storageProvider: StorageProvider;
}

/**
 * Main filesystem provider service implementing IFsProvider.
 * Acts as a facade, delegating to specialized operation services.
 */
export class FsProviderService implements IFsProvider {
  private workingDirectory: Path = Path.create('/');
  private readonly blobOperations: BlobOperations;
  private readonly directoryOperations: DirectoryOperations;
  private readonly fileOperations: FileOperations;

  constructor(
    private readonly config: FsProviderServiceConfig,
    private readonly fsNodeRepository: IFsNodeRepository,
    blobRepository: IBlobRepository,
    blobStorage: IBlobStorage,
  ) {
    // Initialize operation services
    this.blobOperations = new BlobOperations(
      { storageProvider: config.storageProvider },
      blobRepository,
      blobStorage,
    );

    this.directoryOperations = new DirectoryOperations(
      { tenantId: config.tenantId },
      fsNodeRepository,
      this.blobOperations,
    );

    this.fileOperations = new FileOperations(
      { tenantId: config.tenantId },
      fsNodeRepository,
      this.blobOperations,
      this.directoryOperations,
    );
  }

  private resolvePath(path: string): Path {
    if (path.startsWith('/')) {
      return Path.create(path);
    }
    return this.workingDirectory.join(path);
  }

  // Directory operations

  async createDirectory(path: string): Promise<void> {
    const targetPath = this.resolvePath(path);
    return this.directoryOperations.createDirectory(targetPath);
  }

  async deleteDirectory(path: string): Promise<void> {
    const targetPath = this.resolvePath(path);
    return this.directoryOperations.deleteDirectory(targetPath);
  }

  async copyDirectory(path: string, newPath: string): Promise<void> {
    const sourcePath = this.resolvePath(path);
    const destPath = this.resolvePath(newPath);
    return this.directoryOperations.copyDirectory(sourcePath, destPath);
  }

  async moveDirectory(path: string, newPath: string): Promise<void> {
    const sourcePath = this.resolvePath(path);
    const destPath = this.resolvePath(newPath);
    return this.directoryOperations.moveDirectory(sourcePath, destPath);
  }

  async listDirectory(path: string): Promise<FsNodeData[]> {
    const targetPath = this.resolvePath(path);
    return this.directoryOperations.listDirectory(targetPath);
  }

  // File operations

  async writeFile(path: string, content: string | Buffer): Promise<void> {
    const targetPath = this.resolvePath(path);
    return this.fileOperations.writeFile(targetPath, content);
  }

  async readFile(path: string): Promise<Buffer> {
    const targetPath = this.resolvePath(path);
    return this.fileOperations.readFile(targetPath);
  }

  async deleteFile(path: string): Promise<void> {
    const targetPath = this.resolvePath(path);
    return this.fileOperations.deleteFile(targetPath);
  }

  async copyFile(path: string, newPath: string): Promise<void> {
    const sourcePath = this.resolvePath(path);
    const destPath = this.resolvePath(newPath);
    return this.fileOperations.copyFile(sourcePath, destPath);
  }

  async moveFile(path: string, newPath: string): Promise<void> {
    const sourcePath = this.resolvePath(path);
    const destPath = this.resolvePath(newPath);
    return this.fileOperations.moveFile(sourcePath, destPath);
  }

  // Common operations

  async getInfo(path: string): Promise<FsNodeData> {
    const targetPath = this.resolvePath(path);

    const node = await this.fsNodeRepository.findByPath(targetPath, this.config.tenantId);
    if (!node) {
      const { FsProviderError } = await import('./FsProviderError.js');
      throw new FsProviderError(`Path not found: ${path}`, 'NOT_FOUND');
    }

    return node.toData();
  }

  async exists(path: string): Promise<boolean> {
    const targetPath = this.resolvePath(path);
    return this.fsNodeRepository.exists(targetPath, this.config.tenantId);
  }

  // Working directory

  setWorkingDirectory(path: string): void {
    this.workingDirectory = Path.create(path);
  }

  getWorkingDirectory(): string {
    return this.workingDirectory.value;
  }
}
