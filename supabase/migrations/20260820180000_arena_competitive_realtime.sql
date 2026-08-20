-- Competitive Live Arena: atomic lock RPC, persisted bonuses, realtime publication.

ALTER TABLE public.play_arena_answers
  ADD COLUMN IF NOT EXISTS time_bonus int NOT NULL DEFAULT 0;

ALTER TABLE public.play_arena_answers
  ADD COLUMN IF NOT EXISTS early_lock_bonus int NOT NULL DEFAULT 0;

ALTER TABLE public.play_arena_answers
  ADD COLUMN IF NOT EXISTS lock_latency_ms int;

ALTER TABLE public.play_arena_answers
  DROP CONSTRAINT IF EXISTS play_arena_answers_time_bonus_check;
ALTER TABLE public.play_arena_answers
  ADD CONSTRAINT play_arena_answers_time_bonus_check
  CHECK (time_bonus >= 0 AND time_bonus <= 50);

ALTER TABLE public.play_arena_answers
  DROP CONSTRAINT IF EXISTS play_arena_answers_early_lock_bonus_check;
ALTER TABLE public.play_arena_answers
  ADD CONSTRAINT play_arena_answers_early_lock_bonus_check
  CHECK (early_lock_bonus >= 0 AND early_lock_bonus <= 50);

CREATE INDEX IF NOT EXISTS play_arena_answers_arena_q_lock_idx
  ON public.play_arena_answers (arena_id, question_index, first_locked_at);

-- Atomic team lock: preserves first_locked_at, always updates the answer payload.
CREATE OR REPLACE FUNCTION public.play_arena_lock_answer(
  p_arena_id uuid,
  p_team_id uuid,
  p_question_index int,
  p_answer_indexes int[],
  p_client_locked_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_arena public.play_arenas%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_row public.play_arena_answers%ROWTYPE;
  v_existed boolean := false;
  v_latency int := NULL;
BEGIN
  SELECT * INTO v_arena FROM public.play_arenas WHERE id = p_arena_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Arena not found.';
  END IF;
  IF v_arena.status <> 'question' THEN
    RAISE EXCEPTION 'Answering is closed for this question.';
  END IF;
  IF v_arena.question_ends_at IS NOT NULL AND v_arena.question_ends_at <= v_now THEN
    UPDATE public.play_arenas
    SET status = 'locked', updated_at = v_now
    WHERE id = p_arena_id AND status = 'question';
    RAISE EXCEPTION 'Answering is closed for this question.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.play_arena_teams
    WHERE id = p_team_id AND arena_id = p_arena_id
  ) THEN
    RAISE EXCEPTION 'Team not found.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.play_arena_answers
    WHERE arena_id = p_arena_id
      AND team_id = p_team_id
      AND question_index = p_question_index
  ) INTO v_existed;

  IF v_arena.question_started_at IS NOT NULL THEN
    v_latency := GREATEST(
      0,
      FLOOR(EXTRACT(EPOCH FROM (v_now - v_arena.question_started_at)) * 1000)
    )::int;
  END IF;

  INSERT INTO public.play_arena_answers (
    arena_id,
    team_id,
    question_index,
    answer_indexes,
    submitted_at,
    first_locked_at,
    correct,
    marks,
    time_bonus,
    early_lock_bonus,
    lock_latency_ms
  )
  VALUES (
    p_arena_id,
    p_team_id,
    p_question_index,
    COALESCE(p_answer_indexes, '{}'),
    v_now,
    v_now,
    NULL,
    0,
    0,
    0,
    v_latency
  )
  ON CONFLICT (arena_id, team_id, question_index) DO UPDATE
  SET
    answer_indexes = EXCLUDED.answer_indexes,
    submitted_at = EXCLUDED.submitted_at,
    correct = NULL,
    marks = 0,
    time_bonus = 0,
    early_lock_bonus = 0
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'modified', v_existed,
    'firstLockedAt', v_row.first_locked_at,
    'submittedAt', v_row.submitted_at,
    'lockLatencyMs', v_row.lock_latency_ms
  );
END;
$$;

REVOKE ALL ON FUNCTION public.play_arena_lock_answer(uuid, uuid, int, int[], timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.play_arena_lock_answer(uuid, uuid, int, int[], timestamptz) TO service_role;

-- Realtime: host console + undocked board invalidate from postgres changes.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.play_arenas;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.play_arena_answers;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.play_arena_teams;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;
