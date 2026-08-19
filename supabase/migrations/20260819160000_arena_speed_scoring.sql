-- Live Arena: optional speed scoring and first-lock timestamp for time/early-lock bonuses.
ALTER TABLE public.play_arenas
  ADD COLUMN IF NOT EXISTS time_bonus_max int NOT NULL DEFAULT 0;

ALTER TABLE public.play_arenas
  ADD COLUMN IF NOT EXISTS early_lock_bonus int NOT NULL DEFAULT 0;

ALTER TABLE public.play_arenas
  DROP CONSTRAINT IF EXISTS play_arenas_time_bonus_max_check;
ALTER TABLE public.play_arenas
  ADD CONSTRAINT play_arenas_time_bonus_max_check
  CHECK (time_bonus_max >= 0 AND time_bonus_max <= 50);

ALTER TABLE public.play_arenas
  DROP CONSTRAINT IF EXISTS play_arenas_early_lock_bonus_check;
ALTER TABLE public.play_arenas
  ADD CONSTRAINT play_arenas_early_lock_bonus_check
  CHECK (early_lock_bonus >= 0 AND early_lock_bonus <= 50);

ALTER TABLE public.play_arena_answers
  ADD COLUMN IF NOT EXISTS first_locked_at timestamptz;

UPDATE public.play_arena_answers
SET first_locked_at = submitted_at
WHERE first_locked_at IS NULL;
