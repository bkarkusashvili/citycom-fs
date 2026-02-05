import { Test, TestingModule } from '@nestjs/testing';
import { FilesystemController } from './filesystem.controller';
import { FilesystemService, FsNodeData } from './filesystem.service';

describe('FilesystemController', () => {
  let controller: FilesystemController;
  let filesystemService: FilesystemService;

  const mockUser = { id: 'user-123', email: 'test@example.com' };

  const mockFsNode: FsNodeData = {
    name: 'test.txt',
    path: '/test.txt',
    size: 100,
    mimeType: 'text/plain',
    createdAt: new Date(),
    updatedAt: new Date(),
    ownerId: mockUser.id,
  };

  const mockFilesystemService = {
    createDirectory: jest.fn(),
    deleteDirectory: jest.fn(),
    copyDirectory: jest.fn(),
    moveDirectory: jest.fn(),
    listDirectory: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
    deleteFile: jest.fn(),
    copyFile: jest.fn(),
    moveFile: jest.fn(),
    getInfo: jest.fn(),
    exists: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesystemController],
      providers: [
        { provide: FilesystemService, useValue: mockFilesystemService },
      ],
    }).compile();

    controller = module.get<FilesystemController>(FilesystemController);
    filesystemService = module.get<FilesystemService>(FilesystemService);

    jest.clearAllMocks();
  });

  describe('createDirectory', () => {
    it('should create a directory', async () => {
      const dirNode = { ...mockFsNode, mimeType: 'inode/directory' };
      mockFilesystemService.createDirectory.mockResolvedValue(dirNode);

      const result = await controller.createDirectory(mockUser, { path: '/docs' });

      expect(result).toEqual(dirNode);
      expect(filesystemService.createDirectory).toHaveBeenCalledWith(mockUser.id, '/docs');
    });
  });

  describe('deleteDirectory', () => {
    it('should delete a directory', async () => {
      mockFilesystemService.deleteDirectory.mockResolvedValue(undefined);

      const result = await controller.deleteDirectory(mockUser, '/docs');

      expect(result).toEqual({ success: true });
      expect(filesystemService.deleteDirectory).toHaveBeenCalledWith(mockUser.id, '/docs');
    });
  });

  describe('copyDirectory', () => {
    it('should copy a directory', async () => {
      const dirNode = { ...mockFsNode, path: '/docs-copy' };
      mockFilesystemService.copyDirectory.mockResolvedValue(dirNode);

      const result = await controller.copyDirectory(mockUser, { from: '/docs', to: '/docs-copy' });

      expect(result).toEqual(dirNode);
      expect(filesystemService.copyDirectory).toHaveBeenCalledWith(mockUser.id, '/docs', '/docs-copy');
    });
  });

  describe('moveDirectory', () => {
    it('should move a directory', async () => {
      const dirNode = { ...mockFsNode, path: '/new-docs' };
      mockFilesystemService.moveDirectory.mockResolvedValue(dirNode);

      const result = await controller.moveDirectory(mockUser, { from: '/docs', to: '/new-docs' });

      expect(result).toEqual(dirNode);
      expect(filesystemService.moveDirectory).toHaveBeenCalledWith(mockUser.id, '/docs', '/new-docs');
    });
  });

  describe('listDirectory', () => {
    it('should list directory contents', async () => {
      const listResult = {
        items: [mockFsNode],
        hasMore: false,
        nextCursor: undefined,
      };
      mockFilesystemService.listDirectory.mockResolvedValue(listResult);

      const result = await controller.listDirectory(mockUser, { path: '/', limit: 100 });

      expect(result).toEqual(listResult);
      expect(filesystemService.listDirectory).toHaveBeenCalledWith(mockUser.id, '/', {
        limit: 100,
        cursor: undefined,
      });
    });

    it('should pass pagination parameters', async () => {
      const listResult = {
        items: [mockFsNode],
        hasMore: true,
        nextCursor: 'cursor-123',
      };
      mockFilesystemService.listDirectory.mockResolvedValue(listResult);

      const result = await controller.listDirectory(mockUser, {
        path: '/docs',
        limit: 50,
        cursor: 'prev-cursor',
      });

      expect(result.hasMore).toBe(true);
      expect(filesystemService.listDirectory).toHaveBeenCalledWith(mockUser.id, '/docs', {
        limit: 50,
        cursor: 'prev-cursor',
      });
    });
  });

  describe('writeFile', () => {
    it('should write a text file', async () => {
      mockFilesystemService.writeFile.mockResolvedValue(mockFsNode);

      const result = await controller.writeFile(mockUser, { path: '/test.txt', content: 'Hello' });

      expect(result).toEqual(mockFsNode);
      expect(filesystemService.writeFile).toHaveBeenCalledWith(
        mockUser.id,
        '/test.txt',
        expect.any(Buffer),
      );
    });
  });

  describe('readFile', () => {
    it('should read a file', async () => {
      mockFilesystemService.readFile.mockResolvedValue(Buffer.from('Hello World'));

      const result = await controller.readFile(mockUser, '/test.txt');

      expect(result).toEqual({ content: 'Hello World' });
    });
  });

  describe('deleteFile', () => {
    it('should delete a file', async () => {
      mockFilesystemService.deleteFile.mockResolvedValue(undefined);

      const result = await controller.deleteFile(mockUser, '/test.txt');

      expect(result).toEqual({ success: true });
    });
  });

  describe('copyFile', () => {
    it('should copy a file', async () => {
      const copiedFile = { ...mockFsNode, path: '/test-copy.txt' };
      mockFilesystemService.copyFile.mockResolvedValue(copiedFile);

      const result = await controller.copyFile(mockUser, { from: '/test.txt', to: '/test-copy.txt' });

      expect(result).toEqual(copiedFile);
    });
  });

  describe('moveFile', () => {
    it('should move a file', async () => {
      const movedFile = { ...mockFsNode, path: '/new-test.txt' };
      mockFilesystemService.moveFile.mockResolvedValue(movedFile);

      const result = await controller.moveFile(mockUser, { from: '/test.txt', to: '/new-test.txt' });

      expect(result).toEqual(movedFile);
    });
  });

  describe('getInfo', () => {
    it('should return file info', async () => {
      mockFilesystemService.getInfo.mockResolvedValue(mockFsNode);

      const result = await controller.getInfo(mockUser, '/test.txt');

      expect(result).toEqual(mockFsNode);
    });
  });

  describe('exists', () => {
    it('should return true if file exists', async () => {
      mockFilesystemService.exists.mockResolvedValue(true);

      const result = await controller.exists(mockUser, '/test.txt');

      expect(result).toEqual({ exists: true });
    });

    it('should return false if file does not exist', async () => {
      mockFilesystemService.exists.mockResolvedValue(false);

      const result = await controller.exists(mockUser, '/nonexistent.txt');

      expect(result).toEqual({ exists: false });
    });
  });
});
