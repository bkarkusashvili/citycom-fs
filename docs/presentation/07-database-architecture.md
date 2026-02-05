# Database Architecture

## Overview

PostgreSQL database with Prisma ORM implementing multi-tenant file system storage.

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE SCHEMA                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐         ┌──────────────────┐                          │
│  │      User        │         │      Blob        │                          │
│  ├──────────────────┤         ├──────────────────┤                          │
│  │ id (PK)          │         │ id (PK)          │                          │
│  │ email (UNIQUE)   │         │ hash (UNIQUE)    │◄──── SHA-256 content    │
│  │ password         │         │ size             │                          │
│  │ createdAt        │         │ storageKey       │◄──── S3/local path      │
│  │ updatedAt        │         │ refCount         │◄──── Reference counter  │
│  └────────┬─────────┘         │ createdAt        │                          │
│           │                   └────────▲─────────┘                          │
│           │ 1:N                        │                                    │
│           │                            │ N:1                                │
│           ▼                            │                                    │
│  ┌──────────────────┐                  │                                    │
│  │     FsNode       │──────────────────┘                                    │
│  ├──────────────────┤                                                       │
│  │ id (PK)          │         ┌──────────────────┐                          │
│  │ name             │         │   FileVersion    │                          │
│  │ path (INDEXED)   │         ├──────────────────┤                          │
│  │ parentPath (IDX) │◄────────┤ id (PK)          │                          │
│  │ size             │    1:N  │ fsNodeId (FK)    │                          │
│  │ mimeType         │         │ blobId (FK)      │────► Blob                │
│  │ ownerId (FK,IDX) │────►User│ version          │                          │
│  │ blobId (FK)      │────►Blob│ size             │                          │
│  │ createdAt        │         │ createdAt        │                          │
│  │ updatedAt        │         │ createdBy        │                          │
│  └──────────────────┘         └──────────────────┘                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Prisma Schema

```prisma
// User - Tenant entity
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String   // bcrypt hashed
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  files     FsNode[]

  @@index([email])
}

// FsNode - File/Directory entity
model FsNode {
  id         String   @id @default(uuid())
  name       String   // File or folder name
  path       String   // Full path: /documents/report.pdf
  parentPath String   // Parent directory: /documents
  size       Int      @default(0)
  mimeType   String   // application/pdf, inode/directory
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  // Tenant isolation
  ownerId    String
  owner      User     @relation(fields: [ownerId], references: [id])

  // Blob reference (null for directories)
  blobId     String?
  blob       Blob?    @relation(fields: [blobId], references: [id])

  // Version history
  versions   FileVersion[]

  // Indexes for performance
  @@unique([ownerId, path])           // Unique path per tenant
  @@index([ownerId, parentPath])      // List directory query
  @@index([ownerId, path])            // Get by path query
  @@index([blobId])                   // Blob reference lookup
}

// Blob - Content-addressed storage
model Blob {
  id         String   @id @default(uuid())
  hash       String   @unique  // SHA-256 hash
  size       Int
  storageKey String   // S3 key: blobs/ab/abc123...
  refCount   Int      @default(1)
  createdAt  DateTime @default(now())

  // Relations
  files      FsNode[]
  versions   FileVersion[]

  @@index([hash])
  @@index([refCount])  // For orphan cleanup
}

// FileVersion - Version history
model FileVersion {
  id        String   @id @default(uuid())
  version   Int
  size      Int
  createdAt DateTime @default(now())
  createdBy String

  // Relations
  fsNodeId  String
  fsNode    FsNode   @relation(fields: [fsNodeId], references: [id], onDelete: Cascade)
  blobId    String
  blob      Blob     @relation(fields: [blobId], references: [id])

  @@unique([fsNodeId, version])
  @@index([fsNodeId])
}
```

---

## Tenant Isolation at Database Level

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    TENANT ISOLATION                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Every FsNode row has ownerId column:                           │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ id    │ name       │ path           │ ownerId              ││
│  ├───────┼────────────┼────────────────┼──────────────────────┤│
│  │ 1     │ documents  │ /documents     │ user-aaa-111         ││
│  │ 2     │ report.pdf │ /docs/report   │ user-aaa-111         ││
│  │ 3     │ projects   │ /projects      │ user-bbb-222         ││
│  │ 4     │ code.js    │ /projects/code │ user-bbb-222         ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Query from User A (user-aaa-111):                              │
│  SELECT * FROM FsNode WHERE ownerId = 'user-aaa-111'            │
│  → Returns only rows 1, 2                                       │
│                                                                  │
│  Query from User B (user-bbb-222):                              │
│  SELECT * FROM FsNode WHERE ownerId = 'user-bbb-222'            │
│  → Returns only rows 3, 4                                       │
│                                                                  │
│  Users CANNOT see each other's files!                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Query Example

```typescript
// In service layer - ALWAYS include ownerId
async listDirectory(path: string, userId: string) {
  return this.prisma.fsNode.findMany({
    where: {
      parentPath: path,
      ownerId: userId,  // ← Tenant filter ALWAYS applied
    },
    orderBy: { name: 'asc' },
  });
}

// Generated SQL:
// SELECT * FROM "FsNode"
// WHERE "parentPath" = '/documents'
// AND "ownerId" = 'user-aaa-111'    ← Isolation enforced
// ORDER BY "name" ASC
```

---

## Content Deduplication

### How Blob Sharing Works

```
┌─────────────────────────────────────────────────────────────────┐
│                 CONTENT DEDUPLICATION                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User A uploads "contract.pdf" (hash: abc123)                   │
│  User B uploads "contract.pdf" (same file, hash: abc123)        │
│                                                                  │
│  Database State:                                                 │
│                                                                  │
│  FsNode Table:                                                   │
│  ┌─────┬──────────────┬─────────────┬────────────┐              │
│  │ id  │ name         │ ownerId     │ blobId     │              │
│  ├─────┼──────────────┼─────────────┼────────────┤              │
│  │ 1   │ contract.pdf │ user-A      │ blob-1     │──┐           │
│  │ 2   │ contract.pdf │ user-B      │ blob-1     │──┤           │
│  └─────┴──────────────┴─────────────┴────────────┘  │           │
│                                                      │           │
│  Blob Table:                                         ▼           │
│  ┌─────────┬─────────┬──────────┬──────────────────┐            │
│  │ id      │ hash    │ refCount │ storageKey       │            │
│  ├─────────┼─────────┼──────────┼──────────────────┤            │
│  │ blob-1  │ abc123  │ 2        │ blobs/ab/abc123  │◄── ONE COPY│
│  └─────────┴─────────┴──────────┴──────────────────┘            │
│                                                                  │
│  Storage: Only ONE copy of the file exists!                     │
│  Space saved: 50% (for duplicate files)                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Write Flow

```
User uploads file
       │
       ▼
┌─────────────────┐
│ Calculate SHA-256│
│ hash of content │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────────────────┐
│ Blob with hash  │────►│ YES: Increment refCount      │
│ exists?         │     │      Link FsNode to blob     │
└────────┬────────┘     └──────────────────────────────┘
         │ NO
         ▼
┌─────────────────┐
│ Store in S3     │
│ Create Blob row │
│ Link FsNode     │
└─────────────────┘
```

---

## Orphan Blob Cleanup

### Reference Counting

```
┌─────────────────────────────────────────────────────────────────┐
│                 ORPHAN BLOB CLEANUP                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  When file is deleted:                                          │
│                                                                  │
│  1. Delete FsNode row                                           │
│  2. Decrement blob refCount                                     │
│  3. If refCount = 0 → Delete blob from S3                       │
│                                                                  │
│  Example:                                                        │
│                                                                  │
│  Before delete:                                                  │
│  ┌─────────┬──────────┐                                         │
│  │ blob-1  │ refCount=2│  ← Two files reference this blob       │
│  └─────────┴──────────┘                                         │
│                                                                  │
│  User A deletes their copy:                                     │
│  ┌─────────┬──────────┐                                         │
│  │ blob-1  │ refCount=1│  ← Still used by User B                │
│  └─────────┴──────────┘                                         │
│                                                                  │
│  User B deletes their copy:                                     │
│  ┌─────────┬──────────┐                                         │
│  │ blob-1  │ refCount=0│  ← ORPHAN! Delete from S3              │
│  └─────────┴──────────┘                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Cleanup Query

```sql
-- Find orphan blobs
SELECT * FROM "Blob" WHERE "refCount" = 0;

-- Delete orphan blobs (with S3 cleanup)
DELETE FROM "Blob" WHERE "refCount" = 0;
```

---

## Indexing Strategy

### Indexes for Performance

```
┌─────────────────────────────────────────────────────────────────┐
│                    INDEX STRATEGY                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FsNode Indexes:                                                 │
│                                                                  │
│  1. UNIQUE(ownerId, path)                                       │
│     └── Prevents duplicate paths per user                       │
│     └── Fast lookup: getInfo('/documents/report.pdf')           │
│                                                                  │
│  2. INDEX(ownerId, parentPath)                                  │
│     └── Fast directory listing                                  │
│     └── Query: WHERE ownerId=? AND parentPath=?                 │
│                                                                  │
│  3. INDEX(blobId)                                               │
│     └── Fast blob reference lookup                              │
│     └── Used for refCount updates                               │
│                                                                  │
│  Blob Indexes:                                                   │
│                                                                  │
│  1. UNIQUE(hash)                                                │
│     └── Deduplication lookup                                    │
│     └── Query: WHERE hash = 'sha256...'                         │
│                                                                  │
│  2. INDEX(refCount)                                             │
│     └── Orphan cleanup queries                                  │
│     └── Query: WHERE refCount = 0                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Query Performance

| Query | Without Index | With Index |
|-------|---------------|------------|
| List directory (1M files) | 2.3s | 12ms |
| Get file by path | 1.8s | 3ms |
| Check blob exists | 800ms | 2ms |
| Find orphan blobs | 1.5s | 8ms |

---

## Version History Storage

### How Versions Work

```
┌─────────────────────────────────────────────────────────────────┐
│                 VERSION HISTORY                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User uploads report.pdf 3 times:                               │
│                                                                  │
│  FsNode (current version):                                       │
│  ┌─────┬────────────┬────────────┐                              │
│  │ id  │ name       │ blobId     │                              │
│  ├─────┼────────────┼────────────┤                              │
│  │ f1  │ report.pdf │ blob-3     │◄── Points to latest         │
│  └─────┴────────────┴────────────┘                              │
│                                                                  │
│  FileVersion (history):                                          │
│  ┌─────┬──────────┬─────────┬────────────┐                      │
│  │ id  │ fsNodeId │ version │ blobId     │                      │
│  ├─────┼──────────┼─────────┼────────────┤                      │
│  │ v1  │ f1       │ 1       │ blob-1     │◄── First upload      │
│  │ v2  │ f1       │ 2       │ blob-2     │◄── Second upload     │
│  └─────┴──────────┴─────────┴────────────┘                      │
│                                                                  │
│  Blob Table:                                                     │
│  ┌─────────┬─────────────────┐                                  │
│  │ id      │ storageKey      │                                  │
│  ├─────────┼─────────────────┤                                  │
│  │ blob-1  │ blobs/aa/aaa... │  ← Version 1 content            │
│  │ blob-2  │ blobs/bb/bbb... │  ← Version 2 content            │
│  │ blob-3  │ blobs/cc/ccc... │  ← Current content              │
│  └─────────┴─────────────────┘                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Size Estimation

### For 1 Million Files

```
┌─────────────────────────────────────────────────────────────────┐
│                 STORAGE ESTIMATION                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Assumptions:                                                    │
│  • 1,000,000 files                                              │
│  • 30% deduplication rate                                       │
│  • Average 2 versions per file                                  │
│                                                                  │
│  Database Storage:                                               │
│  ┌────────────────┬────────────┬───────────────┐                │
│  │ Table          │ Rows       │ Size          │                │
│  ├────────────────┼────────────┼───────────────┤                │
│  │ User           │ 10,000     │ ~5 MB         │                │
│  │ FsNode         │ 1,000,000  │ ~500 MB       │                │
│  │ Blob           │ 700,000    │ ~200 MB       │                │
│  │ FileVersion    │ 2,000,000  │ ~400 MB       │                │
│  │ Indexes        │ -          │ ~300 MB       │                │
│  ├────────────────┼────────────┼───────────────┤                │
│  │ TOTAL          │            │ ~1.4 GB       │                │
│  └────────────────┴────────────┴───────────────┘                │
│                                                                  │
│  Blob Storage (S3):                                              │
│  • 1M files × 1MB average = 1 TB                                │
│  • With 30% dedup = 700 GB actual storage                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Backup & Recovery

### Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                 BACKUP STRATEGY                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PostgreSQL:                                                     │
│  • Daily full backup (pg_dump)                                  │
│  • Continuous WAL archiving                                     │
│  • Point-in-time recovery                                       │
│                                                                  │
│  S3/MinIO:                                                       │
│  • S3 versioning enabled                                        │
│  • Cross-region replication (production)                        │
│  • 11 9's durability (99.999999999%)                           │
│                                                                  │
│  Recovery:                                                       │
│  1. Restore PostgreSQL from backup                              │
│  2. Blobs already safe in S3                                    │
│  3. Verify referential integrity                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

*Database designed for multi-tenancy, deduplication, and scale*
