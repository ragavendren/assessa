-- Participant list visibility for Live Arena and Knockout (independent of game status).

ALTER TABLE public.play_arenas
  ADD COLUMN IF NOT EXISTS listed boolean NOT NULL DEFAULT true;

ALTER TABLE public.play_tournaments
  ADD COLUMN IF NOT EXISTS listed boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.play_arenas.listed IS
  'When true, the arena appears on the participant Live Arena list.';

COMMENT ON COLUMN public.play_tournaments.listed IS
  'When true, the tournament appears on the participant Knockout list.';
