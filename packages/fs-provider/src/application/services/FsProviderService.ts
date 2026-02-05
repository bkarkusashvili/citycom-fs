import { IFsProvider } from '../interfaces/IFsProvider.js';
import { IFsNodeRepository } from '../../domain/repositories/IFsNodeRepository.js';
import { IBlobRepository } from '../../domain/repositories/IBlobRepository.js';
import { IBlobStorage } from '../../domain/services/IBlobStorage.js';
import { FsNodeData } from '../../domain/entities/FsNode.js';
import { Directory } from '../../domain/entities/Directory.js';
import { File } from '../../domain/entities/File.js';
import { Blob, StorageProvider } from '../../domain/entities/Blob.js';
import { Path } from '../../domain/value-objects/Path.js';
import { ContentHash } from '../../domain/value-objects/ContentHash.js';

export class FsProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'FsProviderError';
  }
}

export interface FsProviderServiceConfig {
  tenantId: string;
  storageProvider: StorageProvider;
}

export class FsProviderService implements IFsProvider {
  private workingDirectory: Path = Path.create('/');

  constructor(
    private readonly config: FsProviderServiceConfig,
    private readonly fsNodeRepository: IFsNodeRepository,
    private readonly blobRepository: IBlobRepository,
    private readonly blobStorage: IBlobStorage,
  ) {}

  private resolvePath(path: string): Path {
    if (path.startsWith('/')) {
      return Path.create(path);
    }
    return this.workingDirectory.join(path);
  }

  // Directory operations

  async createDirectory(path: string): Promise<void> {
    const targetPath = this.resolvePath(path);

    // Check if already exists
    const existing = await this.fsNodeRepository.findByPath(targetPath, this.config.tenantId);
    if (existing) {
      if (existing.isDirectory()) {
        return; // Directory already exists, idempotent
      }
      throw new FsProviderError(`Path already exists as a file: ${path}`, 'PATH_EXISTS');
    }

    // Create parent directories recursively
    const segments = targetPath.segments;
    let currentPath = Path.create('/');
    let parentId: string | null = null;

    for (let i = 0; i < segments.length; i++) {
      currentPath = currentPath.join(segments[i]!);
      const existingNode = await this.fsNodeRepository.findByPath(
        currentPath,
        this.config.tenantId,
      );

      if (existingNode) {
        if (!existingNode.isDirectory()) {
          throw new FsProviderError(
            `Cannot create directory: ${segments[i]} is a file`,
            'PATH_IS_FILE',
          );
        }
        parentId = existingNode.id;
      } else {
        const newDir = Directory.create({
          tenantId: this.config.tenantId,
          path: currentPath,
          parentId,
        });
        await this.fsNodeRepository.save(newDir);
        parentId = newDir.id;
      }
    }
  }

  async deleteDirectory(path: string): Promise<void> {
    const targetPath = this.resolvePath(path);

    if (targetPath.isRoot()) {
      throw new FsProviderError('Cannot delete root directory', 'CANNOT_DELETE_ROOT');
    }

    const directory = await this.fsNodeRepository.findDirectoryByPath(
      targetPath,
      this.config.tenantId,
    );
    if (!directory) {
      throw new FsProviderError(`Directory not found: ${path}`, 'NOT_FOUND');
    }

    // Get all descendants
    const descendants = await this.fsNodeRepository.findDescendants(
      targetPath,
      this.config.tenantId,
    );

    // Delete blobs for files (decrement reference count)
    for (const node of descendants) {
      if (node.isFile()) {
        const file = node as File;
        const newRefCount = await this.blobRepository.decrementReferenceCount(file.blobId);
        if (newRefCount === 0) {
          const blob = await this.blobRepository.findById(file.blobId);
          if (blob) {
            await this.blobStorage.delete(blob.storagePath);
            await this.blobRepository.delete(blob.id);
          }
        }
      }
    }

    // Delete all nodes including the directory itself
    const allIds = [...descendants.map((n) => n.id), directory.id];
    await this.fsNodeRepository.deleteMany(allIds, this.config.tenantId);
  }

  async copyDirectory(path: string, newPath: string): Promise<void> {
    const sourcePath = this.resolvePath(path);
    const destPath = this.resolvePath(newPath);

    const sourceDir = await this.fsNodeRepository.findDirectoryByPath(
      sourcePath,
      this.config.tenantId,
    );
    if (!sourceDir) {
      throw new FsProviderError(`Source directory not found: ${path}`, 'NOT_FOUND');
    }

    // Check destination doesn't exist
    const existingDest = await this.fsNodeRepository.findByPath(destPath, this.config.tenantId);
    if (existingDest) {
      throw new FsProviderError(`Destination already exists: ${newPath}`, 'PATH_EXISTS');
    }

    // Ensure parent of destination exists
    const destParentPath = destPath.parent;
    let destParentId: string | null = null;
    if (destParentPath && !destParentPath.isRoot()) {
      const destParent = await this.fsNodeRepository.findDirectoryByPath(
        destParentPath,
        this.config.tenantId,
      );
      if (!destParent) {
        throw new FsProviderError(`Destination parent not found: ${destParentPath.value}`, 'NOT_FOUND');
      }
      destParentId = destParent.id;
    }

    // Get all descendants
    const descendants = await this.fsNodeRepository.findDescendants(
      sourcePath,
      this.config.tenantId,
    );

    // Create mapping from old IDs to new IDs
    const idMap = new Map<string, string>();

    // Create new directory
    const newDir = Directory.create({
      tenantId: this.config.tenantId,
      path: destPath,
      parentId: destParentId,
    });
    idMap.set(sourceDir.id, newDir.id);

    const nodesToSave: (Directory | File)[] = [newDir];

    // Copy all descendants
    for (const node of descendants) {
      const relativePath = node.path.relativeTo(sourcePath);
      const newNodePath = destPath.join(relativePath);
      const newParentId = node.parentId ? idMap.get(node.parentId) ?? null : newDir.id;

      if (node.isDirectory()) {
        const newSubDir = Directory.create({
          tenantId: this.config.tenantId,
          path: newNodePath,
          parentId: newParentId,
        });
        idMap.set(node.id, newSubDir.id);
        nodesToSave.push(newSubDir);
      } else {
        const file = node as File;
        const newFile = File.create({
          tenantId: this.config.tenantId,
          path: newNodePath,
          parentId: newParentId,
          blobId: file.blobId,
          size: file.size,
          mimeType: file.mimeType,
        });
        // Increment blob reference count
        await this.blobRepository.incrementReferenceCount(file.blobId);
        nodesToSave.push(newFile);
      }
    }

    await this.fsNodeRepository.saveMany(nodesToSave);
  }

  async moveDirectory(path: string, newPath: string): Promise<void> {
    const sourcePath = this.resolvePath(path);
    const destPath = this.resolvePath(newPath);

    if (sourcePath.isRoot()) {
      throw new FsProviderError('Cannot move root directory', 'CANNOT_MOVE_ROOT');
    }

    const sourceDir = await this.fsNodeRepository.findDirectoryByPath(
      sourcePath,
      this.config.tenantId,
    );
    if (!sourceDir) {
      throw new FsProviderError(`Source directory not found: ${path}`, 'NOT_FOUND');
    }

    // Check destination doesn't exist
    const existingDest = await this.fsNodeRepository.findByPath(destPath, this.config.tenantId);
    if (existingDest) {
      throw new FsProviderError(`Destination already exists: ${newPath}`, 'PATH_EXISTS');
    }

    // Ensure destination is not inside source
    if (destPath.isDescendantOf(sourcePath)) {
      throw new FsProviderError('Cannot move directory into itself', 'INVALID_DESTINATION');
    }

    // Find new parent
    const destParentPath = destPath.parent;
    let destParentId: string | null = null;
    if (destParentPath && !destParentPath.isRoot()) {
      const destParent = await this.fsNodeRepository.findDirectoryByPath(
        destParentPath,
        this.config.tenantId,
      );
      if (!destParent) {
        throw new FsProviderError(`Destination parent not found: ${destParentPath.value}`, 'NOT_FOUND');
      }
      destParentId = destParent.id;
    }

    // Update paths for all descendants
    await this.fsNodeRepository.updatePaths(sourcePath, destPath, this.config.tenantId);

    // Update the directory itself
    sourceDir.move(destPath, destParentId);
    await this.fsNodeRepository.save(sourceDir);
  }

  async listDirectory(path: string): Promise<FsNodeData[]> {
    const targetPath = this.resolvePath(path);

    // Handle root directory specially
    if (targetPath.isRoot()) {
      const children = await this.fsNodeRepository.findChildren(null, this.config.tenantId);
      return children.map((node) => node.toData());
    }

    const directory = await this.fsNodeRepository.findDirectoryByPath(
      targetPath,
      this.config.tenantId,
    );
    if (!directory) {
      throw new FsProviderError(`Directory not found: ${path}`, 'NOT_FOUND');
    }

    const children = await this.fsNodeRepository.findChildren(directory.id, this.config.tenantId);
    return children.map((node) => node.toData());
  }

  // File operations

  async writeFile(path: string, content: string | Buffer): Promise<void> {
    const targetPath = this.resolvePath(path);
    const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;

    // Ensure parent directory exists
    const parentPath = targetPath.parent;
    if (parentPath && !parentPath.isRoot()) {
      await this.createDirectory(parentPath.value);
    }

    // Get parent ID
    let parentId: string | null = null;
    if (parentPath && !parentPath.isRoot()) {
      const parent = await this.fsNodeRepository.findDirectoryByPath(
        parentPath,
        this.config.tenantId,
      );
      if (parent) {
        parentId = parent.id;
      }
    }

    // Calculate content hash for deduplication
    const contentHash = ContentHash.fromContent(buffer);

    // Check if blob with same content already exists
    let blob = await this.blobRepository.findByContentHash(contentHash);

    if (blob) {
      // Blob exists, increment reference count
      await this.blobRepository.incrementReferenceCount(blob.id);
    } else {
      // Store new blob
      const storagePath = await this.blobStorage.store(contentHash, buffer);
      blob = Blob.create({
        contentHash,
        size: buffer.length,
        storageProvider: this.config.storageProvider,
        storagePath,
      });
      await this.blobRepository.save(blob);
    }

    // Check if file already exists
    const existingFile = await this.fsNodeRepository.findFileByPath(
      targetPath,
      this.config.tenantId,
    );

    if (existingFile) {
      // Decrement old blob reference
      const oldBlobId = existingFile.blobId;
      if (oldBlobId !== blob.id) {
        const newRefCount = await this.blobRepository.decrementReferenceCount(oldBlobId);
        if (newRefCount === 0) {
          const oldBlob = await this.blobRepository.findById(oldBlobId);
          if (oldBlob) {
            await this.blobStorage.delete(oldBlob.storagePath);
            await this.blobRepository.delete(oldBlob.id);
          }
        }
      }

      // Update file
      existingFile.updateContent(blob.id, buffer.length);
      await this.fsNodeRepository.save(existingFile);
    } else {
      // Check if path is occupied by a directory
      const existingNode = await this.fsNodeRepository.findByPath(
        targetPath,
        this.config.tenantId,
      );
      if (existingNode) {
        throw new FsProviderError(`Path is a directory: ${path}`, 'PATH_IS_DIRECTORY');
      }

      // Create new file
      const file = File.create({
        tenantId: this.config.tenantId,
        path: targetPath,
        parentId,
        blobId: blob.id,
        size: buffer.length,
      });
      await this.fsNodeRepository.save(file);
    }
  }

  async readFile(path: string): Promise<Buffer> {
    const targetPath = this.resolvePath(path);

    const file = await this.fsNodeRepository.findFileByPath(targetPath, this.config.tenantId);
    if (!file) {
      const node = await this.fsNodeRepository.findByPath(targetPath, this.config.tenantId);
      if (node?.isDirectory()) {
        throw new FsProviderError(`Path is a directory: ${path}`, 'PATH_IS_DIRECTORY');
      }
      throw new FsProviderError(`File not found: ${path}`, 'NOT_FOUND');
    }

    const blob = await this.blobRepository.findById(file.blobId);
    if (!blob) {
      throw new FsProviderError(`Blob not found for file: ${path}`, 'BLOB_NOT_FOUND');
    }

    return this.blobStorage.retrieve(blob.storagePath);
  }

  async deleteFile(path: string): Promise<void> {
    const targetPath = this.resolvePath(path);

    const file = await this.fsNodeRepository.findFileByPath(targetPath, this.config.tenantId);
    if (!file) {
      throw new FsProviderError(`File not found: ${path}`, 'NOT_FOUND');
    }

    // Decrement blob reference count
    const newRefCount = await this.blobRepository.decrementReferenceCount(file.blobId);
    if (newRefCount === 0) {
      const blob = await this.blobRepository.findById(file.blobId);
      if (blob) {
        await this.blobStorage.delete(blob.storagePath);
        await this.blobRepository.delete(blob.id);
      }
    }

    await this.fsNodeRepository.delete(file.id, this.config.tenantId);
  }

  async copyFile(path: string, newPath: string): Promise<void> {
    const sourcePath = this.resolvePath(path);
    const destPath = this.resolvePath(newPath);

    const sourceFile = await this.fsNodeRepository.findFileByPath(
      sourcePath,
      this.config.tenantId,
    );
    if (!sourceFile) {
      throw new FsProviderError(`Source file not found: ${path}`, 'NOT_FOUND');
    }

    // Check destination doesn't exist
    const existingDest = await this.fsNodeRepository.findByPath(destPath, this.config.tenantId);
    if (existingDest) {
      throw new FsProviderError(`Destination already exists: ${newPath}`, 'PATH_EXISTS');
    }

    // Ensure parent exists
    const destParentPath = destPath.parent;
    let destParentId: string | null = null;
    if (destParentPath && !destParentPath.isRoot()) {
      await this.createDirectory(destParentPath.value);
      const parent = await this.fsNodeRepository.findDirectoryByPath(
        destParentPath,
        this.config.tenantId,
      );
      if (parent) {
        destParentId = parent.id;
      }
    }

    // Increment blob reference count
    await this.blobRepository.incrementReferenceCount(sourceFile.blobId);

    // Create new file
    const newFile = File.create({
      tenantId: this.config.tenantId,
      path: destPath,
      parentId: destParentId,
      blobId: sourceFile.blobId,
      size: sourceFile.size,
      mimeType: sourceFile.mimeType,
    });
    await this.fsNodeRepository.save(newFile);
  }

  async moveFile(path: string, newPath: string): Promise<void> {
    const sourcePath = this.resolvePath(path);
    const destPath = this.resolvePath(newPath);

    const sourceFile = await this.fsNodeRepository.findFileByPath(
      sourcePath,
      this.config.tenantId,
    );
    if (!sourceFile) {
      throw new FsProviderError(`Source file not found: ${path}`, 'NOT_FOUND');
    }

    // Check destination doesn't exist
    const existingDest = await this.fsNodeRepository.findByPath(destPath, this.config.tenantId);
    if (existingDest) {
      throw new FsProviderError(`Destination already exists: ${newPath}`, 'PATH_EXISTS');
    }

    // Find new parent
    const destParentPath = destPath.parent;
    let destParentId: string | null = null;
    if (destParentPath && !destParentPath.isRoot()) {
      const parent = await this.fsNodeRepository.findDirectoryByPath(
        destParentPath,
        this.config.tenantId,
      );
      if (!parent) {
        throw new FsProviderError(`Destination parent not found: ${destParentPath.value}`, 'NOT_FOUND');
      }
      destParentId = parent.id;
    }

    // Update file
    sourceFile.move(destPath, destParentId);
    await this.fsNodeRepository.save(sourceFile);
  }

  // Common operations

  async getInfo(path: string): Promise<FsNodeData> {
    const targetPath = this.resolvePath(path);

    const node = await this.fsNodeRepository.findByPath(targetPath, this.config.tenantId);
    if (!node) {
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
