import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma.service';

describe('Citycom File System API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let testUserId: string;

  const testUser = {
    email: `e2e-test-${Date.now()}@example.com`,
    password: 'TestPassword123!',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    // Clean up test user and their data
    if (testUserId) {
      await prisma.fsNode.deleteMany({ where: { tenantId: testUserId } });
      await prisma.user.deleteMany({ where: { id: testUserId } });
    }
    // Clean up orphan blobs
    await prisma.blob.deleteMany({ where: { referenceCount: { lte: 0 } } });
    await app.close();
  });

  describe('Authentication', () => {
    it('/api/auth/register (POST) - should register a new user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.email).toBe(testUser.email);

      authToken = response.body.accessToken;
      testUserId = response.body.user.id;
    });

    it('/api/auth/register (POST) - should reject duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(testUser)
        .expect(409);
    });

    it('/api/auth/login (POST) - should login with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(testUser)
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user.email).toBe(testUser.email);
    });

    it('/api/auth/login (POST) - should reject invalid credentials', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'wrongpassword' })
        .expect(401);
    });
  });

  describe('Directory Operations', () => {
    it('/api/fs/directory (POST) - should create a directory', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/fs/directory')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ path: '/test-folder' })
        .expect(201);

      expect(response.body.path).toBe('/test-folder');
      expect(response.body.name).toBe('test-folder');
    });

    it('/api/fs/directory (POST) - should create nested directories', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/fs/directory')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ path: '/test-folder/nested/deep' })
        .expect(201);

      expect(response.body.path).toBe('/test-folder/nested/deep');
    });

    it('/api/fs/list (GET) - should list directory contents', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/fs/list')
        .query({ path: '/test-folder' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('hasMore');
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    it('/api/fs/list (GET) - should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/fs/list')
        .query({ path: '/', limit: 1 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items.length).toBeLessThanOrEqual(1);
    });
  });

  describe('File Operations', () => {
    const testContent = 'Hello, World! This is test content.';

    it('/api/fs/file (POST) - should write a text file', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/fs/file')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ path: '/test-folder/test.txt', content: testContent })
        .expect(201);

      expect(response.body.path).toBe('/test-folder/test.txt');
      expect(response.body.size).toBe(Buffer.from(testContent, 'utf-8').length);
    });

    it('/api/fs/file (GET) - should read file content', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/fs/file')
        .query({ path: '/test-folder/test.txt' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.content).toBe(testContent);
    });

    it('/api/fs/info (GET) - should get file info', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/fs/info')
        .query({ path: '/test-folder/test.txt' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.name).toBe('test.txt');
      expect(response.body.mimeType).toBe('text/plain');
    });

    it('/api/fs/exists (GET) - should return true for existing path', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/fs/exists')
        .query({ path: '/test-folder/test.txt' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.exists).toBe(true);
    });

    it('/api/fs/exists (GET) - should return false for non-existing path', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/fs/exists')
        .query({ path: '/nonexistent.txt' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.exists).toBe(false);
    });

    it('/api/fs/file/copy (POST) - should copy a file', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/fs/file/copy')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ from: '/test-folder/test.txt', to: '/test-folder/test-copy.txt' })
        .expect(201);

      expect(response.body.path).toBe('/test-folder/test-copy.txt');
    });

    it('/api/fs/file/move (POST) - should move a file', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/fs/file/move')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ from: '/test-folder/test-copy.txt', to: '/test-folder/test-moved.txt' })
        .expect(201);

      expect(response.body.path).toBe('/test-folder/test-moved.txt');
    });

    it('/api/fs/file (DELETE) - should delete a file', async () => {
      await request(app.getHttpServer())
        .delete('/api/fs/file')
        .query({ path: '/test-folder/test-moved.txt' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify it's deleted
      const existsResponse = await request(app.getHttpServer())
        .get('/api/fs/exists')
        .query({ path: '/test-folder/test-moved.txt' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(existsResponse.body.exists).toBe(false);
    });
  });

  describe('Directory Copy/Move', () => {
    beforeAll(async () => {
      // Create a directory with files for copy/move tests
      await request(app.getHttpServer())
        .post('/api/fs/directory')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ path: '/source-dir' });

      await request(app.getHttpServer())
        .post('/api/fs/file')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ path: '/source-dir/file1.txt', content: 'File 1 content' });

      await request(app.getHttpServer())
        .post('/api/fs/file')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ path: '/source-dir/file2.txt', content: 'File 2 content' });
    });

    it('/api/fs/directory/copy (POST) - should copy a directory', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/fs/directory/copy')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ from: '/source-dir', to: '/copied-dir' })
        .expect(201);

      expect(response.body.path).toBe('/copied-dir');

      // Verify files were copied
      const listResponse = await request(app.getHttpServer())
        .get('/api/fs/list')
        .query({ path: '/copied-dir' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(listResponse.body.items.length).toBe(2);
    });

    it('/api/fs/directory/move (POST) - should move a directory', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/fs/directory/move')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ from: '/copied-dir', to: '/moved-dir' })
        .expect(201);

      expect(response.body.path).toBe('/moved-dir');

      // Verify old location doesn't exist
      const existsResponse = await request(app.getHttpServer())
        .get('/api/fs/exists')
        .query({ path: '/copied-dir' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(existsResponse.body.exists).toBe(false);
    });
  });

  describe('Content Deduplication', () => {
    const duplicateContent = 'This content will be stored once despite multiple files.';

    it('should deduplicate identical file content', async () => {
      // Create two files with the same content
      await request(app.getHttpServer())
        .post('/api/fs/file')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ path: '/dedup-test-1.txt', content: duplicateContent })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/fs/file')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ path: '/dedup-test-2.txt', content: duplicateContent })
        .expect(201);

      // Both files should exist and have the same content
      const file1 = await request(app.getHttpServer())
        .get('/api/fs/file')
        .query({ path: '/dedup-test-1.txt' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const file2 = await request(app.getHttpServer())
        .get('/api/fs/file')
        .query({ path: '/dedup-test-2.txt' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(file1.body.content).toBe(duplicateContent);
      expect(file2.body.content).toBe(duplicateContent);
    });
  });

  describe('Authorization', () => {
    it('should reject requests without token', async () => {
      await request(app.getHttpServer())
        .get('/api/fs/list')
        .query({ path: '/' })
        .expect(401);
    });

    it('should reject requests with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/api/fs/list')
        .query({ path: '/' })
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('Cleanup', () => {
    it('/api/fs/directory (DELETE) - should delete test directories', async () => {
      // Delete test directories created during tests
      await request(app.getHttpServer())
        .delete('/api/fs/directory')
        .query({ path: '/test-folder' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .delete('/api/fs/directory')
        .query({ path: '/source-dir' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .delete('/api/fs/directory')
        .query({ path: '/moved-dir' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Delete dedup test files
      await request(app.getHttpServer())
        .delete('/api/fs/file')
        .query({ path: '/dedup-test-1.txt' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .delete('/api/fs/file')
        .query({ path: '/dedup-test-2.txt' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });
  });
});
