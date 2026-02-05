import { FsNode } from '../entities/FsNode.js';
import { Directory } from '../entities/Directory.js';
import { File } from '../entities/File.js';
import { Path } from '../value-objects/Path.js';

export interface IFsNodeRepository {
  findById(id: string, tenantId: string): Promise<FsNode | null>;
  findByPath(path: Path, tenantId: string): Promise<FsNode | null>;
  findChildren(parentId: string | null, tenantId: string): Promise<FsNode[]>;
  findDescendants(path: Path, tenantId: string): Promise<FsNode[]>;

  save(node: FsNode): Promise<void>;
  saveMany(nodes: FsNode[]): Promise<void>;

  delete(id: string, tenantId: string): Promise<void>;
  deleteMany(ids: string[], tenantId: string): Promise<void>;

  exists(path: Path, tenantId: string): Promise<boolean>;

  findDirectoryByPath(path: Path, tenantId: string): Promise<Directory | null>;
  findFileByPath(path: Path, tenantId: string): Promise<File | null>;

  updatePaths(oldBasePath: Path, newBasePath: Path, tenantId: string): Promise<void>;
}
