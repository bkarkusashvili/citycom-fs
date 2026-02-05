import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FilesystemService } from './filesystem.service';
import { DirectoryService, FileService, BlobService } from './services';
import { PrismaService } from '../infrastructure/prisma.service';

// Mock fs/promises
jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue(Buffer.from('test content')),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

describe('FilesystemService', () => {
  let service: FilesystemService;

  const tenantId = 'tenant-123';

  const mockPrismaService = {
    fsNode: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    blob: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('./data/blobs'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesystemService,
        DirectoryService,
        FileService,
        BlobService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<FilesystemService>(FilesystemService);

    jest.clearAllMocks();
  });

  describe('createDirectory', () => {
    it('should create a new directory', async () => {
      const mockDir = {
        id: 'dir-1',
        tenantId,
        name: 'documents',
        path: '/documents',
        type: 'directory',
        parentId: null,
        mimeType: 'inode/directory',
        size: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.fsNode.findUnique
        .mockResolvedValueOnce(null) // Check if exists
        .mockResolvedValueOnce(null) // Segment check
        .mockResolvedValueOnce(mockDir); // Final result

      mockPrismaService.fsNode.create.mockResolvedValue(mockDir);

      const result = await service.createDirectory(tenantId, '/documents');

      expect(result.path).toBe('/documents');
      expect(result.name).toBe('documents');
    });

    it('should return existing directory if it already exists', async () => {
      const existingDir = {
        id: 'dir-1',
        tenantId,
        name: 'documents',
        path: '/documents',
        type: 'directory',
        parentId: null,
        mimeType: 'inode/directory',
        size: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.fsNode.findUnique.mockResolvedValue(existingDir);

      const result = await service.createDirectory(tenantId, '/documents');

      expect(result.path).toBe('/documents');
      expect(mockPrismaService.fsNode.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if path exists as a file', async () => {
      const existingFile = {
        id: 'file-1',
        tenantId,
        name: 'documents',
        path: '/documents',
        type: 'file',
        parentId: null,
        size: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.fsNode.findUnique.mockResolvedValue(existingFile);

      await expect(service.createDirectory(tenantId, '/documents')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('deleteDirectory', () => {
    it('should delete directory and all descendants', async () => {
      const directory = {
        id: 'dir-1',
        tenantId,
        name: 'docs',
        path: '/docs',
        type: 'directory',
        parentId: null,
      };

      mockPrismaService.fsNode.findUnique.mockResolvedValue(directory);
      mockPrismaService.fsNode.findMany.mockResolvedValue([]);
      mockPrismaService.fsNode.deleteMany.mockResolvedValue({ count: 1 });

      await service.deleteDirectory(tenantId, '/docs');

      expect(mockPrismaService.fsNode.deleteMany).toHaveBeenCalled();
    });

    it('should throw BadRequestException when deleting root', async () => {
      await expect(service.deleteDirectory(tenantId, '/')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if directory not found', async () => {
      mockPrismaService.fsNode.findUnique.mockResolvedValue(null);

      await expect(service.deleteDirectory(tenantId, '/nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listDirectory', () => {
    it('should list directory contents with pagination', async () => {
      const children = [
        { id: 'item-1', tenantId, name: 'file1.txt', path: '/file1.txt', type: 'file', parentId: null, size: 100, mimeType: 'text/plain', createdAt: new Date(), updatedAt: new Date() },
        { id: 'item-2', tenantId, name: 'file2.txt', path: '/file2.txt', type: 'file', parentId: null, size: 200, mimeType: 'text/plain', createdAt: new Date(), updatedAt: new Date() },
      ];

      mockPrismaService.fsNode.findMany.mockResolvedValue(children);

      const result = await service.listDirectory(tenantId, '/', { limit: 10 });

      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });

    it('should return hasMore when there are more items', async () => {
      const children = Array.from({ length: 11 }, (_, i) => ({
        id: `item-${i}`,
        tenantId,
        name: `file${i}.txt`,
        path: `/file${i}.txt`,
        type: 'file',
        parentId: null,
        size: 100,
        mimeType: 'text/plain',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      mockPrismaService.fsNode.findMany.mockResolvedValue(children);

      const result = await service.listDirectory(tenantId, '/', { limit: 10 });

      expect(result.items).toHaveLength(10);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe('item-9');
    });

    it('should throw NotFoundException if directory not found', async () => {
      mockPrismaService.fsNode.findUnique.mockResolvedValue(null);

      await expect(service.listDirectory(tenantId, '/nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('copyDirectory', () => {
    it('should throw NotFoundException if source not found', async () => {
      mockPrismaService.fsNode.findUnique.mockResolvedValue(null);

      await expect(
        service.copyDirectory(tenantId, '/nonexistent', '/dest'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when copying into itself', async () => {
      const sourceDir = {
        id: 'dir-1',
        tenantId,
        name: 'source',
        path: '/source',
        type: 'directory',
      };

      mockPrismaService.fsNode.findUnique.mockResolvedValue(sourceDir);

      await expect(
        service.copyDirectory(tenantId, '/source', '/source/child'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if source is not a directory', async () => {
      const sourceFile = {
        id: 'file-1',
        tenantId,
        name: 'source.txt',
        path: '/source.txt',
        type: 'file',
      };

      mockPrismaService.fsNode.findUnique.mockResolvedValue(sourceFile);

      await expect(
        service.copyDirectory(tenantId, '/source.txt', '/dest'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if destination already exists', async () => {
      const sourceDir = {
        id: 'dir-1',
        tenantId,
        name: 'source',
        path: '/source',
        type: 'directory',
      };

      const destDir = {
        id: 'dir-2',
        tenantId,
        name: 'dest',
        path: '/dest',
        type: 'directory',
      };

      mockPrismaService.fsNode.findUnique
        .mockResolvedValueOnce(sourceDir)
        .mockResolvedValueOnce(destDir);

      await expect(
        service.copyDirectory(tenantId, '/source', '/dest'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('moveDirectory', () => {
    it('should move directory and update all paths', async () => {
      const sourceDir = {
        id: 'dir-1',
        tenantId,
        name: 'source',
        path: '/source',
        type: 'directory',
        parentId: null,
      };

      const movedDir = {
        ...sourceDir,
        name: 'dest',
        path: '/dest',
        mimeType: 'inode/directory',
        size: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.fsNode.findUnique
        .mockResolvedValueOnce(sourceDir)  // Source exists
        .mockResolvedValueOnce(null)       // Dest doesn't exist
        .mockResolvedValueOnce(movedDir);  // Final result

      mockPrismaService.fsNode.findMany.mockResolvedValue([]);
      mockPrismaService.fsNode.update.mockResolvedValue(movedDir);

      const result = await service.moveDirectory(tenantId, '/source', '/dest');

      expect(result.path).toBe('/dest');
    });

    it('should throw BadRequestException when moving root', async () => {
      await expect(
        service.moveDirectory(tenantId, '/', '/newroot'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('exists', () => {
    it('should return true if path exists', async () => {
      mockPrismaService.fsNode.findUnique.mockResolvedValue({
        id: 'node-1',
        path: '/test',
      });

      const result = await service.exists(tenantId, '/test');

      expect(result).toBe(true);
    });

    it('should return false if path does not exist', async () => {
      mockPrismaService.fsNode.findUnique.mockResolvedValue(null);

      const result = await service.exists(tenantId, '/nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getInfo', () => {
    it('should return file info', async () => {
      const file = {
        id: 'file-1',
        tenantId,
        name: 'test.txt',
        path: '/test.txt',
        type: 'file',
        size: 100,
        mimeType: 'text/plain',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.fsNode.findUnique.mockResolvedValue(file);

      const result = await service.getInfo(tenantId, '/test.txt');

      expect(result.name).toBe('test.txt');
      expect(result.size).toBe(100);
    });

    it('should throw NotFoundException if path not found', async () => {
      mockPrismaService.fsNode.findUnique.mockResolvedValue(null);

      await expect(service.getInfo(tenantId, '/nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
