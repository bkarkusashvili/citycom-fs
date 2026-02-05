# Architecture Deep Dive

## Domain-Driven Design Implementation

### Bounded Contexts

```
┌─────────────────────────────────────────────────────────────────┐
│                      CITYCOM FILE SYSTEM                         │
├─────────────────────┬─────────────────────┬─────────────────────┤
│   AUTH CONTEXT      │   FILESYSTEM CONTEXT │   STORAGE CONTEXT   │
│                     │                      │                     │
│ • User Entity       │ • FsNode Entity      │ • Blob Entity       │
│ • Registration      │ • Directory Ops      │ • Storage Provider  │
│ • Authentication    │ • File Ops           │ • Deduplication     │
│ • JWT Tokens        │ • Version History    │ • Orphan Cleanup    │
└─────────────────────┴─────────────────────┴─────────────────────┘
```

---

## SOLID Principles Applied

### Single Responsibility
```typescript
// Each service has ONE job
FilesystemService      → Coordinates file operations
DirectoryService       → Directory-specific logic
FileService            → File-specific logic
BlobService            → Blob storage management
CacheService           → Caching operations
```

### Open/Closed Principle
```typescript
// Storage providers extend without modifying core
interface StorageProvider {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

// Implementations
class LocalStorageProvider implements StorageProvider { }
class S3StorageProvider implements StorageProvider { }
class MinioStorageProvider implements StorageProvider { }
```

### Liskov Substitution
```typescript
// Any storage provider works interchangeably
const storage: StorageProvider =
  process.env.STORAGE_TYPE === 's3'
    ? new S3StorageProvider()
    : new LocalStorageProvider();
```

### Interface Segregation
```typescript
// Focused interfaces, not monolithic
interface FsReader {
  readFile(path: string): Promise<Buffer>;
  listDirectory(path: string): Promise<FsNode[]>;
}

interface FsWriter {
  writeFile(path: string, content: Buffer): Promise<void>;
  createDirectory(path: string): Promise<void>;
}
```

### Dependency Inversion
```typescript
// High-level modules depend on abstractions
class FilesystemService {
  constructor(
    private readonly storage: StorageProvider,    // Abstraction
    private readonly repository: FsNodeRepository, // Abstraction
  ) {}
}
```

---

## Layered Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                            │
│  Controllers • DTOs • Validation • Swagger                      │
├─────────────────────────────────────────────────────────────────┤
│                    APPLICATION LAYER                             │
│  Use Cases • Orchestration • Transaction Management             │
├─────────────────────────────────────────────────────────────────┤
│                      DOMAIN LAYER                                │
│  Entities • Value Objects • Domain Services • Business Rules    │
├─────────────────────────────────────────────────────────────────┤
│                   INFRASTRUCTURE LAYER                           │
│  Database • Storage • External Services • Caching               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Domain Model

### FsNode Entity
```typescript
interface FsNode {
  id: string;           // UUID
  name: string;         // File/folder name
  path: string;         // Full path (indexed)
  size: number;         // File size in bytes
  mimeType: string;     // MIME type
  createdAt: DateTime;  // Creation timestamp
  updatedAt: DateTime;  // Last modified
  ownerId: string;      // Tenant isolation
  blobId?: string;      // Reference to content
}
```

### Blob Entity (Content-Addressed Storage)
```typescript
interface Blob {
  id: string;           // UUID
  hash: string;         // SHA-256 hash (unique)
  size: number;         // Content size
  storageKey: string;   // S3/local path
  refCount: number;     // Reference counter
  createdAt: DateTime;
}
```

### FileVersion Entity
```typescript
interface FileVersion {
  id: string;
  fsNodeId: string;     // Parent file
  blobId: string;       // Version content
  version: number;      // Version number
  size: number;
  createdAt: DateTime;
  createdBy: string;    // User who created
}
```

---

## Request Flow

```
User Request
     │
     ▼
┌─────────────┐
│   Nginx     │  ← Reverse proxy, SSL termination
└─────────────┘
     │
     ▼
┌─────────────┐
│ Rate Limiter│  ← 10/s, 100/min, 1000/hr per IP
└─────────────┘
     │
     ▼
┌─────────────┐
│  JWT Auth   │  ← Token validation, user extraction
└─────────────┘
     │
     ▼
┌─────────────┐
│ Controller  │  ← Input validation, DTO mapping
└─────────────┘
     │
     ▼
┌─────────────┐
│  Service    │  ← Business logic, tenant isolation
└─────────────┘
     │
     ├──────────────────┐
     ▼                  ▼
┌─────────────┐  ┌─────────────┐
│  Prisma DB  │  │  S3/MinIO   │
│  (metadata) │  │  (blobs)    │
└─────────────┘  └─────────────┘
```

---

## Multi-Tenant Isolation

```typescript
// Every query is scoped to the authenticated user
async listDirectory(path: string, userId: string) {
  return this.prisma.fsNode.findMany({
    where: {
      parentPath: path,
      ownerId: userId,  // ← Tenant isolation
    },
  });
}
```

### Tenant Boundaries
- Each user sees only their files
- Path validation prevents traversal attacks
- Blob sharing is invisible (same content, different owners)

---

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      SECURITY LAYERS                             │
├─────────────────────────────────────────────────────────────────┤
│ Layer 1: Network                                                 │
│   • HTTPS only • CORS configured • Security headers (Helmet)    │
├─────────────────────────────────────────────────────────────────┤
│ Layer 2: Rate Limiting                                           │
│   • Registration: 3/min • Login: 5/min • Global: 1000/hr        │
├─────────────────────────────────────────────────────────────────┤
│ Layer 3: Authentication                                          │
│   • JWT tokens (24h expiry) • bcrypt password hashing           │
├─────────────────────────────────────────────────────────────────┤
│ Layer 4: Authorization                                           │
│   • Tenant isolation • Path validation • Guard decorators       │
├─────────────────────────────────────────────────────────────────┤
│ Layer 5: Input Validation                                        │
│   • class-validator DTOs • Path sanitization • Type checking    │
└─────────────────────────────────────────────────────────────────┘
```

---

*Architecture designed for scale, security, and maintainability*
