-- =====================================================================
-- Zirtan — 0024 · Gruplar & kanallar, mesajlar, anketler
-- Sözleşme: GroupRepository
-- İş kuralları (repos/groups.ts):
--   · 211 → özel gruba yalnızca davet koduyla katılım
--   · 234 → grup sahibi ayrılamaz
--   · 265 → rol değişimi yalnızca yöneticiye açık
--   · 269 → sahipliği yalnızca sahip devreder
--   · 297 → kanalda yalnızca yöneticiler yazabilir
--   · 312 → anket 2–6 seçenek
-- =====================================================================

SET search_path = public, extensions;

CREATE TABLE groups (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL CHECK (length(btrim(name)) >= 3),
  kind              group_kind    NOT NULL DEFAULT 'group',
  privacy           group_privacy NOT NULL DEFAULT 'public',
  description       text NOT NULL DEFAULT '',
  avatar_url        text,
  adventure_types   adventure_type[] NOT NULL DEFAULT '{}',
  city              text,
  country_code      char(2),
  owner_id          uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  member_count      integer NOT NULL DEFAULT 0 CHECK (member_count >= 0),
  invite_code       text NOT NULL UNIQUE,
  pinned_message_id uuid,          -- FK aşağıda (döngüsel bağımlılık)
  club_id           uuid REFERENCES clubs (id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  last_message_at   timestamptz
);
CREATE INDEX groups_owner_idx    ON groups (owner_id);
CREATE INDEX groups_public_idx   ON groups (last_message_at DESC NULLS LAST)
  WHERE privacy = 'public';
CREATE INDEX groups_name_trgm    ON groups USING GIN (name gin_trgm_ops);
CREATE INDEX groups_types_gin    ON groups USING GIN (adventure_types);
CREATE INDEX groups_club_idx     ON groups (club_id) WHERE club_id IS NOT NULL;

CREATE TABLE group_members (
  group_id     uuid NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  role         group_role NOT NULL DEFAULT 'member',
  joined_at    timestamptz NOT NULL DEFAULT now(),
  muted        boolean NOT NULL DEFAULT false,
  last_read_at timestamptz,
  -- Davet edilmiş ama henüz katılmamış (isPendingInvite)
  invited_by   uuid REFERENCES profiles (id) ON DELETE SET NULL,
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX group_members_user_idx    ON group_members (user_id);
CREATE INDEX group_members_role_idx    ON group_members (group_id, role);
CREATE INDEX group_members_invited_idx ON group_members (invited_by) WHERE invited_by IS NOT NULL;

-- Her grupta tek 'owner'
CREATE UNIQUE INDEX group_members_single_owner_idx ON group_members (group_id)
  WHERE role = 'owner';

CREATE TABLE group_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     uuid NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  sender_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  type         group_message_type NOT NULL DEFAULT 'text',
  text         text NOT NULL DEFAULT '',
  image_url    text,
  coords       geography(Point, 4326),
  route_id     uuid REFERENCES routes (id) ON DELETE SET NULL,
  -- {question, options: [{id, text, votes}], multi}
  poll         jsonb,
  reply_to_id  uuid REFERENCES group_messages (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  edited_at    timestamptz,
  CONSTRAINT group_messages_payload CHECK (
    CASE type
      WHEN 'text'     THEN length(btrim(text)) > 0
      WHEN 'image'    THEN image_url IS NOT NULL
      WHEN 'location' THEN coords    IS NOT NULL
      WHEN 'route'    THEN route_id  IS NOT NULL
      WHEN 'poll'     THEN poll      IS NOT NULL
                           AND jsonb_array_length(poll -> 'options') BETWEEN 2 AND 6
      ELSE true
    END
  )
);
CREATE INDEX group_messages_group_idx  ON group_messages (group_id, created_at DESC);
CREATE INDEX group_messages_sender_idx ON group_messages (sender_id);
CREATE INDEX group_messages_reply_idx  ON group_messages (reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE INDEX group_messages_route_idx  ON group_messages (route_id)    WHERE route_id    IS NOT NULL;
CREATE INDEX group_messages_coords_gix ON group_messages USING GIST (coords);

-- Sabitlenmiş mesaj bağı (mesaj silinirse sabitleme düşer)
ALTER TABLE groups
  ADD CONSTRAINT groups_pinned_message_fkey
  FOREIGN KEY (pinned_message_id) REFERENCES group_messages (id) ON DELETE SET NULL;
CREATE INDEX groups_pinned_idx ON groups (pinned_message_id) WHERE pinned_message_id IS NOT NULL;

CREATE TABLE poll_votes (
  message_id uuid NOT NULL REFERENCES group_messages (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  option_ids text[] NOT NULL CHECK (array_length(option_ids, 1) >= 1),
  voted_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
CREATE INDEX poll_votes_user_idx ON poll_votes (user_id);

-- Yeni mesaj grubun son etkinlik zamanını taşır.
CREATE OR REPLACE FUNCTION touch_group_activity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  UPDATE groups SET last_message_at = NEW.created_at WHERE id = NEW.group_id;
  RETURN NEW;
END $$;

CREATE TRIGGER group_messages_touch_group AFTER INSERT ON group_messages
  FOR EACH ROW EXECUTE FUNCTION touch_group_activity();

-- Grup sahibi ayrılamaz (groups.ts:234)
CREATE OR REPLACE FUNCTION forbid_owner_leave() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.role = 'owner' AND EXISTS (SELECT 1 FROM groups WHERE id = OLD.group_id) THEN
    RAISE EXCEPTION 'Grup sahibi ayrılamaz; önce sahipliği devret.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END $$;

CREATE TRIGGER group_members_owner_stays BEFORE DELETE ON group_members
  FOR EACH ROW EXECUTE FUNCTION forbid_owner_leave();

-- RLS yardımcıları
CREATE OR REPLACE FUNCTION is_group_member(grp uuid, viewer uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT EXISTS (SELECT 1 FROM group_members WHERE group_id = grp AND user_id = viewer)
$$;

CREATE OR REPLACE FUNCTION group_role_of(grp uuid, viewer uuid) RETURNS group_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT role FROM group_members WHERE group_id = grp AND user_id = viewer
$$;

CREATE OR REPLACE FUNCTION can_manage_group(grp uuid, viewer uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT group_role_of(grp, viewer) IN ('admin', 'owner')
$$;

-- Kanalda yalnızca yöneticiler yazabilir (groups.ts:297)
CREATE OR REPLACE FUNCTION can_post_to_group(grp uuid, viewer uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT CASE
    WHEN (SELECT kind FROM groups WHERE id = grp) = 'channel'
      THEN can_manage_group(grp, viewer)
    ELSE is_group_member(grp, viewer)
  END
$$;
