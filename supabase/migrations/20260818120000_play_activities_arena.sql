-- Play activities (hub segment alongside courses) and Live Arena team events.

CREATE TABLE public.play_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status public.catalog_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT play_activities_name_unique UNIQUE (name)
);

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS activity_id uuid REFERENCES public.play_activities (id) ON DELETE SET NULL;

ALTER TABLE public.challenges DROP CONSTRAINT IF EXISTS challenges_kind_check;
ALTER TABLE public.challenges
  ADD CONSTRAINT challenges_kind_check CHECK (kind IN (
    'topic','daily','weekly','speed','survival','marathon','flash','rapid',
    'battle','team','knockout','escape','arena'
  ));

CREATE TABLE public.play_arenas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  activity_id uuid REFERENCES public.play_activities (id) ON DELETE SET NULL,
  course_id uuid REFERENCES public.courses (id) ON DELETE SET NULL,
  pool_id uuid REFERENCES public.question_pools (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'lobby', 'question', 'locked', 'revealed', 'complete')),
  segment_count int NOT NULL DEFAULT 3 CHECK (segment_count >= 1 AND segment_count <= 12),
  questions_per_segment int NOT NULL DEFAULT 4 CHECK (questions_per_segment >= 1 AND questions_per_segment <= 20),
  per_question_seconds int NOT NULL DEFAULT 30 CHECK (per_question_seconds >= 5 AND per_question_seconds <= 600),
  correct_marks int NOT NULL DEFAULT 2 CHECK (correct_marks >= 0 AND correct_marks <= 20),
  wrong_marks int NOT NULL DEFAULT 1 CHECK (wrong_marks >= 0 AND wrong_marks <= 20),
  current_index int NOT NULL DEFAULT 0,
  question_started_at timestamptz,
  question_ends_at timestamptz,
  winner_team_id uuid,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.play_arena_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_id uuid NOT NULL REFERENCES public.play_arenas (id) ON DELETE CASCADE,
  sort_order int NOT NULL,
  segment_index int NOT NULL,
  prompt text NOT NULL,
  image_url text,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_indexes int[] NOT NULL DEFAULT '{}',
  multi_select boolean NOT NULL DEFAULT false,
  explanation text NOT NULL DEFAULT '',
  UNIQUE (arena_id, sort_order)
);

CREATE TABLE public.play_arena_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_id uuid NOT NULL REFERENCES public.play_arenas (id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  score int NOT NULL DEFAULT 0,
  correct_count int NOT NULL DEFAULT 0,
  wrong_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (arena_id, name)
);

ALTER TABLE public.play_arenas
  ADD CONSTRAINT play_arenas_winner_team_fkey
  FOREIGN KEY (winner_team_id) REFERENCES public.play_arena_teams (id) ON DELETE SET NULL;

CREATE TABLE public.play_arena_members (
  arena_id uuid NOT NULL REFERENCES public.play_arenas (id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.play_arena_teams (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (arena_id, user_id)
);

CREATE TABLE public.play_arena_answers (
  arena_id uuid NOT NULL REFERENCES public.play_arenas (id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.play_arena_teams (id) ON DELETE CASCADE,
  question_index int NOT NULL,
  answer_indexes int[] NOT NULL DEFAULT '{}',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  correct boolean,
  marks int NOT NULL DEFAULT 0,
  PRIMARY KEY (arena_id, team_id, question_index)
);

CREATE INDEX play_arenas_activity_status_idx ON public.play_arenas (activity_id, status);
CREATE INDEX play_arena_members_team_idx ON public.play_arena_members (team_id);
CREATE INDEX challenges_activity_id_idx ON public.challenges (activity_id)
  WHERE activity_id IS NOT NULL;

GRANT SELECT ON public.play_activities, public.play_arenas, public.play_arena_questions,
  public.play_arena_teams, public.play_arena_members, public.play_arena_answers TO authenticated;
GRANT ALL ON public.play_activities, public.play_arenas, public.play_arena_questions,
  public.play_arena_teams, public.play_arena_members, public.play_arena_answers TO service_role;

ALTER TABLE public.play_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_arenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_arena_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_arena_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_arena_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_arena_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "play activities readable" ON public.play_activities
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "play arenas readable" ON public.play_arenas
  FOR SELECT TO authenticated USING (status <> 'draft' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "play arena questions readable" ON public.play_arena_questions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "play arena teams readable" ON public.play_arena_teams
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "play arena members readable" ON public.play_arena_members
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "play arena answers readable" ON public.play_arena_answers
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR team_id IN (
      SELECT team_id FROM public.play_arena_members WHERE user_id = auth.uid()
    )
  );

INSERT INTO public.xp_rules (code, label, points, active) VALUES
  ('arena_challenge', 'Live Arena', 40, true)
ON CONFLICT (code) DO NOTHING;
