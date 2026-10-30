#!/usr/bin/env bash
# Applies all migrations to a throwaway local Postgres with minimal Supabase
# stubs (auth schema, roles) and runs tests/db/*.sql assertions.
# Usage: bash scripts/test-migrations.sh   (requires postgres 15+ binaries)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DATA="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
cleanup() { ${RUN:-} "$PGBIN/pg_ctl" -D "$DATA" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT
if [ "$(id -u)" = "0" ]; then
  chown -R postgres "$DATA"; RUN="runuser -u postgres --"
else RUN=""; fi
$RUN "$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
$RUN "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp" -l "$DATA/log" start >/dev/null
PSQL="psql -h /tmp -p $PORT -U postgres -v ON_ERROR_STOP=1 -q -o /dev/null"
$PSQL -d postgres -f "$ROOT/tests/db/supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "applying $(basename "$f")"; $PSQL -d postgres -f "$f"
done
for f in "$ROOT"/tests/db/test_*.sql; do
  echo "running $(basename "$f")"; $PSQL -d postgres -f "$f"
done
echo "ALL DB TESTS PASSED"
