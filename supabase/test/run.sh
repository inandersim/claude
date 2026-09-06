#!/usr/bin/env bash
# =====================================================================
# Zirtan — migration doğrulama betiği
# Boş bir Postgres+PostGIS veritabanına şemayı sıfırdan uygular.
#
#   PGHOST=/tmp PGPORT=54322 PGUSER=postgres ./supabase/test/run.sh
#
# Docker'lı hızlı yol:
#   docker run --rm -e POSTGRES_PASSWORD=postgres -p 54322:5432 \
#     postgis/postgis:16-3.4
#   PGHOST=localhost PGPORT=54322 PGUSER=postgres PGPASSWORD=postgres \
#     ./supabase/test/run.sh
#
# `supabase start` kullanıyorsan bu betik gerekmez: `supabase db reset`
# migration'ları zaten sırayla uygular (shim'e de ihtiyaç olmaz).
# =====================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB="${ZIRTAN_TEST_DB:-zirtan_test}"
PSQL=(psql -v ON_ERROR_STOP=1 --quiet --no-psqlrc)

echo "→ $DB veritabanı yeniden oluşturuluyor"
"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS $DB" >/dev/null
"${PSQL[@]}" -d postgres -c "CREATE DATABASE $DB" >/dev/null

echo "→ Supabase iskelesi (yalnızca test)"
"${PSQL[@]}" -d "$DB" -f "$ROOT/supabase/test/00_supabase_shim.sql" >/dev/null

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ $(basename "$f")"
  "${PSQL[@]}" -d "$DB" -f "$f" >/dev/null
done

if [ -f "$ROOT/supabase/seed/seed.sql" ] && [ "${ZIRTAN_SKIP_SEED:-0}" != "1" ]; then
  echo "→ seed.sql"
  "${PSQL[@]}" -d "$DB" -f "$ROOT/supabase/seed/seed.sql" >/dev/null
fi

echo "→ şema doğrulaması"
"${PSQL[@]}" -d "$DB" -f "$ROOT/supabase/test/01_assertions.sql"

if [ -f "$ROOT/supabase/seed/seed.sql" ] && [ "${ZIRTAN_SKIP_SEED:-0}" != "1" ]; then
  echo "→ RLS ve fonksiyon testleri"
  "${PSQL[@]}" -d "$DB" -f "$ROOT/supabase/test/02_rls_tests.sql"
fi

echo "✓ Tüm migration'lar hatasız uygulandı."
