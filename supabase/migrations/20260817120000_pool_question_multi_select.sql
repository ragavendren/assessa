-- Persist single vs multi-select on bank items (AWS-style papers use both).
ALTER TABLE public.pool_questions
  ADD COLUMN IF NOT EXISTS multi_select boolean NOT NULL DEFAULT false;

UPDATE public.pool_questions
SET multi_select = true
WHERE cardinality(correct_indexes) > 1
  AND multi_select = false;

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS multi_select boolean NOT NULL DEFAULT false;

UPDATE public.questions
SET multi_select = true
WHERE cardinality(correct_indexes) > 1
  AND multi_select = false;
