-- =====================================================================
-- Zirtan — 0036 · Anlık bildirim adresleri (push token)
--
-- Sözleşme: NotificationRepository.registerPushToken / unregisterPushToken
--           (src/data/repositories/index.ts), src/domain/push.ts
--
-- **Neden ayrı tablo — bu bir güvenlik düzeltmesi.**
--
-- Adresler `profiles.push_tokens` sütununda duruyordu. Postgres'te RLS
-- **satır** düzeyindedir, sütun düzeyinde değil; `profiles_read_all` politikası
-- da profil kartlarını `anon` dahil herkese açıyor. Yani herhangi biri
-- `select push_tokens from profiles` ile bütün kullanıcıların cihaz adresini
-- toplayabiliyordu. Expo push adresi ele geçince o cihaza bildirim
-- gönderilebilir — sahte "acil durum" uyarısı dahil.
--
-- Ayrı tablo aynı anda ikinci bir sorunu da çözüyor: dizi sütununa yazmak
-- oku-birleştir-yaz gerektiriyordu ve iki cihaz aynı anda kaydolduğunda biri
-- diğerini eziyordu. Satır bazlı upsert'te yarış yok.
-- =====================================================================

CREATE TABLE push_tokens (
  user_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Expo push adresi: `ExponentPushToken[...]`
  token        text        NOT NULL,
  platform     text        NOT NULL DEFAULT 'unknown'
                           CHECK (platform IN ('ios', 'android', 'unknown')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- Her açılışta tazelenir; ölü cihazları ayıklamak için.
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, token)
);

-- Dağıtım alıcı kimliğine göre okuyor.
CREATE INDEX push_tokens_user_idx ON push_tokens (user_id);
-- Aynı adres cihaz devredildiğinde başka kullanıcıya geçebilir; eski sahibinden
-- düşürmek için adrese göre de aranıyor.
CREATE INDEX push_tokens_token_idx ON push_tokens (token);

-- RLS politikası 0100_rls.sql içinde (yardımcı yordamlar orada tanımlı):
-- yalnızca sahibi görür ve yazar, `anon` hiç erişemez.

COMMENT ON TABLE push_tokens IS
  'Cihaz bildirim adresleri. profiles sütunundan taşındı: RLS satır düzeyinde '
  'olduğu için açık profil tablosunda tutmak adresleri herkese okutuyordu.';

-- Sızıntının kaynağını kaldır. Dağıtım fonksiyonu (push-fanout) artık bu
-- tablodan okuyor.
ALTER TABLE profiles DROP COLUMN IF EXISTS push_tokens;
