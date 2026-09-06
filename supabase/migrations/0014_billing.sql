-- =====================================================================
-- Zirtan — 0014 · Faturalama ve planlar
-- Sözleşme: BillingRepository (currentPlan, subscribe, earnings)
-- =====================================================================

SET search_path = public, extensions;

-- Plan tanımları (fiyat/limit tablosu; uygulama okur)
CREATE TABLE plan_definitions (
  plan              plan PRIMARY KEY,
  monthly_price_try numeric(10, 2) NOT NULL DEFAULT 0 CHECK (monthly_price_try >= 0),
  yearly_price_try  numeric(10, 2) NOT NULL DEFAULT 0 CHECK (yearly_price_try >= 0),
  -- Zirtan komisyon oranı (rezervasyon/ders geliri üzerinden)
  commission_pct    numeric(5, 2) NOT NULL DEFAULT 10 CHECK (commission_pct BETWEEN 0 AND 100),
  features          jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order        smallint NOT NULL DEFAULT 0
);

INSERT INTO plan_definitions (plan, monthly_price_try, yearly_price_try, commission_pct, sort_order)
VALUES
  ('free',      0,    0,     15, 0),
  ('pro',       149,  1490,  12, 1),
  ('pro_guide', 349,  3490,  10, 2),
  ('business',  899,  8990,   8, 3)
ON CONFLICT (plan) DO NOTHING;

-- --------------------------------------------------------------------
-- subscriptions — abonelik geçmişi (profiles.plan güncel durumu tutar)
-- --------------------------------------------------------------------
CREATE TABLE subscriptions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  plan           plan NOT NULL REFERENCES plan_definitions (plan),
  period         billing_period NOT NULL,
  price_try      numeric(10, 2) NOT NULL CHECK (price_try >= 0),
  provider       payment_provider NOT NULL DEFAULT 'mock',
  provider_ref   text,
  started_at     timestamptz NOT NULL DEFAULT now(),
  current_end_at timestamptz NOT NULL,
  cancelled_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_period_valid CHECK (current_end_at > started_at)
);
CREATE INDEX subscriptions_user_idx   ON subscriptions (user_id, started_at DESC);
CREATE INDEX subscriptions_active_idx ON subscriptions (current_end_at)
  WHERE cancelled_at IS NULL;
CREATE INDEX subscriptions_plan_idx   ON subscriptions (plan);

-- Abonelik yazıldığında profiles.plan senkronlanır.
CREATE OR REPLACE FUNCTION sync_profile_plan() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  UPDATE profiles
     SET plan = NEW.plan, plan_period = NEW.period, plan_renews_at = NEW.current_end_at
   WHERE id = NEW.user_id;
  RETURN NEW;
END $$;

CREATE TRIGGER subscriptions_sync_plan AFTER INSERT ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION sync_profile_plan();

-- --------------------------------------------------------------------
-- payouts — eğitmen/işletme hakedişleri (earnings özetinin kaynağı)
-- --------------------------------------------------------------------
CREATE TABLE payouts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  business_id    uuid REFERENCES businesses (id) ON DELETE SET NULL,
  gross_try      numeric(12, 2) NOT NULL CHECK (gross_try >= 0),
  commission_try numeric(12, 2) NOT NULL CHECK (commission_try >= 0),
  net_try        numeric(12, 2) NOT NULL CHECK (net_try >= 0),
  period_start   date NOT NULL,
  period_end     date NOT NULL,
  paid_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payouts_period CHECK (period_end >= period_start),
  CONSTRAINT payouts_net_math CHECK (net_try = gross_try - commission_try)
);
CREATE INDEX payouts_user_idx     ON payouts (user_id, period_start DESC);
CREATE INDEX payouts_business_idx ON payouts (business_id) WHERE business_id IS NOT NULL;
CREATE INDEX payouts_unpaid_idx   ON payouts (created_at) WHERE paid_at IS NULL;
