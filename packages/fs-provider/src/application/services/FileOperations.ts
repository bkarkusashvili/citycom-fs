import { IFsNodeRepository } from '../../domain/repositories/IFsNodeRepository.js';
import { File } from '../../domain/entities/File.js';
import { Path } from '../../domain/value-objects/Path.js';
import { BlobOperations } from './BlobOperations.js';
import { DirectoryOperations } from './DirectoryOperations.js';
import { FsProviderError } from './FsProviderError.js';

export interface FileOperationsConfig {
  tenantId: string;
}

/**
 * Handles file operations: write, read, delete, copy, and move.
 */
export class FileOperations {
  constructor(
    private readonly config: FileOperationsConfig,
    private readonly fsNodeRepository: IFsNodeRepository,
    private readonly blobOperations: BlobOperations,
    private readonly directoryOperations: DirectoryOperations,
  ) {}

  /**
   * Write content to a file. Creates parent directories if needed.
   * If file exists, replaces content (with blob deduplication).
   */
  async writeFile(targetPath: Path, content: string | Buffer): Promise<void> {
    const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;

    // Ensure parent directory exists and get parent ID
    const parentId = await this.directoryOperations.findOrCreateParent(targetPath, true);

    // Store content (handles deduplication)
    const { blobId, size } = await this.blobOperations.storeContent(buffer);

    // Check if file already exists
    const existingFile = await this.fsNodeRepository.findFileByPath(
      targetPath,
      this.config.tenantId,
    );

    if (existingFile) {
      // Replace blob reference if different
      await this.blobOperations.replaceReference(existingFile.blobId, blobId);

      // Update file
      existingFile.updateContent(blobId, size);
      await this.fsNodeRepository.save(existingFile);
    } else {
      // Check if path is occupied by a directory
      const existingNode = await this.fsNodeRepository.findByPath(
        targetPath,
        this.config.tenantId,
      );
      if (existingNode) {
        throw new FsProviderError(`Path is a directory: ${targetPath.value}`, 'PATH_IS_DIRECTORY');
      }

      // Create new file
      const file = File.create({
        tenantId: this.config.tenantId,
        path: targetPath,
        parentId,
        blobId,
        size,
      });
      await this.fsNodeRepository.save(file);
    }
  }

  /**
   * Read file content.
   */
  async readFile(targetPath: Path): Promise<Buffer> {
    const file = await this.fsNodeRepository.findFileByPath(targetPath, this.config.tenantId);
    if (!file) {
      const node = await this.fsNodeRepository.findByPath(targetPath, this.config.tenantId);
      if (node?.isDirectory()) {
        throw new FsProviderError(`Path is a directory: ${targetPath.value}`, 'PATH_IS_DIRECTORY');
      }
      throw new FsProviderError(`File not found: ${targetPath.value}`, 'NOT_FOUND');
    }

    try {
      return await this.blobOperations.readContent(file.blobId);
    } catch {
      throw new FsProviderError(`Blob not found for file: ${targetPath.value}`, 'BLOB_NOT_FOUND');
    }
  }

  /**
   * Delete a file. Decrements blob reference count.
   */
  async deleteFile(targetPath: Path): Promise<void> {
    const file = await this.fsNodeRepository.findFileByPath(targetPath, this.config.tenantId);
    if (!file) {
      throw new FsProviderError(`File not found: ${targetPath.value}`, 'NOT_FOUND');
    }

    // Decrement blob reference count
    await this.blobOperations.decrementReference(file.blobId);

    await this.fsNodeRepository.delete(file.id, this.config.tenantId);
  }

  /**
   * Copy a file to a new location. Increments blob reference count.
   */
  async copyFile(sourcePath: Path, destPath: Path): Promise<void> {
    const sourceFile = await this.fsNodeRepository.findFileByPath(
      sourcePath,
      this.config.tenantId,
    );
    if (!sourceFile) {
      throw new FsProviderError(`Source file not found: ${sourcePath.value}`, 'NOT_FOUND');
    }

    // Check destination doesn't exist
    const existingDest = await this.fsNodeRepository.findByPath(destPath, this.config.tenantId);
    if (existingDest) {
      throw new FsProviderError(`Destination already exists: ${destPath.value}`, 'PATH_EXISTS');
    }

    // Ensure parent exists and get ID
    const destParentId = await this.directoryOperations.findOrCreateParent(destPath, true);

    // Increment blob reference count
    await this.blobOperations.incrementReference(sourceFile.blobId);

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

  /**
   * Move a file to a new location.
   */
  async moveFile(sourcePath: Path, destPath: Path): Promise<void> {
    const sourceFile = await this.fsNodeRepository.findFileByPath(
      sourcePath,
      this.config.tenantId,
    );
    if (!sourceFile) {
      throw new FsProviderError(`Source file not found: ${sourcePath.value}`, 'NOT_FOUND');
    }

    // Check destination doesn't exist
    const existingDest = await this.fsNodeRepository.findByPath(destPath, this.config.tenantId);
    if (existingDest) {
      throw new FsProviderError(`Destination already exists: ${destPath.value}`, 'PATH_EXISTS');
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
}
