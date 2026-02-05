#!/bin/bash
# Run Prisma migrations in Docker environment

set -e

echo "Waiting for PostgreSQL to be ready..."
until docker exec citycom-postgres pg_isready -U postgres > /dev/null 2>&1; do
  sleep 1
done

echo "Running Prisma migrations..."
docker exec citycom-api npx prisma migrate deploy

echo "Migrations completed successfully!"
