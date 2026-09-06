-- =====================================================================
-- Zirtan — 0035 · Telefonla kayıt ve SMS doğrulama (OTP)
--
-- Sözleşme: PhoneAuthRepository (src/data/repositories/index.ts),
--           src/data/remote/repos/auth.ts, src/domain/phone.ts
--
-- Supabase Auth telefon OTP'sini kendisi yürütür (kod üretimi, SMS gönderimi,
-- kod ömrü, temel hız sınırı → `supabase/config.toml` [auth.sms]). Bu migration
-- uygulama tarafını tamamlar:
--   1. Numara → kullanıcı bağı ve **benzersizlik** (user_phones)
--   2. Kayıt tamamlandı mı bayrağı (profiles.profile_completed)
--   3. Kullanıcı adı benzersizlik denetimi (RPC)
--   4. Sunucu tarafı hız sınırı defteri (otp_attempts) — numara sıralama
--      saldırısına karşı IP + numara birlikte sayılır
-- =====================================================================

SET search_path = public, extensions;

-- --------------------------------------------------------------------
-- profiles: kayıt tamamlanma durumu
-- --------------------------------------------------------------------
-- Telefonla giren kullanıcının profili tetikleyiciyle **geçici** adla açılır;
-- görünen ad ve kullanıcı adı `completeProfile` adımında yazılır. Bu bayrak
-- "kayıt ekranı gerekli mi" sorusunun tek kaynağıdır.
--
-- Varsayılan `true`: mevcut satırlar ve demo tohumu tamamlanmış sayılır;
-- yalnızca tetikleyici, telefonla açılan yeni kayıtlara `false` yazar.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_completed boolean NOT NULL DEFAULT true;
-- Numarası doğrulanmış hesaplar (rozet ve güven skoru için; numaranın kendisi
-- burada DEĞİL, user_phones tablosunda durur).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.profile_completed IS
  'false → ad/kullanıcı adı adımı bekliyor (telefonla ilk kayıt).';
COMMENT ON COLUMN profiles.phone_verified IS
  'Hesabın doğrulanmış bir telefon numarası var mı (numara user_phones''ta).';

-- --------------------------------------------------------------------
-- user_phones — doğrulanmış numara ↔ kullanıcı (1-1), benzersiz
-- --------------------------------------------------------------------
-- NEDEN AYRI TABLO: `profiles` üzerindeki SELECT politikası herkese açıktır
-- (`profiles_read_all`, 0100_rls.sql) ve PostgREST `select=*` kullandığı için
-- kolon düzeyinde yetki kısıtlaması istemciyi kırar. Telefon numarası kişisel
-- veridir; ayrı tabloda **yalnızca sahibine** açılır. Numaranın uygulama
-- genelindeki benzersizliği buradaki tekil indeksle güvence altına alınır
-- (auth.users.phone zaten GoTrue tarafında benzersizdir; bu ikinci settir).
CREATE TABLE IF NOT EXISTS user_phones (
  user_id     uuid PRIMARY KEY REFERENCES profiles (id) ON DELETE CASCADE,
  -- E.164: '+' + ülke kodu + ulusal numara, 7–15 hane (ITU-T E.164)
  phone       text NOT NULL CHECK (phone ~ '^\+[1-9][0-9]{6,14}$'),
  verified_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_phones_phone_key ON user_phones (phone);

ALTER TABLE user_phones ENABLE ROW LEVEL SECURITY;
-- Kişi yalnızca kendi numarasını okur. Yazma yoktur: satırı yalnızca
-- `handle_new_auth_user` (SECURITY DEFINER) açar; numara değişikliği
-- Supabase Auth'un `phone_change` akışıyla yapılır.
DROP POLICY IF EXISTS user_phones_read_own ON user_phones;
CREATE POLICY user_phones_read_own ON user_phones FOR SELECT TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE user_phones IS
  'Doğrulanmış telefon numarası (E.164). Yalnızca sahibi okuyabilir.';

-- --------------------------------------------------------------------
-- handle_new_auth_user — telefonla açılan kayıtları da karşılar
-- --------------------------------------------------------------------
-- 0003_core.sql'deki sürümün üzerine yazar. Farklar:
--   · Kullanıcı adı kaynağına telefon eklendi (e-posta yoksa 'gezgin<son4>')
--   · Telefonla gelen kayıt `profile_completed = false` ile açılır
--   · Numara varsa user_phones satırı yazılır ve phone_verified işaretlenir
CREATE OR REPLACE FUNCTION handle_new_auth_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  base_username text;
  final_username text;
  suffix integer := 0;
  has_names boolean;
BEGIN
  -- Meta veride ad geldiyse kayıt tamamlanmış sayılır (e-posta akışı).
  has_names := coalesce(NEW.raw_user_meta_data ->> 'username', '') <> ''
           AND coalesce(NEW.raw_user_meta_data ->> 'display_name', '') <> '';

  base_username := lower(regexp_replace(
    coalesce(
      NEW.raw_user_meta_data ->> 'username',
      nullif(split_part(coalesce(NEW.email, ''), '@', 1), ''),
      CASE WHEN NEW.phone IS NOT NULL
           THEN 'gezgin' || right(regexp_replace(NEW.phone, '[^0-9]', '', 'g'), 4)
           END,
      'gezgin'),
    '[^a-zA-Z0-9._]', '', 'g'));
  IF length(base_username) < 3 THEN
    base_username := base_username || 'gezgin';
  END IF;
  base_username := left(base_username, 24);
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM profiles p WHERE lower(p.username) = final_username) LOOP
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  END LOOP;

  INSERT INTO profiles (
    id, username, display_name, avatar_url, locale, profile_completed, phone_verified
  )
  VALUES (
    NEW.id,
    final_username,
    coalesce(NEW.raw_user_meta_data ->> 'display_name', final_username),
    NEW.raw_user_meta_data ->> 'avatar_url',
    coalesce(NEW.raw_user_meta_data ->> 'locale', 'tr'),
    has_names,
    NEW.phone IS NOT NULL
  )
  ON CONFLICT (id) DO NOTHING;

  IF NEW.phone IS NOT NULL THEN
    INSERT INTO user_phones (user_id, phone)
    VALUES (NEW.id, NEW.phone)
    ON CONFLICT (user_id) DO UPDATE SET phone = EXCLUDED.phone, verified_at = now();
  END IF;

  RETURN NEW;
END $$;

-- --------------------------------------------------------------------
-- is_username_available — kayıt ekranındaki canlı benzersizlik denetimi
-- --------------------------------------------------------------------
-- SECURITY DEFINER: aday adın **var olup olmadığı** dışında hiçbir bilgi
-- sızdırmaz; çağıran profil okuma yetkisine ihtiyaç duymaz. Biçim kuralı
-- `src/domain/phone.ts::validateUsername` ile aynıdır.
CREATE OR REPLACE FUNCTION is_username_available(candidate text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT candidate ~ '^[a-z0-9._]{3,24}$'
     AND candidate !~ '^[._]'
     AND candidate !~ '[._]$'
     AND NOT EXISTS (
       SELECT 1 FROM profiles p WHERE lower(p.username) = lower(candidate)
     )
$$;
REVOKE ALL ON FUNCTION is_username_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_username_available(text) TO anon, authenticated;

COMMENT ON FUNCTION is_username_available(text) IS
  'Kullanıcı adı biçim + benzersizlik denetimi (kayıt ekranı).';

-- --------------------------------------------------------------------
-- otp_attempts — sunucu tarafı hız sınırı defteri
-- --------------------------------------------------------------------
-- GoTrue kendi sınırlarını uygular; bu defter **numara sıralama** (enumeration)
-- saldırısını görünür kılar ve IP başına sınırı mümkün eder. Ham numara
-- SAKLANMAZ: yalnızca peppered SHA-256 özeti tutulur, böylece veritabanı
-- sızsa bile numara listesi elde edilemez.
CREATE TABLE IF NOT EXISTS otp_attempts (
  id         bigserial PRIMARY KEY,
  -- sha256(pepper || E164) — ham numara değil
  phone_hash text NOT NULL,
  ip         inet,
  kind       text NOT NULL CHECK (kind IN ('send', 'verify')),
  succeeded  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS otp_attempts_phone_idx ON otp_attempts (phone_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS otp_attempts_ip_idx    ON otp_attempts (ip, created_at DESC);

ALTER TABLE otp_attempts ENABLE ROW LEVEL SECURITY;
-- Hiçbir istemci rolü okuyamaz/yazamaz; yalnızca `service_role`
-- (Edge Function / GoTrue webhook) erişir — o rol RLS'i zaten atlar.
--
-- Politikayı hiç yazmamak da aynı sonucu verirdi, ama niyet örtük kalırdı:
-- "unutulmuş politika" ile "kasten kapalı" ayırt edilemezdi. Açık `false`
-- politikası bunu denetlenebilir kılar (01_assertions.sql politikasız tablo aramaz,
-- politikası olmayan tabloyu hata sayar).
CREATE POLICY otp_attempts_no_client_access ON otp_attempts
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON TABLE otp_attempts FROM anon, authenticated;

COMMENT ON TABLE otp_attempts IS
  'OTP gönderim/doğrulama denemeleri (numara özeti + IP). Yalnızca service_role.';

-- 24 saatten eski kayıtları siler; pg_cron ya da zamanlayıcı çağırır.
CREATE OR REPLACE FUNCTION prune_otp_attempts(older_than interval DEFAULT '24 hours')
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  removed integer;
BEGIN
  DELETE FROM otp_attempts WHERE created_at < now() - older_than;
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END $$;
REVOKE ALL ON FUNCTION prune_otp_attempts(interval) FROM PUBLIC;
