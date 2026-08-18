ALTER TABLE public.pool_questions
  ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS image_url text;
