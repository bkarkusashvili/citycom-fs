# Infrastructure & DevOps

## Docker Architecture

### Multi-Stage Build
```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci && npm run build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### Image Size Optimization
```
┌─────────────────────────────────────────────────────────────────┐
│                    IMAGE SIZE COMPARISON                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Without multi-stage:  1.2 GB                                   │
│  With multi-stage:     180 MB   (85% reduction)                 │
│                                                                  │
│  Includes:                                                       │
│  • Node.js 20 Alpine                                            │
│  • Production dependencies only                                 │
│  • Compiled JavaScript (no TypeScript)                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Docker Compose Stack

```yaml
version: '3.8'

services:
  # Frontend - React SPA
  web:
    build: ./apps/web
    ports:
      - "5173:80"
    depends_on:
      - api

  # Backend - NestJS API
  api:
    build: ./apps/api
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/citycom
      - STORAGE_TYPE=s3
      - S3_ENDPOINT=http://minio:9000
    depends_on:
      - db
      - minio

  # Database - PostgreSQL
  db:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=citycom
      - POSTGRES_PASSWORD=secure_password
      - POSTGRES_DB=citycom_fs

  # Object Storage - MinIO (S3-compatible)
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"   # API
      - "9001:9001"   # Console
    volumes:
      - minio_data:/data

volumes:
  postgres_data:
  minio_data:
```

---

## CI/CD Pipeline (GitHub Actions)

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  # Step 1: Lint
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint

  # Step 2: Test
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3

  # Step 3: Build
  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build

  # Step 4: Docker Build & Push
  docker:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: docker/login-action@v3
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: citycom/fs-api:latest
```

### Pipeline Visualization
```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  Lint   │────▶│  Test   │────▶│  Build  │────▶│ Docker  │
│ ESLint  │     │  Jest   │     │  tsc    │     │  Push   │
│ Prettier│     │ 162 tests│    │ Vite    │     │         │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
     │               │               │               │
     ▼               ▼               ▼               ▼
  ~30 sec         ~2 min          ~1 min         ~3 min
```

---

## Health Monitoring

### Health Endpoints

| Endpoint | Purpose | Response |
|----------|---------|----------|
| /health | Basic health | `{ status: "ok" }` |
| /health/live | Kubernetes liveness | `{ status: "ok" }` |
| /health/ready | Kubernetes readiness | `{ status: "ok", db: "ok", storage: "ok" }` |
| /health/detailed | Full diagnostics | All metrics + uptime |

### Detailed Health Response
```json
{
  "status": "ok",
  "timestamp": "2024-01-22T14:30:00Z",
  "uptime": 86400,
  "version": "1.0.0",
  "checks": {
    "database": {
      "status": "ok",
      "responseTime": 5
    },
    "storage": {
      "status": "ok",
      "type": "s3",
      "responseTime": 12
    },
    "memory": {
      "heapUsed": "125 MB",
      "heapTotal": "256 MB",
      "rss": "180 MB"
    }
  }
}
```

---

## Logging Architecture

### Winston Configuration
```typescript
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    process.env.NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.prettyPrint()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});
```

### Log Format (Production)
```json
{
  "level": "info",
  "message": "File uploaded",
  "timestamp": "2024-01-22T14:30:00.000Z",
  "context": "FilesystemService",
  "userId": "abc123",
  "path": "/documents/report.pdf",
  "size": 1048576,
  "duration": 245
}
```

### Log Levels
```
┌─────────────────────────────────────────────────────────────────┐
│                      LOG LEVELS                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  error   → Application errors, exceptions                       │
│  warn    → Degraded service, rate limits hit                    │
│  info    → Business events (uploads, deletes)                   │
│  http    → HTTP request/response logs                           │
│  debug   → Detailed debugging (dev only)                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Security Headers (Helmet)

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
}));
```

### Headers Applied
```
Content-Security-Policy: default-src 'self'; ...
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

---

## Environment Configuration

### Required Variables
```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/citycom

# JWT
JWT_SECRET=your-256-bit-secret
JWT_EXPIRES_IN=24h

# Storage
STORAGE_TYPE=s3|local
STORAGE_PATH=/data/blobs        # For local
S3_ENDPOINT=http://minio:9000   # For S3/MinIO
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=citycom-files

# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
```

### Configuration Validation
```typescript
@Injectable()
export class ConfigService {
  constructor() {
    this.validate();
  }

  private validate() {
    const required = ['DATABASE_URL', 'JWT_SECRET'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required env vars: ${missing.join(', ')}`);
    }
  }
}
```

---

## Deployment Options

### Option 1: Docker Compose (Development/Small Scale)
```bash
docker-compose up -d
```

### Option 2: Kubernetes (Production/Scale)
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: citycom-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: citycom-api
  template:
    spec:
      containers:
        - name: api
          image: citycom/fs-api:latest
          ports:
            - containerPort: 3000
          livenessProbe:
            httpGet:
              path: /health/live
              port: 3000
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3000
```

### Option 3: Cloud Services
```
┌─────────────────────────────────────────────────────────────────┐
│                    CLOUD DEPLOYMENT                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  AWS:                                                            │
│  • ECS/Fargate for containers                                   │
│  • RDS PostgreSQL                                               │
│  • S3 for blob storage                                          │
│  • CloudFront CDN                                               │
│                                                                  │
│  GCP:                                                            │
│  • Cloud Run                                                    │
│  • Cloud SQL                                                    │
│  • Cloud Storage                                                │
│                                                                  │
│  Azure:                                                          │
│  • Container Apps                                               │
│  • Azure Database for PostgreSQL                                │
│  • Azure Blob Storage                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

*Production-ready infrastructure with observability and security*
