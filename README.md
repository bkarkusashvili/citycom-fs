# Citycom File System

```
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║     ██████╗██╗████████╗██╗   ██╗ ██████╗ ██████╗ ███╗   ███╗    ║
║    ██╔════╝██║╚══██╔══╝╚██╗ ██╔╝██╔════╝██╔═══██╗████╗ ████║    ║
║    ██║     ██║   ██║    ╚████╔╝ ██║     ██║   ██║██╔████╔██║    ║
║    ██║     ██║   ██║     ╚██╔╝  ██║     ██║   ██║██║╚██╔╝██║    ║
║    ╚██████╗██║   ██║      ██║   ╚██████╗╚██████╔╝██║ ╚═╝ ██║    ║
║     ╚═════╝╚═╝   ╚═╝      ╚═╝    ╚═════╝ ╚═════╝ ╚═╝     ╚═╝    ║
║                                                                  ║
║                    FILE SYSTEM                                   ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

A production-ready, multi-tenant blob store database-based file system with pluggable storage backends.

## Features

- **Reusable Library**: `@citycom/fs-provider` - standalone TypeScript package
- **Web API**: NestJS REST API with JWT authentication
- **Multi-tenant**: Each user has isolated access to their files
- **Content Deduplication**: Same file content stored once via SHA-256 hashing
- **Pluggable Storage**: Support for local filesystem, S3/MinIO, and DB blob storage
- **Hybrid Storage**: Seamless reading from multiple storage backends (local + S3)
- **File Versioning**: Automatic version history with restore capability
- **React Frontend**: File browser with upload, download, preview, and version history

## Key Highlights

- **14 FsProvider methods** fully implemented
- **Multi-tenant** with complete isolation
- **Content-addressed deduplication** (SHA-256)
- **Cursor-based pagination** for millions of files
- **File versioning** with restore capability
- **Rich file preview** (images, PDF, code, markdown)
- **Rate limiting** and security headers
- **Health endpoints** for Kubernetes
- **Structured JSON logging**

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT                                   │
│            React + TypeScript + TailwindCSS                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS + JWT
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       API LAYER                                  │
│  NestJS │ Rate Limiting │ Helmet │ Validation │ Swagger          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DOMAIN LAYER                                │
│       FsProvider Interface │ Business Logic │ Services           │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│      PostgreSQL         │     │      S3 / MinIO         │
│   (File Metadata)       │     │   (Blob Storage)        │
│   - FsNode tree         │     │   - Deduplicated        │
│   - User accounts       │     │   - Content-addressed   │
│   - File versions       │     │   - Scalable            │
└─────────────────────────┘     └─────────────────────────┘
```

## Project Structure

```
citycom-fs/
├── packages/
│   └── fs-provider/          # Core library
│       ├── src/
│       │   ├── domain/       # Entities, Value Objects, Interfaces
│       │   ├── application/  # FsProvider Service
│       │   └── infrastructure/  # Repositories, Blob Storage
│       └── tests/
├── apps/
│   ├── api/                  # NestJS Backend
│   │   ├── src/
│   │   │   ├── auth/         # JWT Authentication
│   │   │   ├── filesystem/   # File System Controllers
│   │   │   └── infrastructure/
│   │   └── prisma/           # Database Schema
│   └── web/                  # React Frontend
│       └── src/
│           ├── pages/
│           ├── components/
│           └── services/
└── docker-compose.yml
```

## Quick Start

### Option 1: Docker (Recommended)

Run the entire stack with one command:

```bash
# Build and start all services
docker-compose up -d --build

# Run database migrations (first time only)
docker exec citycom-api npx prisma migrate deploy

# View logs
docker-compose logs -f
```

**Access the application:**
- Frontend: http://localhost
- API: http://localhost:3000
- API Docs: http://localhost:3000/api/docs

**Stop the services:**
```bash
docker-compose down
```

### Option 2: Local Development

#### Prerequisites

- Node.js 18+
- Docker (for PostgreSQL)

#### Setup

1. **Install dependencies**:
   ```bash
   cd citycom-fs
   npm install
   ```

2. **Start PostgreSQL**:
   ```bash
   docker-compose up -d postgres
   ```

3. **Configure environment**:
   ```bash
   cp apps/api/.env.example apps/api/.env
   # Edit .env with your settings
   ```

4. **Run database migrations**:
   ```bash
   cd apps/api
   npx prisma migrate dev
   cd ../..
   ```

5. **Start the API**:
   ```bash
   npm run dev:api
   ```

6. **Start the frontend** (in another terminal):
   ```bash
   npm run dev:web
   ```

7. **Open http://localhost:5173** in your browser

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login

### File System
- `GET /api/fs/list?path=/` - List directory contents
- `POST /api/fs/directory` - Create directory
- `DELETE /api/fs/directory?path=` - Delete directory
- `POST /api/fs/upload` - Upload file (multipart)
- `GET /api/fs/download?path=` - Download file
- `GET /api/fs/file?path=` - Read file content
- `DELETE /api/fs/file?path=` - Delete file
- `POST /api/fs/file/copy` - Copy file
- `POST /api/fs/file/move` - Move/rename file
- `GET /api/fs/info?path=` - Get file/directory info

### File Versioning
- `GET /api/fs/versions?path=` - Get version history for a file
- `POST /api/fs/versions/restore` - Restore file to a previous version

## FsProvider Interface

```typescript
interface IFsProvider {
  // Directory operations
  createDirectory(path: string): Promise<void>;
  deleteDirectory(path: string): Promise<void>;
  copyDirectory(path: string, newPath: string): Promise<void>;
  moveDirectory(path: string, newPath: string): Promise<void>;
  listDirectory(path: string): Promise<FsNodeData[]>;

  // File operations
  writeFile(path: string, content: string | Buffer): Promise<void>;
  readFile(path: string): Promise<Buffer>;
  deleteFile(path: string): Promise<void>;
  copyFile(path: string, newPath: string): Promise<void>;
  moveFile(path: string, newPath: string): Promise<void>;

  // Common
  getInfo(path: string): Promise<FsNodeData>;
  exists(path: string): Promise<boolean>;
  setWorkingDirectory(path: string): void;
  getWorkingDirectory(): string;
}
```

## Testing

```bash
# Run all tests
npm test

# Run fs-provider tests
npm test --workspace=@citycom/fs-provider

# Run with coverage
npm test --workspace=@citycom/fs-provider -- --coverage
```

## Design Decisions

### Content-Addressable Storage
Files are stored by their SHA-256 hash, enabling:
- Automatic deduplication across all users
- Efficient storage utilization
- Data integrity verification

### Reference Counting
Each blob tracks its reference count:
- Increment when a file links to a blob
- Decrement when file is deleted
- Delete blob when count reaches 0

### Multi-tenancy
- Each user has isolated access via `tenantId`
- Database indexes include tenant for performance
- API guards enforce tenant isolation

### File Versioning
- Automatic version creation on file updates
- Version history with metadata (size, timestamp, creator)
- One-click restore to any previous version
- Versions share deduplicated blob storage

### Hybrid Storage
- Configure primary and fallback storage providers
- Seamless migration between storage backends
- Read from local disk with S3 fallback (or vice versa)

## Tech Stack

- **Backend**: Node.js, NestJS, TypeScript, Prisma
- **Frontend**: React, TypeScript, Vite, TailwindCSS, TanStack Query
- **Database**: PostgreSQL
- **Storage**: Local filesystem, S3/MinIO, PostgreSQL blobs
- **Auth**: JWT, Passport.js, bcrypt
- **DevOps**: Docker, Docker Compose

## Documentation

Detailed technical documentation is available in [docs/presentation/](docs/presentation/):

- [Executive Summary](docs/presentation/01-executive-summary.md) - System overview
- [Architecture Deep Dive](docs/presentation/02-architecture-deep-dive.md) - Component details
- [Scalability Strategy](docs/presentation/03-scalability-strategy.md) - Performance patterns
- [Feature Showcase](docs/presentation/04-feature-showcase.md) - Implementation details
- [Infrastructure & DevOps](docs/presentation/05-infrastructure-devops.md) - Deployment
- [Requirements Compliance](docs/presentation/06-requirements-compliance.md) - Spec mapping
- [Database Architecture](docs/presentation/07-database-architecture.md) - Data modeling

## License

MIT
