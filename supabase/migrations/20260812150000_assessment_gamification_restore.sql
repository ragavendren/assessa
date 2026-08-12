-- Revert assessment gamification to assessment language + add more badges / XP rules

-- Learning ladder (assessment progression — not job titles)
UPDATE public.levels SET name = v.name, min_xp = v.min_xp
FROM (VALUES
  (1,  'Beginner',       0),
  (2,  'Explorer',     150),
  (3,  'Learner',      400),
  (4,  'Skilled',      750),
  (5,  'Advanced',    1200),
  (6,  'Expert',      1700),
  (7,  'Specialist',  2200),
  (8,  'Master',      2400),
  (9,  'Champion',    3000),
  (10, 'Grand Master',4000)
) AS v(level, name, min_xp)
WHERE public.levels.level = v.level;

-- Restore classic assessment badge names (keep codes stable)
UPDATE public.badges SET
  name = 'First Success',
  description = 'Pass your first assessment.',
  icon = '🏆',
  category = 'milestone',
  track = 'beginner'
WHERE code = 'first_success';

UPDATE public.badges SET
  name = 'Accuracy Master',
  description = 'Score 90% or higher on an assessment.',
  icon = '🎯',
  category = 'performance',
  track = 'expertise'
WHERE code = 'accuracy_master';

UPDATE public.badges SET
  name = 'Perfect Score',
  description = 'Score 100% on an assessment.',
  icon = '💯',
  category = 'performance',
  track = 'elite'
WHERE code = 'perfect_score';

UPDATE public.badges SET
  name = 'Consistency',
  description = 'Pass 5 assessments in a row.',
  icon = '🔥',
  category = 'streak',
  track = 'expertise'
WHERE code = 'consistency';

UPDATE public.badges SET
  name = 'Fast Solver',
  description = 'Finish in under half the time with 80% or higher.',
  icon = '⚡',
  category = 'speed',
  track = 'intermediate'
WHERE code = 'fast_solver';

UPDATE public.badges SET
  name = 'Rising Star',
  description = 'Improve your score by 20 points or more on a retake.',
  icon = '📈',
  category = 'improvement',
  track = 'intermediate'
WHERE code = 'rising_star';

UPDATE public.badges SET
  name = 'Subject Expert',
  description = 'Hold a 90%+ average across 3 assessments in one topic.',
  icon = '🧠',
  category = 'mastery',
  track = 'expertise'
WHERE code = 'subject_expert';

UPDATE public.badges SET
  name = 'Top Performer',
  description = 'Finish in the top 3 of an assessment leaderboard.',
  icon = '🥇',
  category = 'competition',
  track = 'elite'
WHERE code = 'top_performer';

UPDATE public.badges SET
  name = 'Assessment Veteran',
  description = 'Complete 10 assessments.',
  icon = '📚',
  category = 'milestone',
  track = 'expertise'
WHERE code = 'veteran';

UPDATE public.badges SET
  name = 'High Achiever',
  description = 'Keep a 90%+ average across 10 assessments.',
  icon = '🚀',
  category = 'performance',
  track = 'elite'
WHERE code = 'high_achiever';

UPDATE public.badges SET
  name = 'Half Century',
  description = 'Complete 5 assessments.',
  icon = '🎖️',
  category = 'milestone',
  track = 'intermediate'
WHERE code = 'half_century';

UPDATE public.badges SET
  name = 'Never Give Up',
  description = 'Pass an assessment after a previous fail.',
  icon = '💪',
  category = 'improvement',
  track = 'intermediate'
WHERE code = 'comeback';

-- Retitle previously tech-named badges to assessment language
UPDATE public.badges SET
  name = 'First Attempt',
  description = 'Start your first assessment.',
  icon = '🎬',
  category = 'milestone',
  track = 'beginner'
WHERE code = 'hello_world';

UPDATE public.badges SET
  name = 'Getting Started',
  description = 'Pass 2 assessments.',
  icon = '✅',
  category = 'milestone',
  track = 'beginner'
WHERE code = 'unit_test_pass';

UPDATE public.badges SET
  name = 'On a Roll',
  description = 'Pass 3 assessments.',
  icon = '🎲',
  category = 'milestone',
  track = 'beginner'
WHERE code = 'merge_ready';

UPDATE public.badges SET
  name = 'Practice Makes Progress',
  description = 'Complete 3 assessments.',
  icon = '📝',
  category = 'milestone',
  track = 'beginner'
WHERE code = 'pull_request_pro';

UPDATE public.badges SET
  name = 'Hot Streak',
  description = 'Pass 3 assessments in a row.',
  icon = '🔥',
  category = 'streak',
  track = 'intermediate'
WHERE code = 'build_pipeline';

UPDATE public.badges SET
  name = 'Near Perfect',
  description = 'Score 95% or higher on an assessment.',
  icon = '💎',
  category = 'performance',
  track = 'expertise'
WHERE code = 'nine_nines';

UPDATE public.badges SET
  name = 'Dedicated Learner',
  description = 'Complete 15 assessments.',
  icon = '📖',
  category = 'milestone',
  track = 'expertise'
WHERE code = 'load_balancer';

UPDATE public.badges SET
  name = 'Ten Passes',
  description = 'Pass 10 assessments.',
  icon = '🛡️',
  category = 'milestone',
  track = 'elite'
WHERE code = 'platform_guardian';

-- Additional assessment gamification badges
INSERT INTO public.badges
  (code, name, description, icon, category, track, condition_type, condition_value, xp_reward)
VALUES
  ('bronze_score', 'Bronze Score', 'Score 70% or higher on an assessment.', '🥉', 'performance', 'beginner', 'single_score', 70, 30),
  ('silver_score', 'Silver Score', 'Score 85% or higher on an assessment.', '🥈', 'performance', 'intermediate', 'single_score', 85, 60),
  ('quiz_duo', 'Quiz Duo', 'Complete 2 assessments.', '2️⃣', 'milestone', 'beginner', 'attempt_count', 2, 30),
  ('steady_four', 'Steady Four', 'Pass 4 assessments in a row.', '4️⃣', 'streak', 'intermediate', 'pass_streak', 4, 100),
  ('marathon_20', 'Assessment Marathon', 'Complete 20 assessments.', '🏃', 'milestone', 'elite', 'attempt_count', 20, 220),
  ('pass_club_5', 'Pass Club', 'Pass 5 assessments.', '5️⃣', 'milestone', 'intermediate', 'pass_count', 5, 75),
  ('pass_club_15', 'Pass Champion', 'Pass 15 assessments.', '🏅', 'milestone', 'elite', 'pass_count', 15, 250),
  ('sharp_average', 'Sharp Average', 'Hold a 80%+ average across 10 assessments.', '📐', 'performance', 'expertise', 'average_over', 80, 150),
  ('podium_finish', 'Podium Finish', 'Reach the top 5 on a leaderboard.', '🏁', 'competition', 'expertise', 'top_rank', 5, 100),
  ('big_comeback', 'Big Comeback', 'Improve a retake by 30 points or more.', '🔄', 'improvement', 'expertise', 'improvement', 30, 110),
  ('speed_demon', 'Speed Demon', 'Finish under half the timer with 90% or higher.', '💨', 'speed', 'elite', 'fast_high_score', 90, 140),
  ('century_attempts', 'Century Club', 'Complete 25 assessments.', '💯', 'milestone', 'elite', 'attempt_count', 25, 300)
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

-- Extra XP rewards for assessment events
INSERT INTO public.xp_rules (code, label, points, active) VALUES
  ('exam_failed_retry', 'Retried after a fail', 15, true),
  ('score_70', 'Score above 70%', 15, true),
  ('score_85', 'Score above 85%', 35, true),
  ('leaderboard_top10', 'Top 10 on leaderboard', 40, true),
  ('streak_bonus_3', '3-pass streak bonus', 30, true)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  points = EXCLUDED.points,
  active = true;
