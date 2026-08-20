-- Presence + optional Live Arena team precreation controls.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_last_seen_at_idx
  ON public.profiles (last_seen_at DESC NULLS LAST);

ALTER TABLE public.play_arenas
  ADD COLUMN IF NOT EXISTS allow_open_teams boolean NOT NULL DEFAULT true;
