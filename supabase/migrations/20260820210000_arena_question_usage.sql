-- Track pool question provenance for Live Arena so hosts can avoid repeats / use blueprints.

ALTER TABLE public.play_arena_questions
  ADD COLUMN IF NOT EXISTS source_question_id uuid REFERENCES public.pool_questions (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS play_arena_questions_source_qid_idx
  ON public.play_arena_questions (source_question_id)
  WHERE source_question_id IS NOT NULL;

ALTER TABLE public.play_arenas
  ADD COLUMN IF NOT EXISTS blueprint_id uuid REFERENCES public.course_blueprints (id) ON DELETE SET NULL;

ALTER TABLE public.play_arenas
  ADD COLUMN IF NOT EXISTS avoid_repeats boolean NOT NULL DEFAULT true;
