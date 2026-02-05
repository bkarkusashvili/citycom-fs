import { FsNodeData } from '../../domain/entities/FsNode.js';

export interface IFsProvider {
  // Directory operations
  createDirectory(path: string): Promise<void>;
  deleteDirectory(path: string): Promise<void>;
  copyDirectory(path: string, newPath: string): Promise<void>;
  moveDirectory(path: string, newPath: string): Promise<void>;
  listDirectory(path: string): Promise<FsNodeData[]>;

  // File operations
  writeFile(path: string, content: string | Buffer): Promise<void>;
  readFile(path: string): Promise<Buffer>;
  deleteFile(path: string): Promise<void>;
  copyFile(path: string, newPath: string): Promise<void>;
  moveFile(path: string, newPath: string): Promise<void>;

  // Common operations
  getInfo(path: string): Promise<FsNodeData>;
  exists(path: string): Promise<boolean>;

  // Working directory
  setWorkingDirectory(path: string): void;
  getWorkingDirectory(): string;
}
