-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'participant');
CREATE TYPE public.exam_mode AS ENUM ('practice', 'assessment', 'competitive', 'certification');
CREATE TYPE public.exam_access AS ENUM ('public', 'private', 'organization', 'group');
CREATE TYPE public.name_display AS ENUM ('full_name', 'first_initial', 'display_name', 'anonymous');
CREATE TYPE public.attempt_status AS ENUM ('in_progress', 'submitted');

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  mobile text,
  participant_id text,
  organization text,
  department text,
  display_name text,
  leaderboard_opt_out boolean NOT NULL DEFAULT false,
  team_group text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "own or admin profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- LEVELS
CREATE TABLE public.levels (
  level int PRIMARY KEY,
  name text NOT NULL,
  min_xp int NOT NULL
);
GRANT SELECT ON public.levels TO authenticated;
GRANT ALL ON public.levels TO service_role;
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "levels readable" ON public.levels FOR SELECT TO authenticated USING (true);

-- BADGES
CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '🏅',
  category text NOT NULL DEFAULT 'general',
  condition_type text NOT NULL,
  condition_value numeric NOT NULL DEFAULT 0,
  condition_topic text,
  xp_reward int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.badges TO authenticated;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "active badges readable" ON public.badges FOR SELECT TO authenticated
  USING (active OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_id)
);
GRANT SELECT ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own badges" ON public.user_badges FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- XP LEDGER
CREATE TABLE public.xp_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL,
  reference_id uuid,
  points int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.xp_transactions TO authenticated;
GRANT ALL ON public.xp_transactions TO service_role;
ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own xp" ON public.xp_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- STREAKS
CREATE TABLE public.user_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  streak_type text NOT NULL,
  current_count int NOT NULL DEFAULT 0,
  longest_count int NOT NULL DEFAULT 0,
  last_activity_at timestamptz,
  UNIQUE (user_id, streak_type)
);
GRANT SELECT ON public.user_streaks TO authenticated;
GRANT ALL ON public.user_streaks TO service_role;
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own streaks" ON public.user_streaks FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- TOPIC MASTERY
CREATE TABLE public.topic_mastery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  topic text NOT NULL,
  subtopic text NOT NULL DEFAULT 'general',
  correct_count int NOT NULL DEFAULT 0,
  total_count int NOT NULL DEFAULT 0,
  mastery numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, topic, subtopic)
);
GRANT SELECT ON public.topic_mastery TO authenticated;
GRANT ALL ON public.topic_mastery TO service_role;
ALTER TABLE public.topic_mastery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own mastery" ON public.topic_mastery FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '🔔',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- EXAMS
CREATE TABLE public.exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  topic text NOT NULL DEFAULT 'General',
  mode public.exam_mode NOT NULL DEFAULT 'assessment',
  question_count int NOT NULL DEFAULT 10,
  duration_minutes int NOT NULL DEFAULT 30,
  pass_mark int NOT NULL DEFAULT 60,
  max_attempts int NOT NULL DEFAULT 1,
  access public.exam_access NOT NULL DEFAULT 'public',
  organization text,
  team_group text,
  starts_at timestamptz,
  enable_xp boolean NOT NULL DEFAULT true,
  enable_badges boolean NOT NULL DEFAULT true,
  enable_leaderboard boolean NOT NULL DEFAULT true,
  show_rank boolean NOT NULL DEFAULT true,
  show_others boolean NOT NULL DEFAULT false,
  leaderboard_name_display public.name_display NOT NULL DEFAULT 'first_initial',
  extra_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.exams TO authenticated;
GRANT ALL ON public.exams TO service_role;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.exam_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_id, email)
);
GRANT SELECT ON public.exam_invitations TO authenticated;
GRANT ALL ON public.exam_invitations TO service_role;
ALTER TABLE public.exam_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own invitations" ON public.exam_invitations FOR SELECT TO authenticated
  USING (lower(email) = lower(coalesce((SELECT email FROM public.profiles WHERE id = auth.uid()), ''))
         OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.can_access_exam(_user_id uuid, _exam_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.exams e
    LEFT JOIN public.profiles p ON p.id = _user_id
    WHERE e.id = _exam_id AND e.active AND (
      e.access = 'public'
      OR (e.access = 'organization' AND p.organization IS NOT NULL
          AND lower(p.organization) = lower(coalesce(e.organization, '')))
      OR (e.access = 'group' AND p.team_group IS NOT NULL
          AND lower(p.team_group) = lower(coalesce(e.team_group, '')))
      OR (e.access = 'private' AND EXISTS (
            SELECT 1 FROM public.exam_invitations i
            WHERE i.exam_id = e.id AND lower(i.email) = lower(coalesce(p.email, ''))))
    )
  )
$$;

CREATE POLICY "accessible exams readable" ON public.exams FOR SELECT TO authenticated
  USING (public.can_access_exam(auth.uid(), id) OR public.has_role(auth.uid(), 'admin'));

-- QUESTIONS (answer key: admin only)
CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_index int NOT NULL DEFAULT 0,
  explanation text NOT NULL DEFAULT '',
  subtopic text NOT NULL DEFAULT 'general',
  points int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "questions admin only" ON public.questions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ATTEMPTS
CREATE TABLE public.exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status public.attempt_status NOT NULL DEFAULT 'in_progress',
  question_ids uuid[] NOT NULL DEFAULT '{}',
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  extra_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  score numeric,
  passed boolean,
  correct_count int,
  duration_seconds int,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz
);
GRANT SELECT ON public.exam_attempts TO authenticated;
GRANT ALL ON public.exam_attempts TO service_role;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own attempts" ON public.exam_attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- SEED: LEVELS
INSERT INTO public.levels (level, name, min_xp) VALUES
  (1,'Beginner',0),(2,'Explorer',150),(3,'Learner',400),(4,'Skilled',750),(5,'Advanced',1200),
  (6,'Expert',1700),(7,'Specialist',2200),(8,'Master',2400),(9,'Champion',3000),(10,'Grand Master',4000);

-- SEED: BADGES
INSERT INTO public.badges (code, name, description, icon, category, condition_type, condition_value, xp_reward) VALUES
  ('first_success','First Success','Pass your first exam.','🏆','milestone','pass_count',1,50),
  ('accuracy_master','Accuracy Master','Achieve 90%+ in an exam.','🎯','performance','single_score',90,100),
  ('perfect_score','Perfect Score','Score 100% in an exam.','💯','performance','single_score',100,150),
  ('consistency','Consistency','Pass 5 exams consecutively.','🔥','streak','pass_streak',5,120),
  ('fast_solver','Fast Solver','Finish in under half the time with 80%+.','⚡','speed','fast_high_score',80,100),
  ('rising_star','Rising Star','Improve your score by 20% or more.','📈','improvement','improvement',20,75),
  ('subject_expert','Subject Expert','90%+ average across 3 exams in one topic.','🧠','mastery','topic_average',90,200),
  ('top_performer','Top Performer','Finish in the top 3 of an exam leaderboard.','🥇','competition','top_rank',3,150),
  ('veteran','Assessment Veteran','Complete 10 exams.','📚','milestone','attempt_count',10,150),
  ('high_achiever','High Achiever','Keep a 90%+ average across 10 exams.','🚀','performance','average_over',90,250),
  ('half_century','Half Century','Complete 5 exams.','🎖️','milestone','attempt_count',5,75),
  ('comeback','Never Give Up','Pass an exam after a previous fail.','💪','improvement','comeback',1,60);

-- SEED: EXAMS
INSERT INTO public.exams (id, title, description, topic, mode, question_count, duration_minutes, pass_mark, max_attempts, access, starts_at, extra_fields) VALUES
  ('11111111-1111-1111-1111-111111111111','JavaScript Fundamentals','Core language concepts: types, scope, functions and arrays.','JavaScript','assessment',5,15,60,3,'public',now() - interval '2 days','[]'::jsonb),
  ('22222222-2222-2222-2222-222222222222','Advanced JavaScript & Async','Closures, promises, event loop and async patterns.','JavaScript','competitive',5,20,70,1,'public',now() + interval '4 days','[{"key":"employee_id","label":"Employee ID","required":true}]'::jsonb),
  ('33333333-3333-3333-3333-333333333333','React Fundamentals','Components, state, props and hooks.','React','assessment',5,20,60,2,'public',now() - interval '1 day','[]'::jsonb),
  ('44444444-4444-4444-4444-444444444444','TypeScript Practice Lab','Practice types, generics and narrowing with instant feedback.','TypeScript','practice',5,20,60,99,'public',now() - interval '5 days','[]'::jsonb);

INSERT INTO public.questions (exam_id, prompt, options, correct_index, explanation, subtopic) VALUES
  ('11111111-1111-1111-1111-111111111111','Which value is NOT a JavaScript primitive?','["string","symbol","object","bigint"]',2,'Objects are reference types, not primitives.','Fundamentals'),
  ('11111111-1111-1111-1111-111111111111','What does typeof null return?','["\"null\"","\"object\"","\"undefined\"","\"boolean\""]',1,'A long-standing quirk: typeof null is "object".','Fundamentals'),
  ('11111111-1111-1111-1111-111111111111','Which method adds an item to the end of an array?','["shift()","unshift()","push()","splice()"]',2,'push() appends to the end.','Arrays'),
  ('11111111-1111-1111-1111-111111111111','Which declaration is block scoped?','["var","let","function","this"]',1,'let and const are block scoped.','Functions'),
  ('11111111-1111-1111-1111-111111111111','What is the result of [1,2,3].map(n => n * 2).join("-")?','["2-4-6","1-2-3","246","2,4,6"]',0,'map doubles each item, join uses the separator.','Arrays'),
  ('22222222-2222-2222-2222-222222222222','What does an async function always return?','["A value","A Promise","undefined","A generator"]',1,'async functions always wrap their result in a Promise.','Async Programming'),
  ('22222222-2222-2222-2222-222222222222','Which runs first: setTimeout(fn,0) or Promise.resolve().then(fn)?','["setTimeout","Promise then","Both together","Undefined order"]',1,'Microtasks run before macrotasks.','Async Programming'),
  ('22222222-2222-2222-2222-222222222222','A closure lets a function access...','["Only globals","Its outer scope variables","Only its arguments","The DOM"]',1,'Closures capture their lexical scope.','Functions'),
  ('22222222-2222-2222-2222-222222222222','Promise.all rejects when...','["All reject","Any rejects","Never","The first resolves"]',1,'Promise.all rejects on the first rejection.','Async Programming'),
  ('22222222-2222-2222-2222-222222222222','Which correctly awaits parallel work?','["await a(); await b();","await Promise.all([a(), b()])","Promise.all(await a(), b())","await [a, b]"]',1,'Promise.all runs them concurrently.','Async Programming'),
  ('33333333-3333-3333-3333-333333333333','Which hook stores local component state?','["useEffect","useState","useMemo","useRef"]',1,'useState holds local state.','Hooks'),
  ('33333333-3333-3333-3333-333333333333','What does the dependency array of useEffect control?','["Render order","When the effect re-runs","Component name","Prop types"]',1,'The effect re-runs when a dependency changes.','Hooks'),
  ('33333333-3333-3333-3333-333333333333','Props in React are...','["Mutable","Read-only","Global","Async"]',1,'Props are read-only to the receiving component.','Components'),
  ('33333333-3333-3333-3333-333333333333','Which key choice is best for a list?','["Array index","Random value","Stable unique id","Item label"]',2,'Stable unique ids keep reconciliation correct.','Components'),
  ('33333333-3333-3333-3333-333333333333','What does useMemo help with?','["Fetching data","Caching expensive computations","Routing","Styling"]',1,'useMemo caches a computed value.','Hooks'),
  ('44444444-4444-4444-4444-444444444444','Which type accepts only "a" or "b"?','["string","\"a\" | \"b\"","any","unknown"]',1,'A union of literal types.','Types'),
  ('44444444-4444-4444-4444-444444444444','unknown differs from any because...','["It is faster","It requires narrowing before use","It allows anything","It is deprecated"]',1,'unknown is the type-safe counterpart of any.','Types'),
  ('44444444-4444-4444-4444-444444444444','What does Partial<T> do?','["Removes keys","Makes all properties optional","Makes all readonly","Picks one key"]',1,'Partial maps every property to optional.','Generics'),
  ('44444444-4444-4444-4444-444444444444','Which narrows a union in a switch?','["typeof only","A discriminant property","as const","satisfies"]',1,'A discriminated union narrows on its tag.','Narrowing'),
  ('44444444-4444-4444-4444-444444444444','interface vs type: which supports declaration merging?','["type","interface","both","neither"]',1,'Interfaces can be re-opened and merged.','Types');
