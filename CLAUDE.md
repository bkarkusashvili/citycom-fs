# CLAUDE.md - Citycom File System

## Project Overview

Citycom is a **multi-tenant blob store database-based file system provider** with:
- RESTful Web API (NestJS)
- React Frontend
- PostgreSQL metadata storage
- Content-addressable blob storage with SHA-256 deduplication
- JWT-based authentication

## Quick Reference

| Item | Location |
|------|----------|
| API Server | `apps/api/` |
| Web Frontend | `apps/web/` |
| Core Library | `packages/fs-provider/` |
| Database Schema | `apps/api/prisma/schema.prisma` |
| Docker Setup | `docker-compose.yml` |
| Project Analysis | `docs/project-analysis/` |

## Commands

```bash
# Development
npm run dev:api          # Start API server (port 3000)
npm run dev:web          # Start frontend (port 5173)

# Build & Test
npm run build            # Build all packages
npm run test             # Run all tests
npm run lint             # Lint TypeScript files
npm run format           # Format with Prettier

# Database
cd apps/api
npx prisma migrate dev   # Run migrations
npx prisma studio        # Open DB GUI

# Docker
docker-compose up -d     # Start all services
docker-compose down      # Stop all services
```

## Project Documentation

All analysis documents are in [docs/project-analysis/](docs/project-analysis/):

| Document | Purpose |
|----------|---------|
| [01-requirements-compliance.md](docs/project-analysis/01-requirements-compliance.md) | Requirements checklist and status |
| [02-architecture-overview.md](docs/project-analysis/02-architecture-overview.md) | System architecture and tech stack |
| [03-solution-rationale.md](docs/project-analysis/03-solution-rationale.md) | Technology decisions and trade-offs |
| [04-pros-and-cons.md](docs/project-analysis/04-pros-and-cons.md) | Strengths and weaknesses |
| [05-quality-score.md](docs/project-analysis/05-quality-score.md) | Quality metrics (current: 84/100) |
| [06-gaps-and-recommendations.md](docs/project-analysis/06-gaps-and-recommendations.md) | Missing features and roadmap |

**Keep these docs updated** when making changes to the codebase.

---

## Current Status

### Quality Score: 89/100 (Grade A-)

| Dimension | Score | Target |
|-----------|-------|--------|
| Requirements | 97% | 100% |
| Architecture | 92% | 95% |
| Code Quality | 88% | 90% |
| Security | 85% | 90% |
| Test Coverage | 85% | 80% |
| Production Readiness | 80% | 85% |

### Requirements Compliance: 97%

**Met**: 38/39 requirements
**Partial**: 1 (file preview limited to text)

---

## Recently Completed (2026-02-05)

### Phase 1 ✅
- [x] **copyDirectory** - Recursive directory copy with blob reference counting
- [x] **moveDirectory** - Recursive move with path updates, self-reference prevention
- [x] **Pagination** - `listDirectory` supports `limit` and `cursor` parameters
- [x] **Rate limiting** - Global throttling + stricter limits on auth endpoints
- [x] **Unit Tests** - Auth and filesystem controller/service tests (46 tests passing)

### Phase 2 ✅
- [x] **Structured Logging** - Winston logger with dev/prod configs
- [x] **E2E Tests** - Full workflow tests (22 tests passing)
- [x] **CI/CD Pipeline** - GitHub Actions with lint, test, build, docker stages
- [x] **Frontend Pagination** - Infinite query with "Load More" button

## Remaining Tasks

### High Priority

1. **Split Large Files** - `filesystem.service.ts` (724 lines) needs refactoring
2. **Frontend Tests** - React component tests
3. **Security Headers** - CSP, HSTS

### Medium Priority

4. **Enhanced File Preview** - Support images, PDF
5. **Health Check Endpoint** - `/health` for container orchestration
6. **Caching Layer** - Redis for frequently accessed data

---

## Architecture

```
citycom-fs/
├── packages/
│   └── fs-provider/           # Core reusable library (DDD)
│       ├── src/domain/        # Entities, Value Objects, Repositories
│       ├── src/application/   # IFsProvider interface, services
│       └── src/infrastructure/# Storage implementations
├── apps/
│   ├── api/                   # NestJS backend
│   │   ├── src/auth/         # JWT authentication
│   │   ├── src/filesystem/   # File operations
│   │   └── prisma/           # Database schema
│   └── web/                   # React frontend
│       ├── src/pages/        # Login, Register, FileBrowser
│       └── src/services/     # API client
└── docs/
    └── project-analysis/      # Project documentation
```

## Design Principles

### Domain-Driven Design (DDD)
- **Entities**: FsNode, File, Directory, Blob
- **Value Objects**: Path, ContentHash, MimeType
- **Repositories**: IFsNodeRepository, IBlobRepository
- **Domain Services**: IBlobStorage

### SOLID Principles
- **S**: Each class has single responsibility
- **O**: Storage providers extend interfaces
- **L**: All FsNode types are substitutable
- **I**: Separate interfaces for different concerns
- **D**: Depend on abstractions (IFsProvider, IBlobStorage)

### Content-Addressable Storage
- Files stored by SHA-256 hash
- Duplicate content stored once
- Reference counting for cleanup
- Automatic orphan blob deletion

### Multi-Tenancy
- `tenantId` on all FsNode records
- Database unique constraint: `(tenantId, path)`
- All queries filtered by tenant
- No cross-tenant data access possible

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login, get JWT |

### Directory Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/fs/directory` | Create directory |
| DELETE | `/api/fs/directory?path=` | Delete directory (recursive) |
| GET | `/api/fs/list?path=` | List contents |
| POST | `/api/fs/directory/copy` | Copy directory **[NOT IMPLEMENTED]** |
| POST | `/api/fs/directory/move` | Move directory **[NOT IMPLEMENTED]** |

### File Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/fs/file` | Write text file |
| POST | `/api/fs/upload` | Upload binary file |
| GET | `/api/fs/file?path=` | Read text file |
| GET | `/api/fs/download?path=` | Download binary |
| DELETE | `/api/fs/file?path=` | Delete file |
| POST | `/api/fs/file/copy` | Copy file |
| POST | `/api/fs/file/move` | Move file |

### Common
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/fs/info?path=` | Get metadata |
| GET | `/api/fs/exists?path=` | Check existence |

---

## Database Schema

```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  fsNodes      FsNode[]
}

model FsNode {
  id        String    @id @default(uuid())
  tenantId  String
  name      String
  path      String
  type      String    // 'file' | 'directory'
  parentId  String?
  blobId    String?
  size      Int       @default(0)
  mimeType  String?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@unique([tenantId, path])
  @@index([tenantId, parentId])
}

model Blob {
  id              String   @id @default(uuid())
  contentHash     String   @unique
  size            Int
  storageProvider String
  storagePath     String
  referenceCount  Int      @default(1)
}
```

---

## Environment Variables

```bash
# apps/api/.env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/citycom_fs
JWT_SECRET=your-secret-key-min-32-chars-in-production
JWT_EXPIRES_IN=7d
PORT=3000
CORS_ORIGIN=http://localhost:5173
BLOB_STORAGE_PATH=./data/blobs
```

---

## Testing Guidelines

### Unit Tests
- Test domain logic in isolation
- Mock external dependencies
- Use in-memory repositories for fs-provider tests

### Integration Tests
- Test API endpoints with real database
- Use test database (separate from dev)
- Clean up data between tests

### E2E Tests
- Test complete user workflows
- Register → Login → Create folder → Upload file → Download

### Coverage Requirements
- **fs-provider**: 80% minimum
- **api**: 80% minimum (target)
- **web**: 70% minimum (target)

---

## Security Checklist

- [x] Password hashing with bcrypt (10 rounds)
- [x] JWT authentication with expiration
- [x] Tenant isolation in database
- [x] Input validation with class-validator
- [x] Path traversal prevention
- [x] Rate limiting on auth endpoints (3 reg/min, 5 login/min)
- [x] Global rate limiting (10/s, 100/min, 1000/hr)
- [x] Security headers (helmet: CSP, HSTS, X-Frame-Options, etc.)
- [ ] Strong JWT secret in production
- [ ] HTTPS enforcement

---

## Code Style

### TypeScript
- Strict mode enabled
- No `any` types (use `unknown` if needed)
- Explicit return types on public methods
- Use value objects for domain concepts

### Naming
- **Files**: kebab-case (`filesystem.service.ts`)
- **Classes**: PascalCase (`FilesystemService`)
- **Methods**: camelCase (`createDirectory`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_FILE_SIZE`)

### Error Handling
- Use NestJS exceptions (`NotFoundException`, `BadRequestException`)
- Include meaningful error messages
- Log errors with context

---

## Large Files Analysis

Files over 200 lines that should be refactored:

### 1. `apps/api/src/filesystem/filesystem.service.ts` (724 lines) - HIGH PRIORITY

**Problem**: Monolithic service handling all filesystem operations
**Solution**: Split into focused services

| New File | Lines | Methods |
|----------|-------|---------|
| `directory.service.ts` | ~200 | `createDirectory`, `deleteDirectory`, `listDirectory`, `copyDirectory`, `moveDirectory` |
| `file.service.ts` | ~180 | `writeFile`, `readFile`, `deleteFile`, `copyFile`, `moveFile` |
| `blob.service.ts` | ~120 | `storeBlobContent`, `decrementBlobRef`, `getMimeType`, blob cleanup |
| `filesystem.service.ts` | ~100 | Facade composing above + `exists`, `getInfo`, path utilities |

### 2. `packages/fs-provider/src/application/services/FsProviderService.ts` (527 lines)

**Problem**: Similar monolithic pattern in core library
**Solution**: Apply same split pattern with DDD boundaries

### 3. `apps/web/src/pages/FileBrowserPage.tsx` (427 lines)

**Problem**: Large React component with mixed concerns
**Solution**: Extract reusable components

| Component | Purpose |
|-----------|---------|
| `FileTable.tsx` | Table rendering with columns |
| `FileRow.tsx` | Single file/folder row |
| `Breadcrumb.tsx` | Path navigation |
| `NewFolderModal.tsx` | Folder creation dialog |
| `FilePreviewModal.tsx` | File content preview |
| `useFileOperations.ts` | Custom hook for mutations |

### 4. Other Notable Files

| File | Lines | Status |
|------|-------|--------|
| `filesystem.service.spec.ts` | 370 | OK - test file, can be large |
| `app.e2e-spec.ts` | 371 | OK - test file |
| `filesystem.controller.spec.ts` | 221 | OK - test file |
| `filesystem.controller.ts` | 209 | OK - acceptable size |
| `InMemoryFsNodeRepository.ts` | 181 | OK - single responsibility |

---

## When Making Changes

1. **Before coding**: Check requirements in [01-requirements-compliance.md](docs/project-analysis/01-requirements-compliance.md)
2. **Follow patterns**: Match existing architecture in [02-architecture-overview.md](docs/project-analysis/02-architecture-overview.md)
3. **Write tests**: Add tests for new functionality
4. **Update docs**: Keep project-analysis docs current
5. **Run checks**: `npm run lint && npm run test && npm run build`

---

## Priority Tasks

### Phase 1: Critical (Completed)
1. [x] Implement `copyDirectory` in filesystem.service.ts
2. [x] Implement `moveDirectory` in filesystem.service.ts
3. [x] Add pagination to `listDirectory`
4. [x] Write auth controller/service tests
5. [x] Write filesystem controller/service tests
6. [x] Add rate limiting (`@nestjs/throttler`)

### Phase 2: High Priority (Completed)
7. [x] Add structured logging (Winston)
8. [x] Add E2E tests (22 tests)
9. [x] Set up CI/CD (GitHub Actions)
10. [x] Update frontend for pagination support

### Phase 3: Code Quality (Refactoring Large Files)
11. [ ] Split `filesystem.service.ts` (724 lines) → directory.service.ts, file.service.ts, blob.service.ts
12. [ ] Split `FsProviderService.ts` (527 lines) → separate directory/file services
13. [ ] Split `FileBrowserPage.tsx` (427 lines) → extract components
14. [ ] Add security headers (helmet middleware)
15. [ ] Add frontend tests (React Testing Library)

### Phase 4: Enhancements
16. [ ] Expand file preview (images, PDF)
17. [ ] Add caching layer (Redis)
18. [ ] Add health check endpoint (`/health`)
19. [ ] Add metrics/monitoring (Prometheus)
20. [ ] Add drag-and-drop file upload

---

## Updating Documentation

When you complete tasks or make significant changes:

1. Update [01-requirements-compliance.md](docs/project-analysis/01-requirements-compliance.md) if requirements status changes
2. Update [05-quality-score.md](docs/project-analysis/05-quality-score.md) if metrics improve
3. Update [06-gaps-and-recommendations.md](docs/project-analysis/06-gaps-and-recommendations.md) to mark completed items
4. Update this CLAUDE.md if architecture or commands change

---

*Last Updated: 2026-02-05*
*Quality Score: 89/100 → Target: 90/100*
