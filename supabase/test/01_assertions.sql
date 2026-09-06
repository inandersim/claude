-- Şema sağlık kontrolleri: her tabloda RLS açık mı, sayımlar tutuyor mu?
\pset pager off

SELECT count(*) AS "public tablo sayısı"
FROM pg_tables WHERE schemaname = 'public';

SELECT count(*) AS "enum tipi sayısı"
FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE t.typtype = 'e' AND n.nspname = 'public';

SELECT count(*) AS "fonksiyon sayısı"
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public';

SELECT count(*) AS "tetikleyici sayısı"
FROM pg_trigger WHERE NOT tgisinternal;

SELECT count(*) AS "politika sayısı" FROM pg_policies WHERE schemaname = 'public';

SELECT count(*) AS "RLS acik tablo" FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity;

-- RLS'i açık olmayan tablo kalmamalı.
DO $$
DECLARE missing text;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO missing
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
    AND c.relname NOT IN ('spatial_ref_sys');
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'RLS kapalı tablolar: %', missing;
  END IF;
END $$;

-- RLS açık ama politikası olmayan tablo kalmamalı (erişilemez tablo).
DO $$
DECLARE missing text;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO missing
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
    AND NOT EXISTS (SELECT 1 FROM pg_policies p
                    WHERE p.schemaname = 'public' AND p.tablename = c.relname);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Politikasız tablolar: %', missing;
  END IF;
END $$;

-- Her yabancı anahtarın altında bir indeks olmalı (yavaş silme/join'i önler).
SELECT conrelid::regclass::text AS tablo, conname AS kisit
FROM pg_constraint c
WHERE c.contype = 'f'
  AND connamespace = 'public'::regnamespace
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid
      AND (i.indkey::smallint[])[0:array_length(c.conkey, 1) - 1] @> c.conkey
  )
ORDER BY 1, 2;
