-- =====================================================================
-- Zirtan — 0005 · ZMatch, birebir mesajlar, bildirimler
-- Sözleşme: MatchRepository, MessageRepository, NotificationRepository
-- =====================================================================

SET search_path = public, extensions;

-- --------------------------------------------------------------------
-- matches — domain: ZMatch (macera arkadaşı eşleşmesi)
-- İş kuralı (provider.ts:503): isteğe yalnızca ALICI yanıt verebilir.
-- --------------------------------------------------------------------
CREATE TABLE matches (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id   uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  receiver_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  status         match_status NOT NULL DEFAULT 'pending',
  message        text NOT NULL DEFAULT '',
  planned_date   timestamptz,
  location_name  text,
  adventure_type adventure_type NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  responded_at   timestamptz,
  CONSTRAINT matches_no_self CHECK (requester_id <> receiver_id),
  CONSTRAINT matches_responded_when_answered CHECK (
    status = 'pending' OR responded_at IS NOT NULL
  )
);
-- Aynı çift arasında aynı anda tek bekleyen istek olsun.
CREATE UNIQUE INDEX matches_one_pending_idx
  ON matches (requester_id, receiver_id) WHERE status = 'pending';
CREATE INDEX matches_receiver_idx ON matches (receiver_id, status, created_at DESC);
CREATE INDEX matches_requester_idx ON matches (requester_id, status, created_at DESC);

-- Kabul edilmiş eşleşme (canlı konum "matches" modu için)
CREATE OR REPLACE FUNCTION is_matched(a uuid, b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT EXISTS (
    SELECT 1 FROM matches
    WHERE status = 'accepted'
      AND ((requester_id = a AND receiver_id = b) OR (requester_id = b AND receiver_id = a))
  )
$$;

-- --------------------------------------------------------------------
-- messages — domain: Message (birebir sohbet)
-- --------------------------------------------------------------------
CREATE TABLE messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  content     text NOT NULL CHECK (length(btrim(content)) > 0),
  -- Eşleşme silinse de mesaj geçmişi korunur
  match_id    uuid REFERENCES matches (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  read_at     timestamptz,
  CONSTRAINT messages_no_self CHECK (sender_id <> receiver_id)
);
-- Sohbet açılışı: iki yönlü konuşmayı tek indeksle taramak için
-- least/greatest ile normalize edilmiş çift anahtarı.
CREATE INDEX messages_thread_idx ON messages (
  least(sender_id, receiver_id), greatest(sender_id, receiver_id), created_at DESC
);
CREATE INDEX messages_inbox_idx  ON messages (receiver_id, created_at DESC);
CREATE INDEX messages_unread_idx ON messages (receiver_id) WHERE read_at IS NULL;
CREATE INDEX messages_sender_idx ON messages (sender_id);
CREATE INDEX messages_match_idx  ON messages (match_id) WHERE match_id IS NOT NULL;

-- --------------------------------------------------------------------
-- notifications — domain: Notification
-- `target_id` tehlike/yayın/ilan/rezervasyon gibi serbest hedefleri taşır;
-- çok sayıda tabloya işaret ettiği için FK yerine tip + metin kimlik.
-- --------------------------------------------------------------------
CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type        notification_type NOT NULL,
  sender_id   uuid REFERENCES profiles (id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  message     text NOT NULL DEFAULT '',
  is_read     boolean NOT NULL DEFAULT false,
  post_id     uuid REFERENCES posts (id) ON DELETE CASCADE,
  match_id    uuid REFERENCES matches (id) ON DELETE CASCADE,
  target_id   text,
  -- Push gönderimi (push-fanout edge fonksiyonu) durumu
  pushed_at   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_inbox_idx  ON notifications (receiver_id, created_at DESC);
CREATE INDEX notifications_unread_idx ON notifications (receiver_id) WHERE NOT is_read;
CREATE INDEX notifications_sender_idx ON notifications (sender_id);
CREATE INDEX notifications_post_idx   ON notifications (post_id) WHERE post_id IS NOT NULL;
CREATE INDEX notifications_match_idx  ON notifications (match_id) WHERE match_id IS NOT NULL;
CREATE INDEX notifications_pending_push_idx ON notifications (created_at)
  WHERE pushed_at IS NULL;

COMMENT ON COLUMN notifications.target_id IS
  'Tehlike/yayın/ilan/rezervasyon vb. hedef kimliği (çok tablolu, FK yok).';
