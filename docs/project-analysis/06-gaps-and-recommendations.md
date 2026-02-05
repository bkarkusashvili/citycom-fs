# Gaps and Recommendations

This document identifies missing features, gaps in implementation, and provides a prioritized roadmap for improvements.

---

## Gap Summary

| Priority | Gap | Impact | Effort |
|----------|-----|--------|--------|
| 🔴 Critical | Missing copyDirectory | Requirement not met | Low |
| 🔴 Critical | Missing moveDirectory | Requirement not met | Low |
| 🔴 Critical | Incomplete test coverage | Quality risk | Medium |
| 🟡 High | No pagination | Scalability blocker | Medium |
| 🟡 High | No rate limiting | Security risk | Low |
| 🟡 High | No logging | Operations blocker | Medium |
| 🟡 Medium | No CI/CD | Process gap | Medium |
| 🟢 Low | Limited file preview | UX gap | Medium |
| 🟢 Low | No caching | Performance | Medium |
| 🟢 Low | No file versioning | Feature gap | High |

---

## Critical Gaps (Must Fix)

### 1. Missing copyDirectory Operation

**Current State**:
```typescript
@Post('directory/copy')
async copyDirectory() {
  return { message: 'Not implemented yet' };
}
```

**Required**:
- Recursively copy directory and all contents
- Copy all files with blob references
- Maintain directory structure
- Update parent references

**Recommended Implementation**:
```typescript
async copyDirectory(
  tenantId: string,
  sourcePath: string,
  destPath: string
): Promise<void> {
  // 1. Get source directory
  const source = await this.getNodeByPath(tenantId, sourcePath);
  if (!source || source.type !== 'directory') {
    throw new NotFoundException('Source directory not found');
  }

  // 2. Create destination directory
  await this.createDirectory(tenantId, destPath);

  // 3. Get all descendants
  const descendants = await this.getDescendants(tenantId, source.id);

  // 4. Copy each item (directories first, then files)
  for (const item of descendants.sort((a, b) =>
    a.path.split('/').length - b.path.split('/').length
  )) {
    const newPath = item.path.replace(sourcePath, destPath);
    if (item.type === 'directory') {
      await this.createDirectory(tenantId, newPath);
    } else {
      await this.copyFile(tenantId, item.path, newPath);
    }
  }
}
```

**Effort**: 2-4 hours

---

### 2. Missing moveDirectory Operation

**Current State**:
```typescript
@Post('directory/move')
async moveDirectory() {
  return { message: 'Not implemented yet' };
}
```

**Required**:
- Move directory and all contents
- Update paths for all descendants
- Update parent references
- Handle name collisions

**Recommended Implementation**:
```typescript
async moveDirectory(
  tenantId: string,
  sourcePath: string,
  destPath: string
): Promise<void> {
  // 1. Validate move is legal (not moving into self)
  if (destPath.startsWith(sourcePath + '/')) {
    throw new BadRequestException('Cannot move directory into itself');
  }

  // 2. Get source directory
  const source = await this.getNodeByPath(tenantId, sourcePath);
  if (!source || source.type !== 'directory') {
    throw new NotFoundException('Source directory not found');
  }

  // 3. Update source path
  await this.prisma.fsNode.update({
    where: { id: source.id },
    data: {
      path: destPath,
      name: destPath.split('/').pop(),
      parentId: await this.getParentId(tenantId, destPath)
    }
  });

  // 4. Update all descendants' paths
  await this.prisma.$executeRaw`
    UPDATE "FsNode"
    SET path = REPLACE(path, ${sourcePath}, ${destPath})
    WHERE "tenantId" = ${tenantId}
    AND path LIKE ${sourcePath + '/%'}
  `;
}
```

**Effort**: 2-4 hours

---

### 3. Incomplete Test Coverage

**Current State**:
- `fs-provider`: 80% coverage (domain + service)
- `api`: 0% (no controller/service tests)
- `web`: 0% (no component tests)

**Required Test Files**:

```
apps/api/src/
├── auth/
│   ├── auth.controller.spec.ts      # NEW
│   └── auth.service.spec.ts         # NEW
├── filesystem/
│   ├── filesystem.controller.spec.ts # NEW
│   └── filesystem.service.spec.ts    # NEW
└── test/
    └── app.e2e-spec.ts              # NEW

apps/web/src/
├── pages/
│   ├── LoginPage.test.tsx           # NEW
│   ├── RegisterPage.test.tsx        # NEW
│   └── FileBrowserPage.test.tsx     # NEW
└── services/
    └── api.test.ts                  # NEW
```

**Recommended Test Strategy**:

1. **Auth Controller Tests**:
```typescript
describe('AuthController', () => {
  it('should register a new user', async () => {
    const result = await controller.register({
      email: 'test@example.com',
      password: 'password123'
    });
    expect(result.token).toBeDefined();
    expect(result.user.email).toBe('test@example.com');
  });

  it('should reject duplicate email', async () => {
    // ...
  });

  it('should login with valid credentials', async () => {
    // ...
  });

  it('should reject invalid password', async () => {
    // ...
  });
});
```

2. **Filesystem Controller Tests**:
```typescript
describe('FilesystemController', () => {
  it('should create directory', async () => {
    // ...
  });

  it('should list directory contents', async () => {
    // ...
  });

  it('should upload and download file', async () => {
    // ...
  });

  it('should deduplicate identical files', async () => {
    // ...
  });

  it('should delete orphan blobs', async () => {
    // ...
  });
});
```

3. **E2E Tests**:
```typescript
describe('App (e2e)', () => {
  it('full user workflow', async () => {
    // Register
    const { token } = await request(app)
      .post('/auth/register')
      .send({ email: 'e2e@test.com', password: 'password123' });

    // Create directory
    await request(app)
      .post('/fs/directory')
      .set('Authorization', `Bearer ${token}`)
      .send({ path: '/test-folder' });

    // Upload file
    await request(app)
      .post('/fs/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', 'test-file.txt');

    // List directory
    const { body } = await request(app)
      .get('/fs/list?path=/test-folder')
      .set('Authorization', `Bearer ${token}`);

    expect(body.length).toBe(1);
  });
});
```

**Effort**: 2-3 days

---

## High Priority Gaps

### 4. No Pagination for Directory Listing

**Current Problem**:
```typescript
// Returns ALL items - memory bomb for large directories
const children = await this.prisma.fsNode.findMany({
  where: { tenantId, parentId: parent.id }
});
```

**Recommended Solution**:
```typescript
// DTO
class ListDirectoryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 100;

  @IsOptional()
  @IsString()
  cursor?: string;
}

// Service
async listDirectory(
  tenantId: string,
  path: string,
  options: { limit: number; cursor?: string }
): Promise<{ items: FsNode[]; nextCursor?: string }> {
  const where: any = { tenantId, parentId: parent.id };

  if (options.cursor) {
    where.id = { gt: options.cursor };
  }

  const items = await this.prisma.fsNode.findMany({
    where,
    take: options.limit + 1,
    orderBy: { name: 'asc' }
  });

  const hasMore = items.length > options.limit;
  const results = hasMore ? items.slice(0, -1) : items;
  const nextCursor = hasMore ? results[results.length - 1].id : undefined;

  return { items: results, nextCursor };
}
```

**Effort**: 4-6 hours

---

### 5. No Rate Limiting

**Current Problem**: Auth endpoints vulnerable to brute force attacks.

**Recommended Solution**:

```typescript
// Install: npm install @nestjs/throttler

// app.module.ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,      // Time window (seconds)
      limit: 10,    // Max requests per window
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

// auth.controller.ts
@Controller('auth')
export class AuthController {
  @Post('login')
  @Throttle(5, 60)  // 5 attempts per minute for login
  async login(@Body() dto: LoginDto) {
    // ...
  }
}
```

**Effort**: 1-2 hours

---

### 6. No Structured Logging

**Current Problem**: Only `console.log` used, no structured output.

**Recommended Solution**:

```typescript
// Install: npm install winston nest-winston

// logger.config.ts
import * as winston from 'winston';

export const loggerConfig = {
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),
  ],
};

// main.ts
import { WinstonModule } from 'nest-winston';

const app = await NestFactory.create(AppModule, {
  logger: WinstonModule.createLogger(loggerConfig),
});

// Usage in services
@Injectable()
export class FilesystemService {
  private readonly logger = new Logger(FilesystemService.name);

  async createDirectory(tenantId: string, path: string) {
    this.logger.log({
      message: 'Creating directory',
      tenantId,
      path,
    });
    // ...
  }
}
```

**Effort**: 4-6 hours

---

## Medium Priority Gaps

### 7. No CI/CD Pipeline

**Recommended GitHub Actions**:

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - run: npm ci

      - name: Run linting
        run: npm run lint

      - name: Run tests
        run: npm run test -- --coverage
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

      - name: Build
        run: npm run build

  docker:
    needs: test
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Build Docker images
        run: docker-compose build
```

**Effort**: 4-6 hours

---

## Low Priority Gaps

### 8. Limited File Preview

**Current State**: Only text files supported.

**Recommended Enhancements**:

1. **Image Preview** (Frontend):
```typescript
const ImagePreview = ({ url }: { url: string }) => (
  <img
    src={url}
    alt="Preview"
    className="max-w-full max-h-96 object-contain"
  />
);
```

2. **PDF Preview** (using react-pdf):
```typescript
import { Document, Page } from 'react-pdf';

const PDFPreview = ({ url }: { url: string }) => (
  <Document file={url}>
    <Page pageNumber={1} />
  </Document>
);
```

3. **Code Syntax Highlighting** (using highlight.js):
```typescript
import hljs from 'highlight.js';

const CodePreview = ({ content, language }: Props) => (
  <pre>
    <code
      dangerouslySetInnerHTML={{
        __html: hljs.highlight(content, { language }).value
      }}
    />
  </pre>
);
```

**Effort**: 1-2 days

---

### 9. No Caching Layer

**Recommended Solution**:

```typescript
// Install: npm install @nestjs/cache-manager cache-manager

// app.module.ts
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    CacheModule.register({
      ttl: 300,  // 5 minutes
      max: 1000, // Max items
    }),
  ],
})
export class AppModule {}

// filesystem.service.ts
@Injectable()
export class FilesystemService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getInfo(tenantId: string, path: string) {
    const cacheKey = `info:${tenantId}:${path}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const result = await this.fetchFromDb(tenantId, path);
    await this.cacheManager.set(cacheKey, result);

    return result;
  }
}
```

**Effort**: 4-6 hours

---

### 10. No File Versioning

**Database Schema Extension**:
```prisma
model FileVersion {
  id        String   @id @default(uuid())
  fsNodeId  String
  fsNode    FsNode   @relation(fields: [fsNodeId], references: [id])
  blobId    String
  blob      Blob     @relation(fields: [blobId], references: [id])
  version   Int
  createdAt DateTime @default(now())
  createdBy String

  @@unique([fsNodeId, version])
}
```

**Service Extension**:
```typescript
async writeFile(
  tenantId: string,
  path: string,
  content: Buffer,
  options?: { createVersion?: boolean }
) {
  const existing = await this.getNodeByPath(tenantId, path);

  if (existing && options?.createVersion) {
    // Save current as version
    await this.prisma.fileVersion.create({
      data: {
        fsNodeId: existing.id,
        blobId: existing.blobId,
        version: await this.getNextVersion(existing.id),
        createdBy: tenantId,
      },
    });
  }

  // Continue with write...
}
```

**Effort**: 1-2 days

---

## Implementation Roadmap

### Phase 1: Critical (Week 1)
| Task | Effort | Owner |
|------|--------|-------|
| Implement copyDirectory | 4h | Backend |
| Implement moveDirectory | 4h | Backend |
| Add auth controller tests | 4h | Backend |
| Add filesystem controller tests | 8h | Backend |

### Phase 2: High Priority (Week 2)
| Task | Effort | Owner |
|------|--------|-------|
| Add pagination to listDirectory | 6h | Backend |
| Add rate limiting | 2h | Backend |
| Add structured logging | 6h | Backend |
| Add E2E tests | 8h | Backend |

### Phase 3: Medium Priority (Week 3)
| Task | Effort | Owner |
|------|--------|-------|
| Set up CI/CD | 6h | DevOps |
| Add security headers | 2h | Backend |
| Add frontend tests | 8h | Frontend |
| Add health check endpoint | 2h | Backend |

### Phase 4: Low Priority (Week 4+)
| Task | Effort | Owner |
|------|--------|-------|
| Enhanced file preview | 12h | Frontend |
| Add caching layer | 6h | Backend |
| Add audit logging | 8h | Backend |
| Add file versioning | 16h | Full Stack |

---

## Effort Summary

| Priority | Tasks | Total Effort |
|----------|-------|--------------|
| Critical | 4 | 20 hours |
| High | 4 | 22 hours |
| Medium | 4 | 18 hours |
| Low | 4 | 42 hours |
| **Total** | **16** | **102 hours** |

---

## Success Criteria

After implementing recommendations:

| Metric | Current | Target |
|--------|---------|--------|
| Requirements Compliance | 85% | 100% |
| Test Coverage | 50% | 80% |
| Security Score | 70% | 90% |
| Production Readiness | 60% | 85% |
| **Overall Score** | **73%** | **90%** |

---

*Document Version: 1.0*
*Last Updated: 2026-02-05*
