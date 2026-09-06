-- =====================================================================
-- Zirtan — 0023 · Kamera ile görüntü analizi
-- Sözleşme: VisionRepository (analyze, history, clearHistory)
-- Kişisel veri: geçmiş YALNIZCA sahibine görünür.
-- =====================================================================

SET search_path = public, extensions;

CREATE TABLE vision_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  situation     vision_situation NOT NULL,
  question      text NOT NULL DEFAULT '',
  thumbnail_uri text,
  -- Storage'daki tam boy görsel yolu (vision bucket)
  image_path    text,
  observations  text[] NOT NULL DEFAULT '{}',
  risk          risk_level NOT NULL DEFAULT 'low',
  advice        text[] NOT NULL DEFAULT '{}',
  avoid         text[] NOT NULL DEFAULT '{}',
  -- [{label, href, icon}]
  actions       jsonb NOT NULL DEFAULT '[]'::jsonb,
  source        advice_source NOT NULL DEFAULT 'local',
  confidence    numeric(4, 3) NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 1),
  coords        geography(Point, 4326),
  altitude_m    integer,
  locale        text NOT NULL DEFAULT 'tr',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vision_history_user_idx   ON vision_history (user_id, created_at DESC);
CREATE INDEX vision_history_coords_gix ON vision_history USING GIST (coords);
CREATE INDEX vision_history_risk_idx   ON vision_history (risk) WHERE risk IN ('high', 'extreme');
