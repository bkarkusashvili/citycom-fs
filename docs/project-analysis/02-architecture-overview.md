# Architecture Overview

This document describes the system architecture, technology stack, and design patterns used in the Citycom File System.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     React Frontend (Vite)                            │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │    │
│  │  │  Login   │  │ Register │  │  File    │  │   Auth Context   │    │    │
│  │  │  Page    │  │  Page    │  │ Browser  │  │  (JWT Storage)   │    │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘    │    │
│  │                         │                                            │    │
│  │                    ┌────▼────┐                                       │    │
│  │                    │  Axios  │ ◄── JWT Token Injection               │    │
│  │                    │ Client  │                                       │    │
│  │                    └────┬────┘                                       │    │
│  └─────────────────────────┼───────────────────────────────────────────┘    │
└────────────────────────────┼────────────────────────────────────────────────┘
                             │ HTTP/REST
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     NestJS Application                               │    │
│  │                                                                      │    │
│  │  ┌─────────────────┐     ┌─────────────────────────────────────┐   │    │
│  │  │   Auth Module   │     │        Filesystem Module            │   │    │
│  │  │  ┌───────────┐  │     │  ┌───────────┐  ┌───────────────┐  │   │    │
│  │  │  │Controller │  │     │  │Controller │  │    Service    │  │   │    │
│  │  │  │ /register │  │     │  │  14 REST  │  │  Business     │  │   │    │
│  │  │  │ /login    │  │     │  │ Endpoints │  │  Logic        │  │   │    │
│  │  │  └─────┬─────┘  │     │  └─────┬─────┘  └───────┬───────┘  │   │    │
│  │  │        │        │     │        │                │          │   │    │
│  │  │  ┌─────▼─────┐  │     │        │          ┌─────▼─────┐   │   │    │
│  │  │  │  Service  │  │     │        │          │   Prisma  │   │   │    │
│  │  │  │  JWT Gen  │  │     │        │          │   Client  │   │   │    │
│  │  │  │  bcrypt   │  │     │        │          └───────────┘   │   │    │
│  │  │  └───────────┘  │     │        │                          │   │    │
│  │  └─────────────────┘     └────────┼──────────────────────────┘   │    │
│  │                                   │                               │    │
│  │  ┌────────────────────────────────┼─────────────────────────┐    │    │
│  │  │              Infrastructure Module                        │    │    │
│  │  │  ┌─────────────────┐    ┌─────▼─────────────────────┐    │    │    │
│  │  │  │  PrismaService  │────│   PostgreSQL Database     │    │    │    │
│  │  │  │  (Global)       │    │   - Users                 │    │    │    │
│  │  │  └─────────────────┘    │   - FsNodes               │    │    │    │
│  │  │                         │   - Blobs                 │    │    │    │
│  │  └─────────────────────────┴───────────────────────────┘    │    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            STORAGE LAYER                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      Blob Storage                                    │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │    │
│  │  │  Local Files    │  │  S3 / MinIO     │  │  Database BLOB  │     │    │
│  │  │  ./data/blobs/  │  │  (Optional)     │  │  (Planned)      │     │    │
│  │  │  {hash[0:2]}/   │  │                 │  │                 │     │    │
│  │  │  {full-hash}    │  │                 │  │                 │     │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Backend

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Runtime | Node.js | 18+ | JavaScript runtime |
| Framework | NestJS | 10.3.0 | Enterprise Node.js framework |
| Language | TypeScript | 5.3.0 | Type-safe JavaScript |
| ORM | Prisma | 5.7.0 | Type-safe database access |
| Database | PostgreSQL | 16 | Relational database |
| Auth | Passport.js | 0.7.0 | Authentication middleware |
| JWT | @nestjs/jwt | 10.2.0 | Token generation/validation |
| Hashing | bcrypt | 5.1.1 | Password hashing |
| Validation | class-validator | 0.14.0 | DTO validation |
| API Docs | @nestjs/swagger | 7.1.17 | OpenAPI documentation |
| File Upload | Multer | 1.4.5 | Multipart form handling |

### Frontend

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Framework | React | 18.2.0 | UI library |
| Build Tool | Vite | 5.0.8 | Fast bundler |
| Language | TypeScript | 5.3.0 | Type-safe JavaScript |
| Routing | React Router | 6.21.0 | Client-side routing |
| HTTP Client | Axios | 1.6.2 | API requests |
| State | TanStack Query | 5.14.0 | Server state management |
| Styling | TailwindCSS | 3.3.6 | Utility-first CSS |
| Icons | lucide-react | 0.294.0 | Icon library |

### Infrastructure

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Containers | Docker | 24+ | Containerization |
| Orchestration | Docker Compose | 2.x | Multi-container apps |
| Web Server | Nginx | Alpine | Static file serving |
| Object Storage | MinIO | Latest | S3-compatible storage (optional) |

### Development

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Package Manager | npm | 9+ | Dependency management |
| Workspaces | npm workspaces | - | Monorepo support |
| Testing | Jest | 29.7.0 | Unit/integration tests |
| Linting | ESLint | 8.55.0 | Code quality |
| Formatting | Prettier | 3.1.0 | Code formatting |

---

## Project Structure

```
citycom-fs/
├── packages/
│   └── fs-provider/                 # Core reusable library
│       ├── src/
│       │   ├── domain/              # Business rules
│       │   │   ├── entities/        # FsNode, File, Directory, Blob
│       │   │   ├── value-objects/   # Path, ContentHash, MimeType
│       │   │   ├── repositories/    # IFsNodeRepository, IBlobRepository
│       │   │   └── services/        # IBlobStorage interface
│       │   ├── application/         # Use cases
│       │   │   ├── IFsProvider.ts   # Public interface
│       │   │   └── FsProviderService.ts
│       │   └── infrastructure/      # Implementations
│       │       ├── repositories/    # InMemory implementations
│       │       └── storage/         # LocalBlobStorage
│       ├── tests/                   # Unit tests
│       └── package.json
│
├── apps/
│   ├── api/                         # NestJS backend
│   │   ├── src/
│   │   │   ├── auth/               # Authentication module
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   └── dto/
│   │   │   ├── filesystem/         # File system module
│   │   │   │   ├── filesystem.controller.ts
│   │   │   │   ├── filesystem.service.ts
│   │   │   │   └── dto/
│   │   │   ├── infrastructure/     # Database module
│   │   │   │   └── prisma.service.ts
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma       # Database schema
│   │   │   └── migrations/
│   │   ├── data/
│   │   │   └── blobs/              # Blob storage
│   │   └── Dockerfile
│   │
│   └── web/                         # React frontend
│       ├── src/
│       │   ├── pages/
│       │   │   ├── LoginPage.tsx
│       │   │   ├── RegisterPage.tsx
│       │   │   └── FileBrowserPage.tsx
│       │   ├── services/
│       │   │   └── api.ts          # Axios client
│       │   ├── contexts/
│       │   │   └── AuthContext.tsx
│       │   ├── types/
│       │   │   └── index.ts
│       │   ├── App.tsx
│       │   └── main.tsx
│       ├── nginx.conf
│       └── Dockerfile
│
├── docker-compose.yml
├── package.json                     # Workspace root
└── tsconfig.json
```

---

## Design Patterns

### 1. Domain-Driven Design (DDD)

The `fs-provider` library follows DDD principles:

**Entities** - Objects with identity and lifecycle:
- `FsNode` - Abstract base for file system entries
- `File` - File entity with blob reference
- `Directory` - Directory entity
- `Blob` - Content storage with reference counting

**Value Objects** - Immutable objects defined by attributes:
- `Path` - Validated, normalized file path
- `ContentHash` - SHA-256 hash wrapper
- `MimeType` - File type with validation

**Repositories** - Data access abstraction:
- `IFsNodeRepository` - CRUD for file system nodes
- `IBlobRepository` - CRUD for blob storage

**Domain Services** - Business logic:
- `IBlobStorage` - Blob storage operations

### 2. Repository Pattern

```typescript
// Interface (domain layer)
interface IFsNodeRepository {
  findByPath(tenantId: string, path: string): Promise<FsNode | null>;
  findByParent(tenantId: string, parentId: string): Promise<FsNode[]>;
  save(node: FsNode): Promise<void>;
  delete(id: string): Promise<void>;
}

// Implementation (infrastructure layer)
class PrismaFsNodeRepository implements IFsNodeRepository {
  constructor(private prisma: PrismaClient) {}
  // ... implementations
}
```

### 3. Factory Pattern

Entities use static factory methods for construction:

```typescript
class File extends FsNode {
  static create(props: CreateFileProps): File {
    // Validate and construct
    return new File({ ...props, createdAt: new Date() });
  }

  static reconstitute(props: FileProps): File {
    // Reconstruct from persistence
    return new File(props);
  }
}
```

### 4. Dependency Injection

NestJS modules use constructor injection:

```typescript
@Injectable()
export class FilesystemService {
  constructor(private prisma: PrismaService) {}
}

@Controller('fs')
export class FilesystemController {
  constructor(private filesystemService: FilesystemService) {}
}
```

### 5. Content-Addressable Storage

Files are stored by content hash for deduplication:

```
Content: "Hello, World!"
    │
    ▼ SHA-256
Hash: "dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f"
    │
    ▼ Storage Path
./data/blobs/df/dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f
```

### 6. Multi-Tenancy

Each user's data is isolated by `tenantId`:

```sql
-- Database constraint ensures unique paths per tenant
CREATE UNIQUE INDEX ON "FsNode" ("tenantId", "path");

-- All queries filter by tenant
SELECT * FROM "FsNode" WHERE "tenantId" = $1 AND "path" = $2;
```

---

## Data Model

### Database Schema (ERD)

```
┌─────────────────────────────┐
│           User              │
├─────────────────────────────┤
│ id: UUID (PK)               │
│ email: String (UNIQUE)      │
│ passwordHash: String        │
│ createdAt: DateTime         │
│ updatedAt: DateTime         │
└──────────────┬──────────────┘
               │ 1:N
               ▼
┌─────────────────────────────┐       ┌─────────────────────────────┐
│          FsNode             │       │           Blob              │
├─────────────────────────────┤       ├─────────────────────────────┤
│ id: UUID (PK)               │       │ id: UUID (PK)               │
│ tenantId: UUID (FK→User)    │  N:1  │ contentHash: String (UNIQUE)│
│ name: String                │◄──────│ size: Int                   │
│ path: String                │       │ storageProvider: String     │
│ type: 'file' | 'directory'  │       │ storagePath: String         │
│ parentId: UUID (self-ref)   │       │ referenceCount: Int         │
│ blobId: UUID (FK→Blob)?     │       │ createdAt: DateTime         │
│ size: Int                   │       └─────────────────────────────┘
│ mimeType: String?           │
│ createdAt: DateTime         │
│ updatedAt: DateTime         │
└─────────────────────────────┘
```

### Indices

```sql
-- Fast tenant + path lookups
CREATE UNIQUE INDEX ON "FsNode" ("tenantId", "path");

-- Fast directory listing
CREATE INDEX ON "FsNode" ("tenantId", "parentId");

-- Deduplication lookup
CREATE UNIQUE INDEX ON "Blob" ("contentHash");
```

---

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login and get JWT |

### Directory Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/fs/directory` | Create directory |
| DELETE | `/api/fs/directory` | Delete directory (recursive) |
| GET | `/api/fs/list` | List directory contents |
| POST | `/api/fs/directory/copy` | Copy directory (not implemented) |
| POST | `/api/fs/directory/move` | Move directory (not implemented) |

### File Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/fs/file` | Write text file |
| POST | `/api/fs/upload` | Upload binary file |
| GET | `/api/fs/file` | Read text file |
| GET | `/api/fs/download` | Download binary file |
| DELETE | `/api/fs/file` | Delete file |
| POST | `/api/fs/file/copy` | Copy file |
| POST | `/api/fs/file/move` | Move/rename file |

### Common Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/fs/info` | Get file/directory info |
| GET | `/api/fs/exists` | Check if path exists |

---

## Authentication Flow

```
┌──────────┐                    ┌──────────┐                    ┌──────────┐
│  Client  │                    │   API    │                    │    DB    │
└────┬─────┘                    └────┬─────┘                    └────┬─────┘
     │                               │                               │
     │ POST /auth/register           │                               │
     │ {email, password}             │                               │
     │──────────────────────────────►│                               │
     │                               │ Hash password (bcrypt)        │
     │                               │─────────────────────────────► │
     │                               │ Store User                    │
     │                               │ ◄─────────────────────────────│
     │                               │ Generate JWT                  │
     │ {token, user}                 │                               │
     │◄──────────────────────────────│                               │
     │                               │                               │
     │ GET /fs/list (with JWT)       │                               │
     │ Authorization: Bearer xxx     │                               │
     │──────────────────────────────►│                               │
     │                               │ Validate JWT                  │
     │                               │ Extract userId                │
     │                               │─────────────────────────────► │
     │                               │ Query FsNode WHERE tenantId   │
     │                               │ ◄─────────────────────────────│
     │ {files, directories}          │                               │
     │◄──────────────────────────────│                               │
     │                               │                               │
```

---

## Deployment Architecture

### Docker Compose Setup

```yaml
services:
  postgres:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready"]

  api:
    build: ./apps/api
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - blob_data:/app/apps/api/data/blobs
    environment:
      - DATABASE_URL=postgresql://...
      - JWT_SECRET=...

  web:
    build: ./apps/web
    depends_on:
      - api
    ports:
      - "80:80"

  minio:  # Optional S3 storage
    image: minio/minio
    profiles: ["s3"]
```

### Network Topology

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Network                            │
│                                                              │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐               │
│  │   web   │────►│   api   │────►│postgres │               │
│  │  :80    │     │  :3000  │     │  :5432  │               │
│  └─────────┘     └────┬────┘     └─────────┘               │
│                       │                                      │
│                       ▼                                      │
│                 ┌─────────┐                                  │
│                 │  minio  │  (optional)                      │
│                 │  :9000  │                                  │
│                 └─────────┘                                  │
└─────────────────────────────────────────────────────────────┘
```

---

*Document Version: 1.0*
*Last Updated: 2026-02-05*
