# Citycom File System

A multi-tenant blob store DB-based file system provider with Web API and React frontend.

## Features

- **Reusable Library**: `@citycom/fs-provider` - standalone TypeScript package
- **Web API**: NestJS REST API with JWT authentication
- **Multi-tenant**: Each user has isolated access to their files
- **Content Deduplication**: Same file content stored once via SHA-256 hashing
- **Pluggable Storage**: Support for local filesystem, S3, and DB blob storage
- **React Frontend**: File browser with upload, download, and preview

## Architecture

```
┌─────────────────────────────────────────────┐
│            React Frontend                    │
│    (File Browser, Auth, Preview)            │
└─────────────────┬───────────────────────────┘
                  │ REST API
┌─────────────────▼───────────────────────────┐
│            NestJS API                        │
│   (Auth, Controllers, Middleware)           │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│         FsProvider Service                   │
│   (Domain Logic, Repositories)              │
└──────────┬──────────────────┬───────────────┘
           │                  │
┌──────────▼──────┐  ┌───────▼────────────────┐
│   PostgreSQL     │  │   Blob Storage         │
│  (Metadata)      │  │ (Local/S3/DB)          │
└─────────────────┘  └────────────────────────┘
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

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL (or use Docker)

### Setup

1. **Clone and install dependencies**:
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

## Tech Stack

- **Backend**: Node.js, NestJS, TypeScript, Prisma
- **Frontend**: React, TypeScript, Vite, TailwindCSS, TanStack Query
- **Database**: PostgreSQL
- **Auth**: JWT, Passport.js, bcrypt

## License

MIT
