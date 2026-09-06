-- =====================================================================
-- Zirtan — 0007 · Canlı yayın (kamera / drone)
-- Sözleşme: LiveRepository
-- İş kuralı (provider.ts:823): yayını yalnızca YAYINCI bitirebilir.
-- =====================================================================

SET search_path = public, extensions;

CREATE TABLE live_streams (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id         uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  title           text NOT NULL CHECK (length(btrim(title)) > 0),
  description     text NOT NULL DEFAULT '',
  adventure_type  adventure_type NOT NULL,
  status          stream_status  NOT NULL DEFAULT 'scheduled',
  location_name   text NOT NULL DEFAULT '',
  coords          geography(Point, 4326),
  viewer_count    integer NOT NULL DEFAULT 0 CHECK (viewer_count >= 0),
  peak_viewers    integer NOT NULL DEFAULT 0 CHECK (peak_viewers >= 0),
  likes_count     integer NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
  thumbnail_url   text,
  playback_url    text,
  scheduled_at    timestamptz,
  started_at      timestamptz,
  ended_at        timestamptz,
  altitude_m      integer,
  source          stream_source NOT NULL DEFAULT 'camera',
  -- DroneTelemetry: {altitudeM, speedKmh, batteryPct, headingDeg, distanceFromPilotM}
  drone_telemetry jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_streams_live_has_start CHECK (status <> 'live'  OR started_at IS NOT NULL),
  CONSTRAINT live_streams_ended_has_end  CHECK (status <> 'ended' OR ended_at   IS NOT NULL)
);
CREATE INDEX live_streams_status_idx ON live_streams (status, started_at DESC);
CREATE INDEX live_streams_host_idx   ON live_streams (host_id, created_at DESC);
CREATE INDEX live_streams_coords_gix ON live_streams USING GIST (coords);
CREATE INDEX live_streams_live_idx   ON live_streams (viewer_count DESC) WHERE status = 'live';

CREATE TABLE stream_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id  uuid NOT NULL REFERENCES live_streams (id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  content    text NOT NULL CHECK (length(btrim(content)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stream_messages_stream_idx ON stream_messages (stream_id, created_at);
CREATE INDEX stream_messages_author_idx ON stream_messages (author_id);

-- İzleyici beğenisi (LiveRepository.like sayacının kaynağı)
CREATE TABLE stream_likes (
  stream_id  uuid NOT NULL REFERENCES live_streams (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (stream_id, user_id)
);
CREATE INDEX stream_likes_user_idx ON stream_likes (user_id);
