-- Escape Room: story stages with optional pools, embedded questions, per-stage rewards, progress.

ALTER TABLE public.escape_scenes
  ADD COLUMN IF NOT EXISTS stage_key text,
  ADD COLUMN IF NOT EXISTS question_source text NOT NULL DEFAULT 'pool'
    CHECK (question_source IN ('pool', 'upload', 'manual', 'none')),
  ADD COLUMN IF NOT EXISTS questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS question_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reward_code text,
  ADD COLUMN IF NOT EXISTS reward_label text;

-- Story-only stages may have zero questions.
ALTER TABLE public.escape_scenes
  DROP CONSTRAINT IF EXISTS escape_scenes_question_count_check;

ALTER TABLE public.escape_scenes
  ADD CONSTRAINT escape_scenes_question_count_check
  CHECK (question_count >= 0 AND question_count <= 40);

CREATE TABLE IF NOT EXISTS public.escape_progress (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scenario_id uuid NOT NULL REFERENCES public.escape_scenarios(id) ON DELETE CASCADE,
  completed_indexes int[] NOT NULL DEFAULT '{}',
  restored_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scenario_id)
);

GRANT SELECT, INSERT, UPDATE ON public.escape_progress TO authenticated;
ALTER TABLE public.escape_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "escape progress own" ON public.escape_progress;
CREATE POLICY "escape progress own" ON public.escape_progress
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON COLUMN public.escape_scenes.question_source IS
  'pool = topic from scenario/default pool; upload/manual = questions jsonb; none = story beat only';
COMMENT ON COLUMN public.escape_scenes.reward_code IS
  'Optional fixed stage reward (xp_50, xp_100, badge, avatar, double_xp, extra_life, mock_voucher)';
