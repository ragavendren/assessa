-- Tech-themed career ladder + badge skill tracks + extra achievements

ALTER TABLE public.badges
  ADD COLUMN IF NOT EXISTS track text NOT NULL DEFAULT 'intermediate';

COMMENT ON COLUMN public.badges.track IS
  'Skill track: beginner | intermediate | expertise | elite';

-- Career / technology level names
UPDATE public.levels SET name = v.name, min_xp = v.min_xp
FROM (VALUES
  (1,  'Intern',                  0),
  (2,  'Junior Engineer',       150),
  (3,  'Software Engineer',     400),
  (4,  'Mid-Level Engineer',    750),
  (5,  'Senior Engineer',      1200),
  (6,  'Staff Engineer',       1700),
  (7,  'Principal Engineer',   2200),
  (8,  'Solutions Architect',  2400),
  (9,  'Distinguished Engineer',3000),
  (10, 'Engineering Fellow',   4000)
) AS v(level, name, min_xp)
WHERE public.levels.level = v.level;

-- Retheme existing badges (keep codes stable for award engine)
UPDATE public.badges SET
  name = 'Green Build',
  description = 'Ship your first passing assessment — CI is happy.',
  icon = '🟢',
  category = 'release',
  track = 'beginner'
WHERE code = 'first_success';

UPDATE public.badges SET
  name = 'Production Ready',
  description = 'Score 90%+ — ready for a production deploy.',
  icon = '🚀',
  category = 'quality',
  track = 'expertise'
WHERE code = 'accuracy_master';

UPDATE public.badges SET
  name = 'Zero Defects',
  description = 'Score a perfect 100% on an assessment.',
  icon = '✨',
  category = 'quality',
  track = 'elite'
WHERE code = 'perfect_score';

UPDATE public.badges SET
  name = 'Continuous Delivery',
  description = 'Pass 5 assessments in a row without a failed build.',
  icon = '🔁',
  category = 'pipeline',
  track = 'expertise'
WHERE code = 'consistency';

UPDATE public.badges SET
  name = 'Latency Hunter',
  description = 'Finish under half the timer with 80%+ accuracy.',
  icon = '⚡',
  category = 'performance',
  track = 'intermediate'
WHERE code = 'fast_solver';

UPDATE public.badges SET
  name = 'Refactor Boost',
  description = 'Improve a retake score by 20 points or more.',
  icon = '📈',
  category = 'growth',
  track = 'intermediate'
WHERE code = 'rising_star';

UPDATE public.badges SET
  name = 'Domain Owner',
  description = 'Hold a 90%+ average across 3 assessments in one topic.',
  icon = '🧠',
  category = 'mastery',
  track = 'expertise'
WHERE code = 'subject_expert';

UPDATE public.badges SET
  name = 'Leaderboard Commit',
  description = 'Land in the top 3 of an assessment leaderboard.',
  icon = '🥇',
  category = 'competition',
  track = 'elite'
WHERE code = 'top_performer';

UPDATE public.badges SET
  name = 'Release Veteran',
  description = 'Complete 10 assessments end-to-end.',
  icon = '📦',
  category = 'release',
  track = 'expertise'
WHERE code = 'veteran';

UPDATE public.badges SET
  name = 'SRE Gold',
  description = 'Keep a 90%+ average across 10 assessments.',
  icon = '🛡️',
  category = 'reliability',
  track = 'elite'
WHERE code = 'high_achiever';

UPDATE public.badges SET
  name = 'Sprint Closer',
  description = 'Complete 5 assessments — ship the sprint.',
  icon = '🏁',
  category = 'release',
  track = 'intermediate'
WHERE code = 'half_century';

UPDATE public.badges SET
  name = 'Hotfix Hero',
  description = 'Pass an assessment after a previous failure.',
  icon = '🛠️',
  category = 'growth',
  track = 'intermediate'
WHERE code = 'comeback';

-- New technology-themed badges
INSERT INTO public.badges
  (code, name, description, icon, category, track, condition_type, condition_value, xp_reward)
VALUES
  ('hello_world', 'Hello World', 'Start your first assessment — boot the runtime.', '👋', 'onboarding', 'beginner', 'attempt_count', 1, 25),
  ('unit_test_pass', 'Unit Test Pass', 'Pass 2 assessments — tests are green.', '✅', 'quality', 'beginner', 'pass_count', 2, 40),
  ('merge_ready', 'Merge Ready', 'Pass 3 assessments — approved for merge.', '🔀', 'release', 'beginner', 'pass_count', 3, 60),
  ('pull_request_pro', 'Pull Request Pro', 'Complete 3 assessments with clean submissions.', '📝', 'release', 'beginner', 'attempt_count', 3, 50),
  ('build_pipeline', 'Build Pipeline', 'Pass 3 assessments in a row.', '🏗️', 'pipeline', 'intermediate', 'pass_streak', 3, 80),
  ('nine_nines', 'Nine Nines', 'Score 95%+ — near-perfect reliability.', '💎', 'quality', 'expertise', 'single_score', 95, 120),
  ('load_balancer', 'Load Balancer', 'Complete 15 assessments across the platform.', '⚖️', 'release', 'expertise', 'attempt_count', 15, 180),
  ('platform_guardian', 'Platform Guardian', 'Pass 10 assessments — keep the platform healthy.', '🔒', 'reliability', 'elite', 'pass_count', 10, 200)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  category = EXCLUDED.category,
  track = EXCLUDED.track,
  condition_type = EXCLUDED.condition_type,
  condition_value = EXCLUDED.condition_value,
  xp_reward = EXCLUDED.xp_reward,
  active = true;
