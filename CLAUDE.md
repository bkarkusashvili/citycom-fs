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
| [05-quality-score.md](docs/project-analysis/05-quality-score.md) | Quality metrics (current: 73/100) |
| [06-gaps-and-recommendations.md](docs/project-analysis/06-gaps-and-recommendations.md) | Missing features and roadmap |

**Keep these docs updated** when making changes to the codebase.

---

## Current Status

### Quality Score: 73/100 (Grade B-)

| Dimension | Score | Target |
|-----------|-------|--------|
| Requirements | 85% | 100% |
| Architecture | 90% | 95% |
| Code Quality | 85% | 90% |
| Security | 70% | 90% |
| Test Coverage | 50% | 80% |
| Production Readiness | 60% | 85% |

### Requirements Compliance: 85%

**Met**: 36/39 requirements
**Missing**: 2 critical, 1 partial

---

## Critical Issues to Fix

### 1. Implement copyDirectory (REQUIRED)

**File**: `apps/api/src/filesystem/filesystem.service.ts`

Current state returns "Not implemented yet". Must:
- Recursively copy directory and all contents
- Copy files with blob reference counting
- Maintain directory structure

### 2. Implement moveDirectory (REQUIRED)

**File**: `apps/api/src/filesystem/filesystem.service.ts`

Current state returns "Not implemented yet". Must:
- Move directory and update all descendant paths
- Prevent moving directory into itself
- Update parent references

### 3. Add Pagination to listDirectory (REQUIRED for scalability)

**File**: `apps/api/src/filesystem/filesystem.service.ts`

Current `listDirectory` returns ALL items. For millions of files requirement:
- Add `limit` and `cursor` parameters
- Return `{ items, nextCursor }` response
- Update frontend to handle pagination

### 4. Add Missing Tests (REQUIRED)

**Missing test files**:
```
apps/api/src/auth/auth.controller.spec.ts
apps/api/src/auth/auth.service.spec.ts
apps/api/src/filesystem/filesystem.controller.spec.ts
apps/api/src/filesystem/filesystem.service.spec.ts
apps/api/test/app.e2e-spec.ts
apps/web/src/**/*.test.tsx
```

**Target**: 80% coverage across all packages

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
- [ ] Rate limiting on auth endpoints
- [ ] Security headers (CSP, HSTS)
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

## When Making Changes

1. **Before coding**: Check requirements in [01-requirements-compliance.md](docs/project-analysis/01-requirements-compliance.md)
2. **Follow patterns**: Match existing architecture in [02-architecture-overview.md](docs/project-analysis/02-architecture-overview.md)
3. **Write tests**: Add tests for new functionality
4. **Update docs**: Keep project-analysis docs current
5. **Run checks**: `npm run lint && npm run test && npm run build`

---

## Priority Tasks

### Phase 1: Critical (Must Complete)
1. [ ] Implement `copyDirectory` in filesystem.service.ts
2. [ ] Implement `moveDirectory` in filesystem.service.ts
3. [ ] Add pagination to `listDirectory`
4. [ ] Write auth controller/service tests
5. [ ] Write filesystem controller/service tests

### Phase 2: High Priority
6. [ ] Add rate limiting (`@nestjs/throttler`)
7. [ ] Add structured logging (Winston)
8. [ ] Add E2E tests
9. [ ] Set up CI/CD (GitHub Actions)

### Phase 3: Improvements
10. [ ] Expand file preview (images, PDF)
11. [ ] Add caching layer
12. [ ] Add security headers
13. [ ] Add health check endpoint

---

## Updating Documentation

When you complete tasks or make significant changes:

1. Update [01-requirements-compliance.md](docs/project-analysis/01-requirements-compliance.md) if requirements status changes
2. Update [05-quality-score.md](docs/project-analysis/05-quality-score.md) if metrics improve
3. Update [06-gaps-and-recommendations.md](docs/project-analysis/06-gaps-and-recommendations.md) to mark completed items
4. Update this CLAUDE.md if architecture or commands change

---

*Last Updated: 2026-02-05*
*Quality Score: 73/100 → Target: 90/100*
