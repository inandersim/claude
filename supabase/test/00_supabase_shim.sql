-- =====================================================================
-- Zirtan — YEREL TEST İSKELESİ (üretimde ÇALIŞTIRILMAZ)
-- Supabase platformunun migration'ların bağlı olduğu parçalarını
-- (auth şeması, storage şeması, realtime publication, roller) taklit eder.
-- Gerçek Supabase'te bunların hepsi zaten mevcuttur; bu dosya yalnızca
-- `supabase/test/run.sh` ile saf bir Postgres+PostGIS üzerinde
-- migration'ları doğrulamak için kullanılır.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS realtime;

DO $$ BEGIN CREATE ROLE anon           NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated  NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role   NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE supabase_admin NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticator  NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS auth.users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email              text UNIQUE,
  encrypted_password text,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- İstek başına kimlik: testlerde `SET LOCAL request.jwt.claim.sub = '<uuid>'`.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
$$;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id                 text PRIMARY KEY,
  name               text NOT NULL,
  owner              uuid,
  public             boolean NOT NULL DEFAULT false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id  text REFERENCES storage.buckets (id),
  name       text NOT NULL,
  owner      uuid,
  metadata   jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;

DO $$ BEGIN
  CREATE PUBLICATION supabase_realtime;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
