-- Availability window, multi-select answers, deactivate seed assessments

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS ends_at timestamptz;

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS correct_indexes int[] NOT NULL DEFAULT '{}';

UPDATE public.questions
SET correct_indexes = ARRAY[correct_index]
WHERE coalesce(cardinality(correct_indexes), 0) = 0;

-- Remove seeded demo assessments so admins start from a clean slate
DELETE FROM public.exams
WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444'
);

-- Public share links: allow reading active public exams without a session
GRANT SELECT ON public.exams TO anon;
CREATE POLICY "anon read active public exams"
  ON public.exams
  FOR SELECT
  TO anon
  USING (active = true AND access = 'public');
