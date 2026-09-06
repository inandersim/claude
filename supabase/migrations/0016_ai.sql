-- =====================================================================
-- Zirtan — 0016 · Yapay zekâ asistanı (sohbet konuları)
-- Sözleşme: AiRepository
-- Kişisel veri: konular ve mesajlar YALNIZCA sahibine görünür.
-- =====================================================================

SET search_path = public, extensions;

CREATE TABLE ai_threads (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  title      text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_threads_user_idx ON ai_threads (user_id, updated_at DESC);

CREATE TABLE ai_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  uuid NOT NULL REFERENCES ai_threads (id) ON DELETE CASCADE,
  role       ai_role NOT NULL,
  content    text NOT NULL,
  intent     ai_intent,
  -- [{label, href, icon}] uygulama içi bağlantılar
  actions    jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Maliyet izleme
  tokens_in  integer,
  tokens_out integer,
  model      text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_messages_thread_idx ON ai_messages (thread_id, created_at);

-- Yeni mesaj konunun updated_at'ini tazeler (konu listesi sıralaması).
CREATE OR REPLACE FUNCTION touch_ai_thread() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  UPDATE ai_threads SET updated_at = now() WHERE id = NEW.thread_id;
  RETURN NEW;
END $$;

CREATE TRIGGER ai_messages_touch_thread AFTER INSERT ON ai_messages
  FOR EACH ROW EXECUTE FUNCTION touch_ai_thread();

-- --------------------------------------------------------------------
-- ai_trip_plans — AiRepository.planTrip çıktısının saklanması
-- --------------------------------------------------------------------
CREATE TABLE ai_trip_plans (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  thread_id      uuid REFERENCES ai_threads (id) ON DELETE SET NULL,
  title          text NOT NULL,
  adventure_type adventure_type NOT NULL,
  -- {days: [...], packing: [...], safety: [...]}
  plan           jsonb NOT NULL,
  prompt         text NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_trip_plans_user_idx   ON ai_trip_plans (user_id, created_at DESC);
CREATE INDEX ai_trip_plans_thread_idx ON ai_trip_plans (thread_id) WHERE thread_id IS NOT NULL;
