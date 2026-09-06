-- =====================================================================
-- Zirtan — 0013 · Rezervasyon envanteri, emanet (escrow) ödeme
-- Sözleşme: InventoryRepository
-- İş kuralları (repos/inventory.ts):
--   · 103  → envanter yönetimi yalnızca işletme sahibine açık
--   · 261  → rezervasyon yalnızca misafirine görünür/iptal edilebilir
--   · 328  → yorum yalnızca TAMAMLANMIŞ konaklama sonrası
--   · 437  → doğrulama seviyesi düşürülemez
-- =====================================================================

SET search_path = public, extensions;

CREATE TABLE stay_units (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id        uuid NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  name               text NOT NULL CHECK (length(btrim(name)) > 0),
  kind               unit_kind NOT NULL,
  capacity           smallint NOT NULL CHECK (capacity > 0),
  quantity           smallint NOT NULL DEFAULT 1 CHECK (quantity > 0),
  base_price_try     numeric(10, 2) NOT NULL CHECK (base_price_try > 0),
  weekend_multiplier numeric(4, 2) NOT NULL DEFAULT 1.0 CHECK (weekend_multiplier > 0),
  -- [{from, to, multiplier}] sezon aralıkları
  seasons            jsonb NOT NULL DEFAULT '[]'::jsonb,
  amenities          text[] NOT NULL DEFAULT '{}',
  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stay_units_business_idx ON stay_units (business_id) WHERE is_active;

CREATE TRIGGER stay_units_touch BEFORE UPDATE ON stay_units
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Rezervasyon birimi: stay_bookings'e envanter bağı
ALTER TABLE stay_bookings
  ADD COLUMN unit_id uuid REFERENCES stay_units (id) ON DELETE SET NULL;
CREATE INDEX stay_bookings_unit_idx ON stay_bookings (unit_id) WHERE unit_id IS NOT NULL;

-- --------------------------------------------------------------------
-- unit_blocks — dolu/kapalı tarih aralıkları
-- Çakışma kontrolü: aynı birimde aynı gün için EXCLUDE kısıtı.
-- `quantity > 1` olan birimlerde slot numarası ile ayrıştırılır.
-- --------------------------------------------------------------------
CREATE TABLE unit_blocks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id    uuid NOT NULL REFERENCES stay_units (id) ON DELETE CASCADE,
  -- [from, to) yarı açık aralık: çıkış günü yeniden satılabilir
  during     daterange NOT NULL,
  reason     unit_block_reason NOT NULL,
  booking_id uuid REFERENCES stay_bookings (id) ON DELETE CASCADE,
  -- 0..quantity-1 arası envanter slotu
  slot       smallint NOT NULL DEFAULT 0 CHECK (slot >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unit_blocks_range_not_empty CHECK (NOT isempty(during)),
  CONSTRAINT unit_blocks_booking_reason CHECK (
    (reason = 'booking') = (booking_id IS NOT NULL)
  ),
  -- Aynı birim + aynı slot için tarih aralıkları KESİŞEMEZ.
  CONSTRAINT unit_blocks_no_overlap
    EXCLUDE USING GIST (unit_id WITH =, slot WITH =, during WITH &&)
);
CREATE INDEX unit_blocks_unit_idx    ON unit_blocks USING GIST (unit_id, during);
CREATE INDEX unit_blocks_booking_idx ON unit_blocks (booking_id) WHERE booking_id IS NOT NULL;

COMMENT ON CONSTRAINT unit_blocks_no_overlap ON unit_blocks IS
  'Aşırı rezervasyonu (overbooking) veritabanı seviyesinde imkânsız kılar.';

-- --------------------------------------------------------------------
-- payments — domain: Payment (emanet akışı)
-- pending → authorized → escrow → released | refunded | failed
-- --------------------------------------------------------------------
CREATE TABLE payments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       uuid NOT NULL UNIQUE REFERENCES stay_bookings (id) ON DELETE CASCADE,
  payer_id         uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  amount_try       numeric(12, 2) NOT NULL CHECK (amount_try >= 0),
  platform_fee_try numeric(12, 2) NOT NULL DEFAULT 0 CHECK (platform_fee_try >= 0),
  status           payment_status   NOT NULL DEFAULT 'pending',
  provider         payment_provider NOT NULL DEFAULT 'mock',
  -- Sağlayıcıdaki işlem kimliği (webhook eşlemesi)
  provider_ref     text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  released_at      timestamptz,
  refunded_try     numeric(12, 2) NOT NULL DEFAULT 0 CHECK (refunded_try >= 0),
  -- [{status, at}] durum geçiş günlüğü (tetikleyici doldurur)
  timeline         jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_refund_le_amount CHECK (refunded_try <= amount_try),
  CONSTRAINT payments_released_consistency CHECK (
    status <> 'released' OR released_at IS NOT NULL
  )
);
CREATE INDEX payments_payer_idx    ON payments (payer_id, created_at DESC);
CREATE INDEX payments_status_idx   ON payments (status, created_at DESC);
CREATE UNIQUE INDEX payments_provider_ref_key ON payments (provider, provider_ref)
  WHERE provider_ref IS NOT NULL;

CREATE TRIGGER payments_touch BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- --------------------------------------------------------------------
-- stay_reviews — yalnızca tamamlanmış konaklama sonrası
-- --------------------------------------------------------------------
CREATE TABLE stay_reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  booking_id    uuid NOT NULL REFERENCES stay_bookings (id) ON DELETE CASCADE,
  author_id     uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  rating        smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text          text NOT NULL DEFAULT '',
  verified_stay boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- Her rezervasyon için tek yorum (inventory.ts:331)
  UNIQUE (booking_id)
);
CREATE INDEX stay_reviews_business_idx ON stay_reviews (business_id, created_at DESC);
CREATE INDEX stay_reviews_author_idx   ON stay_reviews (author_id);

-- --------------------------------------------------------------------
-- host_profiles — işletme başına ev sahibi ayarları
-- --------------------------------------------------------------------
CREATE TABLE host_profiles (
  business_id         uuid PRIMARY KEY REFERENCES businesses (id) ON DELETE CASCADE,
  verification        host_verification_level NOT NULL DEFAULT 'none',
  cancellation_policy cancellation_policy     NOT NULL DEFAULT 'moderate',
  response_rate_pct   smallint NOT NULL DEFAULT 100 CHECK (response_rate_pct BETWEEN 0 AND 100),
  response_time_min   integer  NOT NULL DEFAULT 60 CHECK (response_time_min >= 0),
  payout_iban         text,
  pending_payout_try  numeric(12, 2) NOT NULL DEFAULT 0 CHECK (pending_payout_try >= 0),
  paid_out_try        numeric(12, 2) NOT NULL DEFAULT 0 CHECK (paid_out_try >= 0),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Doğrulama seviyesi düşürülemez (inventory.ts:437)
CREATE OR REPLACE FUNCTION forbid_verification_downgrade() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  ranks constant host_verification_level[] := ARRAY['none', 'id', 'address', 'premium']::host_verification_level[];
BEGIN
  IF array_position(ranks, NEW.verification) < array_position(ranks, OLD.verification) THEN
    RAISE EXCEPTION 'Doğrulama seviyesi düşürülemez.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER host_profiles_no_downgrade BEFORE UPDATE OF verification ON host_profiles
  FOR EACH ROW EXECUTE FUNCTION forbid_verification_downgrade();

CREATE TRIGGER host_profiles_touch BEFORE UPDATE ON host_profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
