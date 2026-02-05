import { FsProviderService, FsProviderError } from '../../src/application/services/FsProviderService';
import { InMemoryFsNodeRepository } from '../../src/infrastructure/persistence/InMemoryFsNodeRepository';
import { InMemoryBlobRepository } from '../../src/infrastructure/persistence/InMemoryBlobRepository';
import { IBlobStorage } from '../../src/domain/services/IBlobStorage';
import { ContentHash } from '../../src/domain/value-objects/ContentHash';

class MockBlobStorage implements IBlobStorage {
  private storage = new Map<string, Buffer>();

  async store(hash: ContentHash, content: Buffer): Promise<string> {
    const path = `/blobs/${hash.value}`;
    this.storage.set(path, content);
    return path;
  }

  async retrieve(storagePath: string): Promise<Buffer> {
    const content = this.storage.get(storagePath);
    if (!content) {
      throw new Error(`Blob not found: ${storagePath}`);
    }
    return content;
  }

  async delete(storagePath: string): Promise<void> {
    this.storage.delete(storagePath);
  }

  async exists(storagePath: string): Promise<boolean> {
    return this.storage.has(storagePath);
  }

  clear(): void {
    this.storage.clear();
  }
}

describe('FsProviderService', () => {
  let fsNodeRepo: InMemoryFsNodeRepository;
  let blobRepo: InMemoryBlobRepository;
  let blobStorage: MockBlobStorage;
  let fsProvider: FsProviderService;

  beforeEach(() => {
    fsNodeRepo = new InMemoryFsNodeRepository();
    blobRepo = new InMemoryBlobRepository();
    blobStorage = new MockBlobStorage();
    fsProvider = new FsProviderService(
      { tenantId: 'tenant-1', storageProvider: 'local' },
      fsNodeRepo,
      blobRepo,
      blobStorage,
    );
  });

  describe('createDirectory', () => {
    it('should create a single directory', async () => {
      await fsProvider.createDirectory('/documents');
      const exists = await fsProvider.exists('/documents');
      expect(exists).toBe(true);
    });

    it('should create nested directories recursively', async () => {
      await fsProvider.createDirectory('/home/user/documents');

      expect(await fsProvider.exists('/home')).toBe(true);
      expect(await fsProvider.exists('/home/user')).toBe(true);
      expect(await fsProvider.exists('/home/user/documents')).toBe(true);
    });

    it('should be idempotent for existing directory', async () => {
      await fsProvider.createDirectory('/documents');
      await fsProvider.createDirectory('/documents');
      expect(await fsProvider.exists('/documents')).toBe(true);
    });

    it('should throw when path exists as file', async () => {
      await fsProvider.writeFile('/myfile', 'content');
      await expect(fsProvider.createDirectory('/myfile')).rejects.toThrow(FsProviderError);
    });
  });

  describe('deleteDirectory', () => {
    it('should delete empty directory', async () => {
      await fsProvider.createDirectory('/documents');
      await fsProvider.deleteDirectory('/documents');
      expect(await fsProvider.exists('/documents')).toBe(false);
    });

    it('should delete directory with contents recursively', async () => {
      await fsProvider.createDirectory('/documents/subfolder');
      await fsProvider.writeFile('/documents/file.txt', 'content');
      await fsProvider.writeFile('/documents/subfolder/nested.txt', 'nested');

      await fsProvider.deleteDirectory('/documents');

      expect(await fsProvider.exists('/documents')).toBe(false);
      expect(await fsProvider.exists('/documents/subfolder')).toBe(false);
    });

    it('should throw when deleting root', async () => {
      await expect(fsProvider.deleteDirectory('/')).rejects.toThrow('Cannot delete root');
    });

    it('should throw for non-existent directory', async () => {
      await expect(fsProvider.deleteDirectory('/nonexistent')).rejects.toThrow('not found');
    });

    it('should clean up orphan blobs', async () => {
      await fsProvider.writeFile('/documents/file.txt', 'unique content');
      await fsProvider.deleteDirectory('/documents');

      // Blob should be deleted since no files reference it
      const orphans = await blobRepo.findOrphans();
      expect(orphans.length).toBe(0);
    });
  });

  describe('copyDirectory', () => {
    it('should copy directory with contents', async () => {
      await fsProvider.createDirectory('/source/subfolder');
      await fsProvider.writeFile('/source/file.txt', 'content');

      await fsProvider.copyDirectory('/source', '/dest');

      expect(await fsProvider.exists('/dest')).toBe(true);
      expect(await fsProvider.exists('/dest/subfolder')).toBe(true);
      expect(await fsProvider.exists('/dest/file.txt')).toBe(true);

      // Source should still exist
      expect(await fsProvider.exists('/source')).toBe(true);
    });

    it('should throw when destination exists', async () => {
      await fsProvider.createDirectory('/source');
      await fsProvider.createDirectory('/dest');

      await expect(fsProvider.copyDirectory('/source', '/dest')).rejects.toThrow('already exists');
    });
  });

  describe('moveDirectory', () => {
    it('should move directory', async () => {
      await fsProvider.createDirectory('/source/subfolder');
      await fsProvider.writeFile('/source/file.txt', 'content');

      await fsProvider.moveDirectory('/source', '/dest');

      expect(await fsProvider.exists('/dest')).toBe(true);
      expect(await fsProvider.exists('/dest/file.txt')).toBe(true);
      expect(await fsProvider.exists('/source')).toBe(false);
    });

    it('should throw when moving into itself', async () => {
      await fsProvider.createDirectory('/source');
      await expect(fsProvider.moveDirectory('/source', '/source/subfolder')).rejects.toThrow('into itself');
    });
  });

  describe('listDirectory', () => {
    it('should list directory contents', async () => {
      await fsProvider.createDirectory('/documents');
      await fsProvider.createDirectory('/documents/subfolder');
      await fsProvider.writeFile('/documents/file.txt', 'content');

      const contents = await fsProvider.listDirectory('/documents');

      expect(contents.length).toBe(2);
      expect(contents.map(n => n.name).sort()).toEqual(['file.txt', 'subfolder']);
    });

    it('should list root directory', async () => {
      await fsProvider.createDirectory('/documents');
      await fsProvider.writeFile('/file.txt', 'content');

      const contents = await fsProvider.listDirectory('/');

      expect(contents.length).toBe(2);
    });

    it('should throw for non-existent directory', async () => {
      await expect(fsProvider.listDirectory('/nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('writeFile', () => {
    it('should write string content', async () => {
      await fsProvider.writeFile('/file.txt', 'hello world');

      const content = await fsProvider.readFile('/file.txt');
      expect(content.toString('utf-8')).toBe('hello world');
    });

    it('should write buffer content', async () => {
      const buffer = Buffer.from([0x00, 0x01, 0x02]);
      await fsProvider.writeFile('/binary.bin', buffer);

      const content = await fsProvider.readFile('/binary.bin');
      expect(content).toEqual(buffer);
    });

    it('should create parent directories automatically', async () => {
      await fsProvider.writeFile('/deep/nested/file.txt', 'content');

      expect(await fsProvider.exists('/deep')).toBe(true);
      expect(await fsProvider.exists('/deep/nested')).toBe(true);
    });

    it('should overwrite existing file', async () => {
      await fsProvider.writeFile('/file.txt', 'original');
      await fsProvider.writeFile('/file.txt', 'updated');

      const content = await fsProvider.readFile('/file.txt');
      expect(content.toString()).toBe('updated');
    });

    it('should deduplicate identical content', async () => {
      await fsProvider.writeFile('/file1.txt', 'same content');
      await fsProvider.writeFile('/file2.txt', 'same content');

      // Both files should reference the same blob
      const info1 = await fsProvider.getInfo('/file1.txt');
      const info2 = await fsProvider.getInfo('/file2.txt');
      expect(info1.size).toBe(info2.size);
    });
  });

  describe('readFile', () => {
    it('should read file content', async () => {
      await fsProvider.writeFile('/file.txt', 'content');
      const content = await fsProvider.readFile('/file.txt');
      expect(content.toString()).toBe('content');
    });

    it('should throw for non-existent file', async () => {
      await expect(fsProvider.readFile('/nonexistent.txt')).rejects.toThrow('not found');
    });

    it('should throw for directory', async () => {
      await fsProvider.createDirectory('/mydir');
      await expect(fsProvider.readFile('/mydir')).rejects.toThrow('is a directory');
    });
  });

  describe('deleteFile', () => {
    it('should delete file', async () => {
      await fsProvider.writeFile('/file.txt', 'content');
      await fsProvider.deleteFile('/file.txt');
      expect(await fsProvider.exists('/file.txt')).toBe(false);
    });

    it('should throw for non-existent file', async () => {
      await expect(fsProvider.deleteFile('/nonexistent.txt')).rejects.toThrow('not found');
    });

    it('should clean up orphan blob', async () => {
      await fsProvider.writeFile('/file.txt', 'unique content');
      await fsProvider.deleteFile('/file.txt');

      const orphans = await blobRepo.findOrphans();
      expect(orphans.length).toBe(0);
    });

    it('should not delete blob when other files reference it', async () => {
      await fsProvider.writeFile('/file1.txt', 'shared');
      await fsProvider.writeFile('/file2.txt', 'shared');

      await fsProvider.deleteFile('/file1.txt');

      // file2.txt should still be readable
      const content = await fsProvider.readFile('/file2.txt');
      expect(content.toString()).toBe('shared');
    });
  });

  describe('copyFile', () => {
    it('should copy file', async () => {
      await fsProvider.writeFile('/source.txt', 'content');
      await fsProvider.copyFile('/source.txt', '/dest.txt');

      expect(await fsProvider.exists('/dest.txt')).toBe(true);
      expect(await fsProvider.exists('/source.txt')).toBe(true);

      const content = await fsProvider.readFile('/dest.txt');
      expect(content.toString()).toBe('content');
    });

    it('should create parent directories for destination', async () => {
      await fsProvider.writeFile('/source.txt', 'content');
      await fsProvider.copyFile('/source.txt', '/deep/nested/dest.txt');

      expect(await fsProvider.exists('/deep/nested/dest.txt')).toBe(true);
    });
  });

  describe('moveFile', () => {
    it('should move file', async () => {
      await fsProvider.writeFile('/source.txt', 'content');
      await fsProvider.moveFile('/source.txt', '/dest.txt');

      expect(await fsProvider.exists('/dest.txt')).toBe(true);
      expect(await fsProvider.exists('/source.txt')).toBe(false);
    });

    it('should throw when destination exists', async () => {
      await fsProvider.writeFile('/source.txt', 'source');
      await fsProvider.writeFile('/dest.txt', 'dest');

      await expect(fsProvider.moveFile('/source.txt', '/dest.txt')).rejects.toThrow('already exists');
    });
  });

  describe('getInfo', () => {
    it('should return file info', async () => {
      await fsProvider.writeFile('/file.txt', 'hello');

      const info = await fsProvider.getInfo('/file.txt');

      expect(info.name).toBe('file.txt');
      expect(info.path).toBe('/file.txt');
      expect(info.size).toBe(5);
      expect(info.mimeType).toBe('text/plain');
      expect(info.createdAt).toBeInstanceOf(Date);
      expect(info.updatedAt).toBeInstanceOf(Date);
    });

    it('should return directory info', async () => {
      await fsProvider.createDirectory('/mydir');

      const info = await fsProvider.getInfo('/mydir');

      expect(info.name).toBe('mydir');
      expect(info.mimeType).toBe('inode/directory');
      expect(info.size).toBe(0);
    });

    it('should throw for non-existent path', async () => {
      await expect(fsProvider.getInfo('/nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('working directory', () => {
    it('should default to root', () => {
      expect(fsProvider.getWorkingDirectory()).toBe('/');
    });

    it('should resolve relative paths', async () => {
      fsProvider.setWorkingDirectory('/home/user');
      await fsProvider.createDirectory('documents');

      expect(await fsProvider.exists('/home/user/documents')).toBe(true);
    });

    it('should not affect absolute paths', async () => {
      fsProvider.setWorkingDirectory('/home/user');
      await fsProvider.createDirectory('/absolute/path');

      expect(await fsProvider.exists('/absolute/path')).toBe(true);
    });
  });

  describe('tenant isolation', () => {
    it('should isolate data between tenants', async () => {
      const tenant1Provider = new FsProviderService(
        { tenantId: 'tenant-1', storageProvider: 'local' },
        fsNodeRepo,
        blobRepo,
        blobStorage,
      );

      const tenant2Provider = new FsProviderService(
        { tenantId: 'tenant-2', storageProvider: 'local' },
        fsNodeRepo,
        blobRepo,
        blobStorage,
      );

      await tenant1Provider.createDirectory('/shared-name');
      await tenant2Provider.createDirectory('/shared-name');

      // Each tenant should see only their own directory
      expect(await tenant1Provider.exists('/shared-name')).toBe(true);
      expect(await tenant2Provider.exists('/shared-name')).toBe(true);

      await tenant1Provider.deleteDirectory('/shared-name');

      // Tenant 2's directory should still exist
      expect(await tenant2Provider.exists('/shared-name')).toBe(true);
    });
  });
});
