-- Hot-path indexes for concurrent login / dashboard / submit (~20 users+).
CREATE INDEX IF NOT EXISTS exam_attempts_user_status_submitted_idx
  ON public.exam_attempts (user_id, status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS exam_attempts_exam_status_idx
  ON public.exam_attempts (exam_id, status);

CREATE INDEX IF NOT EXISTS exam_attempts_user_exam_status_idx
  ON public.exam_attempts (user_id, exam_id, status);

CREATE INDEX IF NOT EXISTS xp_transactions_user_id_idx
  ON public.xp_transactions (user_id);

CREATE INDEX IF NOT EXISTS questions_exam_id_idx
  ON public.questions (exam_id);

CREATE INDEX IF NOT EXISTS user_badges_user_id_idx
  ON public.user_badges (user_id);

CREATE INDEX IF NOT EXISTS topic_mastery_user_id_idx
  ON public.topic_mastery (user_id);

CREATE INDEX IF NOT EXISTS notifications_user_read_idx
  ON public.notifications (user_id, read);
