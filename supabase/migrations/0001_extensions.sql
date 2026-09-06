-- =====================================================================
-- Zirtan — 0001 · Uzantılar
-- Coğrafi sorgular (PostGIS), bulanık metin arama (pg_trgm),
-- kriptografi/rastgele kimlik (pgcrypto, uuid-ossp).
-- =====================================================================

-- Supabase'te uzantılar `extensions` şemasında tutulur; yerelde public'e düşer.
CREATE SCHEMA IF NOT EXISTS extensions;

CREATE EXTENSION IF NOT EXISTS postgis      WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm      WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto     WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"  WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS btree_gist   WITH SCHEMA extensions;  -- rezervasyon çakışma kısıtı için

-- Uzantı tipleri/işlevleri şema nitelemesi olmadan çözülsün
-- (Supabase'in kendi varsayılanıyla aynı: public, extensions).
DO $$
BEGIN
  EXECUTE format(
    'ALTER DATABASE %I SET search_path = public, extensions',
    current_database()
  );
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'search_path ayarlanamadı (yetki yok) — yoksayıldı.';
END $$;

SET search_path = public, extensions;
