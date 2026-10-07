#!/bin/sh
set -e

# node-pg-migrate reads a single DATABASE_URL rather than discrete PG* vars, so build one from
# the PG* env vars this service is configured with (PORT, PGHOST, PGPORT, PGDATABASE, PGUSER,
# PGPASSWORD — see SVC-00 / docker-compose.yml), then run pending migrations before starting the
# server. This mirrors the Flyway auto-migrate-on-boot behavior used by the Spring Boot services.
export DATABASE_URL="postgres://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}"

echo "Running database migrations..."
npx --no-install node-pg-migrate up -m migrations

echo "Starting appointment-service..."
exec "$@"
