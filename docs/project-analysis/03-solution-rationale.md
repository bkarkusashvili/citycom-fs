# Solution Rationale

This document explains why specific technologies, patterns, and approaches were chosen for the Citycom File System project.

---

## Technology Decisions

### 1. TypeScript (over JavaScript, C#, or Scala)

**Decision**: Use TypeScript for the entire stack.

**Rationale**:
- **Full-stack consistency**: Same language for frontend (React) and backend (NestJS)
- **Type safety**: Catches errors at compile time, not runtime
- **DDD support**: Interfaces and classes map directly to domain concepts
- **Ecosystem**: Largest npm ecosystem with type definitions
- **Team productivity**: IDE autocompletion, refactoring tools

**Alternatives Considered**:
| Option | Pros | Cons | Why Not |
|--------|------|------|---------|
| C# / .NET | Mature, enterprise-ready | Separate frontend needed | Added complexity |
| Scala | Functional, JVM ecosystem | Smaller talent pool | Steeper learning curve |
| JavaScript | No build step | No type safety | DDD requires types |

---

### 2. NestJS (over Express, Fastify, Koa)

**Decision**: Use NestJS as the backend framework.

**Rationale**:
- **Built-in DI**: Constructor injection without extra setup
- **Modular architecture**: Fits DDD/Clean Architecture naturally
- **TypeScript-first**: Not an afterthought
- **Swagger integration**: Auto-generated API documentation
- **Guards/Interceptors**: Clean auth and validation patterns
- **Enterprise adoption**: Proven at scale (Adidas, Roche, Autodesk)

**Alternatives Considered**:
| Option | Pros | Cons | Why Not |
|--------|------|------|---------|
| Express | Simple, flexible | No structure, manual DI | Too low-level for DDD |
| Fastify | Very fast | Less ecosystem | Swagger integration weaker |
| Koa | Lightweight | No built-in features | Would reinvent NestJS |
| Hapi | Validation built-in | Less popular | Smaller community |

---

### 3. PostgreSQL (over MongoDB, MySQL, SQLite)

**Decision**: Use PostgreSQL as the primary database.

**Rationale**:
- **Relational integrity**: Foreign keys enforce consistency
- **ACID compliance**: Transactions for multi-step operations
- **JSON support**: Can store semi-structured data if needed
- **Scalability**: Handles millions of rows efficiently
- **Prisma support**: First-class integration
- **Production proven**: Powers Instagram, Spotify, Netflix

**Alternatives Considered**:
| Option | Pros | Cons | Why Not |
|--------|------|------|---------|
| MongoDB | Flexible schema | No joins, eventual consistency | File system needs relations |
| MySQL | Popular | Less features than PostgreSQL | PostgreSQL better for this use case |
| SQLite | Zero setup | Single-writer, no network | Not multi-tenant scalable |
| DynamoDB | Infinite scale | Vendor lock-in, complex queries | Over-engineered for this |

---

### 4. Prisma (over TypeORM, Sequelize, Knex)

**Decision**: Use Prisma as the ORM.

**Rationale**:
- **Type-safe queries**: Generated types from schema
- **Schema-first**: Single source of truth for database
- **Migrations**: Automatic migration generation
- **Multi-database**: Switch providers without code changes
- **Developer experience**: Best-in-class tooling

**Alternatives Considered**:
| Option | Pros | Cons | Why Not |
|--------|------|------|---------|
| TypeORM | Mature, decorators | Type inference weaker | Prisma types are better |
| Sequelize | Feature-rich | TypeScript support weak | Not TypeScript-first |
| Knex | Query builder | No ORM features | Too low-level |
| Drizzle | Lightweight | Newer, less mature | Prisma more proven |

---

### 5. React (over Angular, Vue, Svelte)

**Decision**: Use React for the frontend.

**Rationale**:
- **Market dominance**: Largest ecosystem and community
- **Flexibility**: Not opinionated about state management
- **TypeScript support**: Excellent type inference
- **Requirement compliance**: Task specified React or Angular
- **Component model**: Fits file browser UI well

**Alternatives Considered**:
| Option | Pros | Cons | Why Not |
|--------|------|------|---------|
| Angular | Full framework | Heavyweight, steep curve | React simpler for this |
| Vue | Easy to learn | Smaller ecosystem | React has more libraries |
| Svelte | Fast, simple | Smaller community | Less enterprise adoption |

---

### 6. Vite (over Create React App, Webpack)

**Decision**: Use Vite as the build tool.

**Rationale**:
- **Speed**: 10-100x faster than Webpack
- **HMR**: Instant hot module replacement
- **ESM native**: Modern browser support
- **Simple config**: Works out of the box
- **TypeScript**: Built-in support

**Alternatives Considered**:
| Option | Pros | Cons | Why Not |
|--------|------|------|---------|
| CRA | Official React tool | Slow, deprecated | Vite is the modern choice |
| Webpack | Flexible | Complex config | Vite simpler |
| Parcel | Zero config | Less control | Vite faster |

---

### 7. JWT Authentication (over Sessions, OAuth)

**Decision**: Use JWT for authentication.

**Rationale**:
- **Stateless**: No server-side session storage
- **Scalable**: Any server can validate tokens
- **Self-contained**: User info embedded in token
- **Standard**: RFC 7519, well-understood
- **NestJS support**: @nestjs/jwt and @nestjs/passport

**Alternatives Considered**:
| Option | Pros | Cons | Why Not |
|--------|------|------|---------|
| Sessions | Simple revocation | Requires session store | Not scalable |
| OAuth 2.0 | Federated identity | Complex for single-app | Over-engineered |
| API Keys | Simple | No expiration by default | JWT more secure |

---

### 8. Content-Addressable Storage (over Path-Based)

**Decision**: Store blobs by SHA-256 hash of content.

**Rationale**:
- **Deduplication**: Same content stored once
- **Integrity**: Hash verifies content unchanged
- **Efficient**: Saves storage for duplicate files
- **Git-proven**: Same approach as Git uses
- **Orphan cleanup**: Reference counting enables GC

**How It Works**:
```
File A: "Hello" → Hash: abc123 → ./blobs/ab/abc123
File B: "Hello" → Hash: abc123 → (reuses existing blob)
File C: "World" → Hash: def456 → ./blobs/de/def456
```

**Alternatives Considered**:
| Option | Pros | Cons | Why Not |
|--------|------|------|---------|
| Path-based | Simple | No deduplication | Wastes storage |
| UUID-based | Unique | No deduplication | Wastes storage |
| Database BLOB | Single system | Large DB size | Separate storage better |

---

### 9. Monorepo (over Multi-Repo)

**Decision**: Use npm workspaces monorepo.

**Rationale**:
- **Atomic changes**: Single commit across packages
- **Shared dependencies**: No version conflicts
- **Easy refactoring**: Cross-package changes simple
- **Single CI**: One pipeline for all packages
- **Code sharing**: fs-provider used by api directly

**Structure**:
```
citycom-fs/
├── packages/
│   └── fs-provider/    # Shared library
└── apps/
    ├── api/            # Uses fs-provider
    └── web/            # Independent
```

**Alternatives Considered**:
| Option | Pros | Cons | Why Not |
|--------|------|------|---------|
| Multi-repo | Independent versioning | Coordination overhead | Too complex for this size |
| Lerna | Feature-rich | Overhead | npm workspaces sufficient |
| Nx | Powerful | Learning curve | Over-engineered |
| Turborepo | Fast | Another tool | npm workspaces sufficient |

---

### 10. Docker Deployment (over Serverless, K8s)

**Decision**: Use Docker Compose for deployment.

**Rationale**:
- **Reproducible**: Same environment everywhere
- **Simple**: Single command deployment
- **Portable**: Works on any Docker host
- **Development**: Same setup for dev and prod
- **Cost-effective**: No cloud vendor lock-in

**Alternatives Considered**:
| Option | Pros | Cons | Why Not |
|--------|------|------|---------|
| Kubernetes | Scalable | Complex | Over-engineered for MVP |
| Serverless | Auto-scaling | Cold starts, vendor lock | File system needs persistence |
| Bare metal | No overhead | Not reproducible | Docker is standard |

---

## Design Decisions

### 1. DDD with Clean Architecture

**Decision**: Structure code using Domain-Driven Design.

**Rationale**:
- **Requirement**: Task explicitly requires DDD and SOLID
- **Maintainability**: Clear boundaries between concerns
- **Testability**: Domain logic isolated from infrastructure
- **Flexibility**: Easy to swap implementations

**Layer Structure**:
```
Domain         → Entities, Value Objects, Repository Interfaces
Application    → Use Cases, Service Orchestration
Infrastructure → Database, File Storage, External APIs
Presentation   → Controllers, DTOs, Validation
```

---

### 2. Pluggable Storage Interfaces

**Decision**: Define interfaces for repositories and storage.

**Rationale**:
- **Requirement**: Task requires pluggable storage
- **Testing**: Can use in-memory implementations
- **Flexibility**: Swap PostgreSQL for MongoDB
- **Separation**: Domain doesn't know about Prisma

**Example**:
```typescript
// Domain layer (no Prisma dependency)
interface IBlobStorage {
  store(hash: string, content: Buffer): Promise<void>;
  retrieve(hash: string): Promise<Buffer>;
  delete(hash: string): Promise<void>;
}

// Infrastructure layer
class LocalBlobStorage implements IBlobStorage { }
class S3BlobStorage implements IBlobStorage { }
class DatabaseBlobStorage implements IBlobStorage { }
```

---

### 3. Reference Counting for Blobs

**Decision**: Track blob references and delete at zero.

**Rationale**:
- **Requirement**: Task requires orphan blob deletion
- **Efficiency**: Don't scan entire database
- **Real-time**: Cleanup happens immediately
- **Simple**: No background job needed

**How It Works**:
```
File created with new content:
  → Create blob with referenceCount = 1

File created with existing content:
  → Increment blob.referenceCount

File deleted:
  → Decrement blob.referenceCount
  → If count == 0, delete blob
```

---

### 4. Tenant Isolation via Database

**Decision**: Use `tenantId` column with unique constraint.

**Rationale**:
- **Security**: Database enforces isolation
- **Performance**: Index includes tenant for fast queries
- **Simplicity**: No application-level filtering errors
- **Scalability**: Can shard by tenant later

**Implementation**:
```sql
CREATE UNIQUE INDEX ON "FsNode" ("tenantId", "path");

-- All queries automatically scoped
SELECT * FROM "FsNode" WHERE "tenantId" = $1;
```

---

### 5. Path Normalization

**Decision**: Normalize all paths before storage.

**Rationale**:
- **Consistency**: `/foo/bar`, `/foo//bar`, `foo/bar` all resolve same
- **Security**: Prevents `../` traversal attacks
- **Uniqueness**: Normalized paths can be unique key

**Normalization Rules**:
```
Input                    → Normalized
"/foo/bar"              → "/foo/bar"
"foo/bar"               → "/foo/bar"
"/foo//bar"             → "/foo/bar"
"/foo/bar/"             → "/foo/bar"
"/foo/../bar"           → "/bar"
```

---

### 6. Value Objects for Domain Concepts

**Decision**: Wrap primitives in typed value objects.

**Rationale**:
- **Validation**: Invalid values can't exist
- **Type safety**: Can't pass string where Path expected
- **Encapsulation**: Logic lives with data
- **Self-documenting**: Code expresses intent

**Examples**:
```typescript
// Instead of: path: string
class Path {
  private constructor(private readonly value: string) {
    if (value.length > 4096) throw new Error('Path too long');
  }
  static create(raw: string): Path {
    return new Path(normalize(raw));
  }
}

// Instead of: hash: string
class ContentHash {
  private constructor(private readonly value: string) {
    if (!/^[a-f0-9]{64}$/.test(value)) throw new Error('Invalid hash');
  }
  static fromContent(buffer: Buffer): ContentHash {
    return new ContentHash(sha256(buffer));
  }
}
```

---

## Trade-offs Made

### 1. Simplicity over Features
- No file versioning (simpler, but can't recover deleted)
- No permission system (all user files visible)
- No audit logging (smaller database)

### 2. Consistency over Performance
- Synchronous operations (no background jobs)
- Single database queries (no caching layer)
- Reference counting in transactions

### 3. Security over Convenience
- JWT expiration requires re-login
- No "remember me" functionality
- Password requirements enforced

### 4. Flexibility over Integration
- Custom blob storage vs. S3-only
- Multiple database support vs. optimized for one
- Separate frontend vs. server-rendered

---

*Document Version: 1.0*
*Last Updated: 2026-02-05*
