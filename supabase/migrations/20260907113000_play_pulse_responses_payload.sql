-- Fix play_pulse_responses column names to match app (payload / submitted_at).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'play_pulse_responses' AND column_name = 'response'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'play_pulse_responses' AND column_name = 'payload'
  ) THEN
    ALTER TABLE public.play_pulse_responses RENAME COLUMN response TO payload;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'play_pulse_responses' AND column_name = 'created_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'play_pulse_responses' AND column_name = 'submitted_at'
  ) THEN
    ALTER TABLE public.play_pulse_responses RENAME COLUMN created_at TO submitted_at;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
