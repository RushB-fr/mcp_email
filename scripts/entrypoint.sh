#!/bin/sh
set -e

echo "[entrypoint] Waiting for the database to accept migrations..."

MAX_ATTEMPTS=30
ATTEMPT=0

until ./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma; do
  ATTEMPT=$((ATTEMPT + 1))
  if [ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ]; then
    echo "[entrypoint] Database still unreachable after $MAX_ATTEMPTS attempts, aborting."
    exit 1
  fi
  echo "[entrypoint] Database not ready yet (attempt $ATTEMPT/$MAX_ATTEMPTS), retrying in 2s..."
  sleep 2
done

echo "[entrypoint] Migrations applied."
echo "[entrypoint] Starting Mail MCP..."
exec node server.js
