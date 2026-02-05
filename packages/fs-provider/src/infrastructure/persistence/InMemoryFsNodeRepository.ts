import { IFsNodeRepository } from '../../domain/repositories/IFsNodeRepository.js';
import { FsNode } from '../../domain/entities/FsNode.js';
import { Directory } from '../../domain/entities/Directory.js';
import { File, FileProps } from '../../domain/entities/File.js';
import { Path } from '../../domain/value-objects/Path.js';
import { MimeType } from '../../domain/value-objects/MimeType.js';

interface StoredNode {
  id: string;
  tenantId: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  parentId: string | null;
  size: number;
  mimeType: string;
  blobId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class InMemoryFsNodeRepository implements IFsNodeRepository {
  private nodes: Map<string, StoredNode> = new Map();

  private reconstitute(stored: StoredNode): FsNode {
    const baseProps = {
      id: stored.id,
      tenantId: stored.tenantId,
      name: stored.name,
      path: Path.create(stored.path),
      type: stored.type,
      parentId: stored.parentId,
      size: stored.size,
      mimeType: MimeType.fromString(stored.mimeType),
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
    };

    if (stored.type === 'directory') {
      return Directory.reconstitute(baseProps);
    } else {
      return File.reconstitute({
        ...baseProps,
        blobId: stored.blobId!,
      } as FileProps);
    }
  }

  private toStored(node: FsNode): StoredNode {
    const stored: StoredNode = {
      id: node.id,
      tenantId: node.tenantId,
      name: node.name,
      path: node.path.value,
      type: node.type,
      parentId: node.parentId,
      size: node.size,
      mimeType: node.mimeType.value,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    };

    if (node.isFile()) {
      stored.blobId = (node as File).blobId;
    }

    return stored;
  }

  async findById(id: string, tenantId: string): Promise<FsNode | null> {
    const stored = this.nodes.get(id);
    if (!stored || stored.tenantId !== tenantId) {
      return null;
    }
    return this.reconstitute(stored);
  }

  async findByPath(path: Path, tenantId: string): Promise<FsNode | null> {
    for (const stored of this.nodes.values()) {
      if (stored.path === path.value && stored.tenantId === tenantId) {
        return this.reconstitute(stored);
      }
    }
    return null;
  }

  async findChildren(parentId: string | null, tenantId: string): Promise<FsNode[]> {
    const children: FsNode[] = [];
    for (const stored of this.nodes.values()) {
      if (stored.parentId === parentId && stored.tenantId === tenantId) {
        children.push(this.reconstitute(stored));
      }
    }
    return children.sort((a, b) => {
      // Directories first, then by name
      if (a.isDirectory() !== b.isDirectory()) {
        return a.isDirectory() ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  async findDescendants(path: Path, tenantId: string): Promise<FsNode[]> {
    const descendants: FsNode[] = [];
    const pathPrefix = path.isRoot() ? '/' : path.value + '/';

    for (const stored of this.nodes.values()) {
      if (stored.tenantId === tenantId && stored.path.startsWith(pathPrefix)) {
        descendants.push(this.reconstitute(stored));
      }
    }

    return descendants;
  }

  async save(node: FsNode): Promise<void> {
    this.nodes.set(node.id, this.toStored(node));
  }

  async saveMany(nodes: FsNode[]): Promise<void> {
    for (const node of nodes) {
      await this.save(node);
    }
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const stored = this.nodes.get(id);
    if (stored && stored.tenantId === tenantId) {
      this.nodes.delete(id);
    }
  }

  async deleteMany(ids: string[], tenantId: string): Promise<void> {
    for (const id of ids) {
      await this.delete(id, tenantId);
    }
  }

  async exists(path: Path, tenantId: string): Promise<boolean> {
    for (const stored of this.nodes.values()) {
      if (stored.path === path.value && stored.tenantId === tenantId) {
        return true;
      }
    }
    return false;
  }

  async findDirectoryByPath(path: Path, tenantId: string): Promise<Directory | null> {
    const node = await this.findByPath(path, tenantId);
    if (node?.isDirectory()) {
      return node as Directory;
    }
    return null;
  }

  async findFileByPath(path: Path, tenantId: string): Promise<File | null> {
    const node = await this.findByPath(path, tenantId);
    if (node?.isFile()) {
      return node as File;
    }
    return null;
  }

  async updatePaths(oldBasePath: Path, newBasePath: Path, tenantId: string): Promise<void> {
    const oldPrefix = oldBasePath.value;
    const newPrefix = newBasePath.value;

    for (const [id, stored] of this.nodes.entries()) {
      if (stored.tenantId === tenantId && stored.path.startsWith(oldPrefix + '/')) {
        const newPath = newPrefix + stored.path.slice(oldPrefix.length);
        const updated = { ...stored, path: newPath, updatedAt: new Date() };
        this.nodes.set(id, updated);
      }
    }
  }

  // Helper for tests
  clear(): void {
    this.nodes.clear();
  }
}
