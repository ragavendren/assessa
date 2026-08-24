-- Battle lobby: per-player ready flags + active status for synced start.

ALTER TABLE public.play_matches
  ADD COLUMN IF NOT EXISTS inviter_ready boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invitee_ready boolean NOT NULL DEFAULT false;

ALTER TABLE public.play_matches
  DROP CONSTRAINT IF EXISTS play_matches_status_check;

ALTER TABLE public.play_matches
  ADD CONSTRAINT play_matches_status_check
  CHECK (status IN ('pending', 'ready', 'active', 'complete', 'declined'));

COMMENT ON COLUMN public.play_matches.inviter_ready IS 'Inviter pressed Ready; play unlocks when both are ready.';
COMMENT ON COLUMN public.play_matches.invitee_ready IS 'Invitee pressed Ready; play unlocks when both are ready.';
