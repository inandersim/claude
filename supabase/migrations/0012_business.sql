-- =====================================================================
-- Zirtan — 0012 · İşletmeler ve konaklama talepleri
-- Sözleşme: BusinessRepository
-- İş kuralı (provider.ts:1320): priceFromTry NULL ise konaklama sunulmaz.
-- =====================================================================

SET search_path = public, extensions;

CREATE TABLE businesses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  name            text NOT NULL CHECK (length(btrim(name)) > 0),
  type            business_type NOT NULL,
  description     text NOT NULL DEFAULT '',
  location_name   text NOT NULL DEFAULT '',
  coords          geography(Point, 4326),
  image_url       text,
  rating          numeric(3, 2) NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  review_count    integer NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  is_verified     boolean NOT NULL DEFAULT false,
  -- Konaklama için gecelik başlangıç fiyatı; diğer türlerde NULL
  price_from_try  numeric(10, 2) CHECK (price_from_try IS NULL OR price_from_try >= 0),
  amenities       text[] NOT NULL DEFAULT '{}',
  adventure_types adventure_type[] NOT NULL DEFAULT '{}',
  website         text,
  phone           text,
  plan            plan NOT NULL DEFAULT 'free',
  is_featured     boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX businesses_owner_idx    ON businesses (owner_id);
CREATE INDEX businesses_coords_gix   ON businesses USING GIST (coords);
CREATE INDEX businesses_type_idx     ON businesses (type);
CREATE INDEX businesses_name_trgm    ON businesses USING GIN (name gin_trgm_ops);
CREATE INDEX businesses_stays_idx    ON businesses (rating DESC) WHERE price_from_try IS NOT NULL;
CREATE INDEX businesses_featured_idx ON businesses (created_at DESC) WHERE is_featured;

CREATE TRIGGER businesses_touch BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- İşletme sahipliği (RLS + envanter yetkisi; inventory.ts:103)
CREATE OR REPLACE FUNCTION owns_business(business uuid, viewer uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT EXISTS (SELECT 1 FROM businesses WHERE id = business AND owner_id = viewer)
$$;

-- --------------------------------------------------------------------
-- stay_bookings — domain: StayBooking
-- Envanter modülü (0013) `unit_id` ve `payment` ile bu tabloyu genişletir.
-- --------------------------------------------------------------------
CREATE TABLE stay_bookings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  guest_id          uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  check_in          date NOT NULL,
  check_out         date NOT NULL,
  guests            smallint NOT NULL DEFAULT 1 CHECK (guests > 0),
  nights            integer  NOT NULL CHECK (nights > 0),
  total_try         numeric(12, 2) NOT NULL CHECK (total_try >= 0),
  platform_fee_try  numeric(12, 2) NOT NULL DEFAULT 0 CHECK (platform_fee_try >= 0),
  status            stay_status NOT NULL DEFAULT 'pending',
  checked_in_at     timestamptz,
  cancelled_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stay_bookings_dates CHECK (check_out > check_in),
  CONSTRAINT stay_bookings_nights_match CHECK (nights = (check_out - check_in))
);
CREATE INDEX stay_bookings_business_idx ON stay_bookings (business_id, check_in);
CREATE INDEX stay_bookings_guest_idx    ON stay_bookings (guest_id, created_at DESC);
CREATE INDEX stay_bookings_active_idx   ON stay_bookings (business_id, status)
  WHERE status IN ('pending', 'confirmed');

CREATE TRIGGER stay_bookings_touch BEFORE UPDATE ON stay_bookings
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
