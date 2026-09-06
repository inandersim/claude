-- =====================================================================
-- Zirtan — 0008 · İkinci el market
-- Sözleşme: MarketRepository
-- İş kuralı (provider.ts:934): ilanı yalnızca SATICI kapatabilir.
-- =====================================================================

SET search_path = public, extensions;

CREATE TABLE listings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id        uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  title            text NOT NULL CHECK (length(btrim(title)) > 0),
  description      text NOT NULL DEFAULT '',
  price_try        numeric(12, 2) NOT NULL CHECK (price_try >= 0),
  category         listing_category  NOT NULL,
  condition        listing_condition NOT NULL,
  image_urls       text[] NOT NULL DEFAULT '{}',
  location_name    text NOT NULL DEFAULT '',
  coords           geography(Point, 4326),
  adventure_types  adventure_type[] NOT NULL DEFAULT '{}',
  is_sold          boolean NOT NULL DEFAULT false,
  favorites_count  integer NOT NULL DEFAULT 0 CHECK (favorites_count >= 0),
  sold_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listings_sold_consistency CHECK (is_sold = (sold_at IS NOT NULL))
);
CREATE INDEX listings_open_idx      ON listings (created_at DESC) WHERE NOT is_sold;
CREATE INDEX listings_seller_idx    ON listings (seller_id, created_at DESC);
CREATE INDEX listings_category_idx  ON listings (category, created_at DESC);
CREATE INDEX listings_title_trgm    ON listings USING GIN (title gin_trgm_ops);
CREATE INDEX listings_desc_trgm     ON listings USING GIN (description gin_trgm_ops);
CREATE INDEX listings_coords_gix    ON listings USING GIST (coords);
CREATE INDEX listings_types_gin     ON listings USING GIN (adventure_types);

CREATE TRIGGER listings_touch BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE listing_favorites (
  user_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);
CREATE INDEX listing_favorites_listing_idx ON listing_favorites (listing_id);
