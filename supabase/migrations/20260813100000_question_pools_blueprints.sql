-- Question pools, course blueprints, assessment series (additive; non-breaking)

CREATE TYPE public.question_selection_method AS ENUM ('upload', 'question_pool');
CREATE TYPE public.question_reuse_policy AS ENUM (
  'allow_reuse',
  'no_reuse_course',
  'no_reuse_series',
  'until_pool_exhausted',
  'no_reuse_last_n'
);
CREATE TYPE public.question_difficulty AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE public.catalog_status AS ENUM ('active', 'inactive');

CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status public.catalog_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT courses_name_unique UNIQUE (name)
);

CREATE TABLE public.question_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  name text NOT NULL,
  status public.catalog_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT question_pools_course_name_unique UNIQUE (course_id, name)
);

CREATE TABLE public.pool_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.question_pools (id) ON DELETE CASCADE,
  prompt text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_index int NOT NULL DEFAULT 0,
  correct_indexes int[] NOT NULL DEFAULT '{}',
  explanation text NOT NULL DEFAULT '',
  topic text NOT NULL DEFAULT 'general',
  subtopic text NOT NULL DEFAULT 'general',
  difficulty public.question_difficulty NOT NULL DEFAULT 'medium',
  skill text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  marks int NOT NULL DEFAULT 1,
  status public.catalog_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.course_blueprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  name text NOT NULL,
  version int NOT NULL DEFAULT 1,
  status public.catalog_status NOT NULL DEFAULT 'active',
  default_total_questions int NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_blueprints_course_name_version_unique UNIQUE (course_id, name, version),
  CONSTRAINT course_blueprints_version_positive CHECK (version >= 1),
  CONSTRAINT course_blueprints_total_positive CHECK (default_total_questions >= 1)
);

CREATE TABLE public.blueprint_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES public.course_blueprints (id) ON DELETE CASCADE,
  topic text NOT NULL,
  subtopic text,
  weightage numeric(6, 3) NOT NULL,
  min_questions int NOT NULL DEFAULT 0,
  max_questions int,
  easy_percentage numeric(6, 3) NOT NULL DEFAULT 20,
  medium_percentage numeric(6, 3) NOT NULL DEFAULT 60,
  hard_percentage numeric(6, 3) NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blueprint_rules_weightage_range CHECK (weightage >= 0 AND weightage <= 100),
  CONSTRAINT blueprint_rules_difficulty_sum CHECK (
    easy_percentage + medium_percentage + hard_percentage = 100
  )
);

CREATE TABLE public.assessment_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  blueprint_id uuid NOT NULL REFERENCES public.course_blueprints (id) ON DELETE RESTRICT,
  question_pool_id uuid NOT NULL REFERENCES public.question_pools (id) ON DELETE RESTRICT,
  name text NOT NULL,
  reuse_policy public.question_reuse_policy NOT NULL DEFAULT 'until_pool_exhausted',
  reuse_last_n int NOT NULL DEFAULT 5,
  status public.catalog_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assessment_series_course_name_unique UNIQUE (course_id, name),
  CONSTRAINT assessment_series_last_n_positive CHECK (reuse_last_n >= 1)
);

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS question_selection_method public.question_selection_method
    NOT NULL DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS question_pool_id uuid REFERENCES public.question_pools (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS blueprint_id uuid REFERENCES public.course_blueprints (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS series_id uuid REFERENCES public.assessment_series (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reuse_policy public.question_reuse_policy,
  ADD COLUMN IF NOT EXISTS reuse_last_n int,
  ADD COLUMN IF NOT EXISTS generation_locked_at timestamptz;

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS source_pool_question_id uuid
    REFERENCES public.pool_questions (id) ON DELETE SET NULL;

CREATE TABLE public.exam_generation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams (id) ON DELETE CASCADE,
  method public.question_selection_method NOT NULL DEFAULT 'question_pool',
  pool_id uuid REFERENCES public.question_pools (id) ON DELETE SET NULL,
  blueprint_id uuid REFERENCES public.course_blueprints (id) ON DELETE SET NULL,
  blueprint_version int,
  series_id uuid REFERENCES public.assessment_series (id) ON DELETE SET NULL,
  reuse_policy public.question_reuse_policy,
  question_count int NOT NULL,
  selected_pool_question_ids uuid[] NOT NULL DEFAULT '{}',
  distribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pool_questions_pool_id_idx ON public.pool_questions (pool_id);
CREATE INDEX IF NOT EXISTS pool_questions_topic_diff_idx
  ON public.pool_questions (pool_id, topic, difficulty)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS questions_source_pool_question_id_idx
  ON public.questions (source_pool_question_id)
  WHERE source_pool_question_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS exams_course_id_idx ON public.exams (course_id);
CREATE INDEX IF NOT EXISTS exams_series_id_idx ON public.exams (series_id);
CREATE INDEX IF NOT EXISTS blueprint_rules_blueprint_id_idx ON public.blueprint_rules (blueprint_id);
CREATE INDEX IF NOT EXISTS exam_generation_audit_exam_id_idx ON public.exam_generation_audit (exam_id);

GRANT SELECT ON public.courses TO authenticated;
GRANT SELECT ON public.question_pools TO authenticated;
GRANT SELECT ON public.pool_questions TO authenticated;
GRANT SELECT ON public.course_blueprints TO authenticated;
GRANT SELECT ON public.blueprint_rules TO authenticated;
GRANT SELECT ON public.assessment_series TO authenticated;
GRANT SELECT ON public.exam_generation_audit TO authenticated;

GRANT ALL ON public.courses TO service_role;
GRANT ALL ON public.question_pools TO service_role;
GRANT ALL ON public.pool_questions TO service_role;
GRANT ALL ON public.course_blueprints TO service_role;
GRANT ALL ON public.blueprint_rules TO service_role;
GRANT ALL ON public.assessment_series TO service_role;
GRANT ALL ON public.exam_generation_audit TO service_role;

GRANT INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.question_pools TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.pool_questions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.course_blueprints TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.blueprint_rules TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.assessment_series TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.exam_generation_audit TO authenticated;

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blueprint_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_generation_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage courses" ON public.courses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage question_pools" ON public.question_pools FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage pool_questions" ON public.pool_questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage course_blueprints" ON public.course_blueprints FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage blueprint_rules" ON public.blueprint_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage assessment_series" ON public.assessment_series FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage exam_generation_audit" ON public.exam_generation_audit FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
