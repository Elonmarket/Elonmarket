-- Game logic: cooldown status, cooldown_end_time, game_config
-- Run this on a fresh Supabase project to support full round lifecycle and admin game settings.

-- 1. Add 'cooldown' to round_status enum (required for detect-winner)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'round_status' AND e.enumlabel = 'cooldown'
  ) THEN
    ALTER TYPE public.round_status ADD VALUE 'cooldown';
  END IF;
END
$$;

-- 2. Add cooldown_end_time to prediction_rounds
ALTER TABLE public.prediction_rounds
  ADD COLUMN IF NOT EXISTS cooldown_end_time TIMESTAMPTZ;

-- 3. Create game_config table (admin default options, cooldown, RSS for future Nitter)
CREATE TABLE IF NOT EXISTS public.game_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  default_options TEXT[] DEFAULT '{}',
  posts_to_display INTEGER NOT NULL DEFAULT 6,
  cooldown_minutes INTEGER NOT NULL DEFAULT 30,
  rss_feed_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.game_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Game config is viewable by everyone"
  ON public.game_config FOR SELECT USING (true);

CREATE POLICY "Service role can manage game_config"
  ON public.game_config FOR ALL USING (
    (SELECT current_setting('role', true)) = 'service_role'
  );

-- Realtime (optional, for admin UI)
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_config;

-- 4. Insert default game_config row if table is empty
INSERT INTO public.game_config (id, default_options, posts_to_display, cooldown_minutes, rss_feed_url)
SELECT gen_random_uuid(), ARRAY['Grok', 'Tesla', 'SpaceX', 'Starlink', 'X', '𝕏', 'Doge'], 6, 30, ''
WHERE NOT EXISTS (SELECT 1 FROM public.game_config LIMIT 1);
