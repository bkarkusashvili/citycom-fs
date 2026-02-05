import { IFsNodeRepository } from '../../domain/repositories/IFsNodeRepository.js';
import { Directory } from '../../domain/entities/Directory.js';
import { File } from '../../domain/entities/File.js';
import { FsNodeData } from '../../domain/entities/FsNode.js';
import { Path } from '../../domain/value-objects/Path.js';
import { BlobOperations } from './BlobOperations.js';
import { FsProviderError } from './FsProviderError.js';

export interface DirectoryOperationsConfig {
  tenantId: string;
}

/**
 * Handles directory operations: create, delete, copy, move, and list.
 */
export class DirectoryOperations {
  constructor(
    private readonly config: DirectoryOperationsConfig,
    private readonly fsNodeRepository: IFsNodeRepository,
    private readonly blobOperations: BlobOperations,
  ) {}

  /**
   * Create a directory at the given path. Creates parent directories recursively.
   * Idempotent - returns silently if directory already exists.
   */
  async createDirectory(targetPath: Path): Promise<void> {
    // Check if already exists
    const existing = await this.fsNodeRepository.findByPath(targetPath, this.config.tenantId);
    if (existing) {
      if (existing.isDirectory()) {
        return; // Directory already exists, idempotent
      }
      throw new FsProviderError(`Path already exists as a file: ${targetPath.value}`, 'PATH_EXISTS');
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

  /**
   * Delete a directory and all its contents recursively.
   * Handles blob reference cleanup for contained files.
   */
  async deleteDirectory(targetPath: Path): Promise<void> {
    if (targetPath.isRoot()) {
      throw new FsProviderError('Cannot delete root directory', 'CANNOT_DELETE_ROOT');
    }

    const directory = await this.fsNodeRepository.findDirectoryByPath(
      targetPath,
      this.config.tenantId,
    );
    if (!directory) {
      throw new FsProviderError(`Directory not found: ${targetPath.value}`, 'NOT_FOUND');
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
        await this.blobOperations.decrementReference(file.blobId);
      }
    }

    // Delete all nodes including the directory itself
    const allIds = [...descendants.map((n) => n.id), directory.id];
    await this.fsNodeRepository.deleteMany(allIds, this.config.tenantId);
  }

  /**
   * Copy a directory and all its contents to a new location.
   * Increments blob references for all contained files.
   */
  async copyDirectory(sourcePath: Path, destPath: Path): Promise<void> {
    const sourceDir = await this.fsNodeRepository.findDirectoryByPath(
      sourcePath,
      this.config.tenantId,
    );
    if (!sourceDir) {
      throw new FsProviderError(`Source directory not found: ${sourcePath.value}`, 'NOT_FOUND');
    }

    // Check destination doesn't exist
    const existingDest = await this.fsNodeRepository.findByPath(destPath, this.config.tenantId);
    if (existingDest) {
      throw new FsProviderError(`Destination already exists: ${destPath.value}`, 'PATH_EXISTS');
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
        await this.blobOperations.incrementReference(file.blobId);
        nodesToSave.push(newFile);
      }
    }

    await this.fsNodeRepository.saveMany(nodesToSave);
  }

  /**
   * Move a directory to a new location. Updates paths for all descendants.
   */
  async moveDirectory(sourcePath: Path, destPath: Path): Promise<void> {
    if (sourcePath.isRoot()) {
      throw new FsProviderError('Cannot move root directory', 'CANNOT_MOVE_ROOT');
    }

    const sourceDir = await this.fsNodeRepository.findDirectoryByPath(
      sourcePath,
      this.config.tenantId,
    );
    if (!sourceDir) {
      throw new FsProviderError(`Source directory not found: ${sourcePath.value}`, 'NOT_FOUND');
    }

    // Check destination doesn't exist
    const existingDest = await this.fsNodeRepository.findByPath(destPath, this.config.tenantId);
    if (existingDest) {
      throw new FsProviderError(`Destination already exists: ${destPath.value}`, 'PATH_EXISTS');
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

  /**
   * List contents of a directory.
   */
  async listDirectory(targetPath: Path): Promise<FsNodeData[]> {
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
      throw new FsProviderError(`Directory not found: ${targetPath.value}`, 'NOT_FOUND');
    }

    const children = await this.fsNodeRepository.findChildren(directory.id, this.config.tenantId);
    return children.map((node) => node.toData());
  }

  /**
   * Find parent ID for a given path. Creates parent directories if createParents is true.
   */
  async findOrCreateParent(targetPath: Path, createParents: boolean): Promise<string | null> {
    const parentPath = targetPath.parent;
    if (!parentPath || parentPath.isRoot()) {
      return null;
    }

    if (createParents) {
      await this.createDirectory(parentPath);
    }

    const parent = await this.fsNodeRepository.findDirectoryByPath(
      parentPath,
      this.config.tenantId,
    );
    return parent?.id ?? null;
  }
}
