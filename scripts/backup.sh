#!/bin/sh
# Dumps the Postgres database to backups/, timestamped. Run this before any
# schema migration or risky operation on a live instance - see the
# migrations under prisma/migrations/ for examples of the two-phase
# expand/backfill/contract pattern this project uses for anything that isn't
# a simple additive change.
#
# Usage (from the project root, alongside docker-compose.prod.yml):
#   ./scripts/backup.sh
set -eu

cd "$(dirname "$0")/.."

# shellcheck disable=SC1091
[ -f .env ] && . ./.env

POSTGRES_USER="${POSTGRES_USER:-mcpemail}"
POSTGRES_DB="${POSTGRES_DB:-mcpemail}"
DB_CONTAINER="$(docker compose -f docker-compose.prod.yml ps -q db)"

if [ -z "$DB_CONTAINER" ]; then
  echo "Database container not running (docker compose -f docker-compose.prod.yml up -d db first)." >&2
  exit 1
fi

mkdir -p backups
OUT="backups/$(date -u +%Y%m%d%H%M%S).sql"

docker exec "$DB_CONTAINER" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > "$OUT"
echo "Backed up to $OUT"
