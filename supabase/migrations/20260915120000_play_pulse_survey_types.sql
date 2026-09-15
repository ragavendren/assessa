-- Expand Pulse slide types for survey-style sessions:
-- mcq | multi | text | rating | matrix | section
ALTER TABLE public.play_pulse_slides DROP CONSTRAINT IF EXISTS play_pulse_slides_type_check;
ALTER TABLE public.play_pulse_slides
  ADD CONSTRAINT play_pulse_slides_type_check
  CHECK (type IN ('mcq', 'multi', 'text', 'rating', 'matrix', 'section'));

-- Allow longer option lists (multi-select / matrix rows).
-- options jsonb already flexible; no structural change required.

NOTIFY pgrst, 'reload schema';
