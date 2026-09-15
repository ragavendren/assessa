-- Self-paced Pulse surveys: participants advance without host slide control.
ALTER TABLE public.play_pulses DROP CONSTRAINT IF EXISTS play_pulses_reveal_mode_check;
ALTER TABLE public.play_pulses
  ADD CONSTRAINT play_pulses_reveal_mode_check
  CHECK (reveal_mode IN ('live', 'all_in', 'host', 'self'));

NOTIFY pgrst, 'reload schema';
