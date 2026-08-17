-- Play engine: pool-sourced challenges, sessions, rewards, PvP, tournaments, escape rooms.

CREATE TABLE public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN (
    'topic','daily','weekly','speed','survival','marathon','flash','rapid',
    'battle','team','knockout','escape'
  )),
  name text NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  pool_id uuid REFERENCES public.question_pools(id) ON DELETE SET NULL,
  topic text,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.catalog_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX challenges_kind_topic_count ON public.challenges (
  kind,
  coalesce(pool_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(topic, ''),
  coalesce(rules->>'questionCount', '')
);

CREATE TABLE public.challenge_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  period_key text NOT NULL,
  question_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, period_key)
);

CREATE TABLE public.play_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  instance_id uuid REFERENCES public.challenge_instances(id) ON DELETE SET NULL,
  inviter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  invitee_email text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','complete','declined')),
  winner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.play_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  instance_id uuid REFERENCES public.challenge_instances(id) ON DELETE SET NULL,
  match_id uuid REFERENCES public.play_matches(id) ON DELETE SET NULL,
  kind text NOT NULL,
  topic text,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted','game_over')),
  question_ids uuid[] NOT NULL DEFAULT '{}',
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_index int NOT NULL DEFAULT 0,
  lives_left int,
  ends_at timestamptz,
  question_ends_at timestamptz,
  score int,
  correct_count int,
  duration_seconds int,
  time_bonus int,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz
);
CREATE INDEX play_sessions_user_kind ON public.play_sessions (user_id, kind, started_at DESC);
CREATE INDEX play_sessions_instance ON public.play_sessions (instance_id, status);

CREATE TABLE public.play_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.play_sessions(id) ON DELETE SET NULL,
  source text NOT NULL CHECK (source IN ('box','wheel')),
  code text NOT NULL,
  label text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.play_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code text NOT NULL,
  remaining int NOT NULL DEFAULT 1,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX play_entitlements_user ON public.play_entitlements (user_id, code);

CREATE TABLE public.flash_progress (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.pool_questions(id) ON DELETE CASCADE,
  known boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, question_id)
);

CREATE TABLE public.escape_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  intro text NOT NULL DEFAULT '',
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  pool_id uuid REFERENCES public.question_pools(id) ON DELETE SET NULL,
  status public.catalog_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.escape_scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL REFERENCES public.escape_scenarios(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  topic text NOT NULL DEFAULT 'general',
  question_count int NOT NULL DEFAULT 4
);

CREATE TABLE public.play_tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  size int NOT NULL DEFAULT 8 CHECK (size IN (4, 8, 16, 32)),
  pool_id uuid REFERENCES public.question_pools(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','active','complete')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.play_tournament_entrants (
  tournament_id uuid NOT NULL REFERENCES public.play_tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seed int,
  PRIMARY KEY (tournament_id, user_id)
);

CREATE TABLE public.play_tournament_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.play_tournaments(id) ON DELETE CASCADE,
  round int NOT NULL,
  slot int NOT NULL,
  player_a uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  player_b uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  match_id uuid REFERENCES public.play_matches(id) ON DELETE SET NULL,
  winner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (tournament_id, round, slot)
);

GRANT SELECT ON public.challenges, public.challenge_instances, public.escape_scenarios,
  public.escape_scenes, public.play_tournaments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.play_sessions, public.play_matches,
  public.play_rewards, public.play_entitlements, public.flash_progress,
  public.play_tournament_entrants TO authenticated;
GRANT SELECT ON public.play_tournament_matches TO authenticated;
GRANT ALL ON public.challenges, public.challenge_instances, public.play_sessions,
  public.play_matches, public.play_rewards, public.play_entitlements, public.flash_progress,
  public.escape_scenarios, public.escape_scenes, public.play_tournaments,
  public.play_tournament_entrants, public.play_tournament_matches TO service_role;

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flash_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escape_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escape_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_tournament_entrants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_tournament_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "challenges readable" ON public.challenges FOR SELECT TO authenticated USING (true);
CREATE POLICY "instances readable" ON public.challenge_instances FOR SELECT TO authenticated USING (true);
CREATE POLICY "own play sessions" ON public.play_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own play matches" ON public.play_matches FOR SELECT TO authenticated
  USING (inviter_id = auth.uid() OR invitee_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own play rewards" ON public.play_rewards FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own entitlements" ON public.play_entitlements FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own flash" ON public.flash_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "escape readable" ON public.escape_scenarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "escape scenes readable" ON public.escape_scenes FOR SELECT TO authenticated USING (true);
CREATE POLICY "tournaments readable" ON public.play_tournaments FOR SELECT TO authenticated USING (true);
CREATE POLICY "entrants readable" ON public.play_tournament_entrants FOR SELECT TO authenticated USING (true);
CREATE POLICY "tmatches readable" ON public.play_tournament_matches FOR SELECT TO authenticated USING (true);

INSERT INTO public.challenges (kind, name, rules) VALUES
  ('daily', 'Daily Challenge', '{"questionCount":10,"durationSeconds":600}'::jsonb),
  ('weekly', 'Weekly Challenge', '{"questionCount":25,"durationSeconds":1500}'::jsonb),
  ('speed', 'Speed Challenge', '{"questionCount":20,"durationSeconds":300,"timeBonus":true}'::jsonb),
  ('survival', 'Survival', '{"lives":3,"questionCount":50}'::jsonb),
  ('marathon', 'Marathon', '{"questionCount":100}'::jsonb),
  ('rapid', 'Rapid Fire', '{"questionCount":20,"perQuestionSeconds":30}'::jsonb),
  ('battle', 'Battle', '{"questionCount":15,"durationSeconds":600,"timeBonus":true}'::jsonb),
  ('team', 'Team Challenge', '{"questionCount":25,"durationSeconds":1500}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO public.xp_rules (code, label, points, active) VALUES
  ('daily_challenge', 'Daily challenge', 100, true),
  ('weekly_challenge', 'Weekly challenge', 50, true),
  ('topic_challenge', 'Topic challenge', 25, true),
  ('speed_challenge', 'Speed challenge', 40, true),
  ('survival_challenge', 'Survival finish', 30, true),
  ('marathon_challenge', 'Marathon finish', 80, true),
  ('rapid_fire', 'Rapid fire', 20, true),
  ('battle_challenge', 'Battle', 40, true),
  ('escape_room', 'Escape room', 60, true),
  ('weekly_top10', 'Weekly top 10', 40, true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.badges (code, name, description, icon, category, track, condition_type, condition_value, xp_reward, active)
VALUES
  ('daily_streak_7', 'Week on fire', 'Complete the daily challenge 7 days in a row.', 'flame', 'streak', 'intermediate', 'daily_streak', 7, 80, true),
  ('daily_streak_15', 'Fifteen-day streak', 'Complete the daily challenge 15 days in a row.', 'flame', 'streak', 'expertise', 'daily_streak', 15, 150, true),
  ('weekly_top10', 'Week 10', 'Finish in the top 10 of a weekly challenge.', 'medal', 'competition', 'expertise', 'weekly_top10', 10, 100, true),
  ('speed_demon_play', 'Speed run', 'Finish a speed challenge.', 'zap', 'competition', 'intermediate', 'play_kind', 1, 60, true),
  ('survivor', 'Last life standing', 'Finish survival with lives remaining.', 'shield', 'competition', 'expertise', 'play_kind', 1, 80, true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.escape_scenarios (name, intro, status)
VALUES (
  'Production Down',
  'The checkout API is failing in production. Walk the incident: find the issue, fix IAM, repair Lambda, then deploy.',
  'active'
);

INSERT INTO public.escape_scenes (scenario_id, sort_order, title, body, topic, question_count)
SELECT id, 1, 'Find the issue', 'Logs show 403s from the API. Where do you look first?', 'Monitoring', 4
FROM public.escape_scenarios WHERE name = 'Production Down';
INSERT INTO public.escape_scenes (scenario_id, sort_order, title, body, topic, question_count)
SELECT id, 2, 'Solve IAM', 'The role cannot assume the needed policy. Restore least privilege.', 'IAM', 4
FROM public.escape_scenarios WHERE name = 'Production Down';
INSERT INTO public.escape_scenes (scenario_id, sort_order, title, body, topic, question_count)
SELECT id, 3, 'Fix Lambda', 'The function times out after the IAM fix. Tune memory, timeout, and retries.', 'Lambda', 4
FROM public.escape_scenarios WHERE name = 'Production Down';
INSERT INTO public.escape_scenes (scenario_id, sort_order, title, body, topic, question_count)
SELECT id, 4, 'Deploy', 'Ship the fix without taking the region down.', 'CI/CD', 4
FROM public.escape_scenarios WHERE name = 'Production Down';
