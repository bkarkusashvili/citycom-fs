# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/fs-provider/package*.json ./packages/fs-provider/

# Install dependencies
RUN npm install

# Copy source code
COPY tsconfig.base.json ./
COPY packages/fs-provider ./packages/fs-provider
COPY apps/api ./apps/api

# Build fs-provider library
WORKDIR /app/packages/fs-provider
RUN npm run build

# Generate Prisma client and build API
WORKDIR /app/apps/api
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/

# Install production dependencies only
RUN npm install --omit=dev

# Copy built files
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

WORKDIR /app/apps/api

# Create data directory for blobs
RUN mkdir -p data/blobs

EXPOSE 3000

CMD ["node", "dist/main.js"]
