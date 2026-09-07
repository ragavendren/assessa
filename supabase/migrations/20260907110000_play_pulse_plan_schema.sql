-- Align play_pulses to the plan schema (join_code, name, reveal_mode, activity_id, listed).
-- Earlier environments may still have the old wall table (code/title/is_listed/…).
-- Safe to re-run: drops Pulse tables and recreates the current shape.

DROP TABLE IF EXISTS public.play_pulse_reactions CASCADE;
DROP TABLE IF EXISTS public.play_pulse_responses CASCADE;
DROP TABLE IF EXISTS public.play_pulse_participants CASCADE;
DROP TABLE IF EXISTS public.play_pulse_questions CASCADE;
DROP TABLE IF EXISTS public.play_pulse_slides CASCADE;
DROP TABLE IF EXISTS public.play_pulses CASCADE;

ALTER TABLE public.challenges DROP CONSTRAINT IF EXISTS challenges_kind_check;
ALTER TABLE public.challenges
  ADD CONSTRAINT challenges_kind_check CHECK (kind IN (
    'topic','daily','weekly','speed','survival','marathon','flash','rapid',
    'battle','team','knockout','escape','arena','pulse'
  ));

CREATE TABLE public.play_pulses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  join_code text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'lobby', 'prompt', 'results', 'complete')),
  reveal_mode text NOT NULL DEFAULT 'host'
    CHECK (reveal_mode IN ('live', 'all_in', 'host')),
  current_index int NOT NULL DEFAULT 0,
  listed boolean NOT NULL DEFAULT false,
  activity_id uuid REFERENCES public.play_activities (id) ON DELETE SET NULL,
  course_id uuid REFERENCES public.courses (id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT play_pulses_join_code_unique UNIQUE (join_code),
  CONSTRAINT play_pulses_join_code_format CHECK (join_code ~ '^[A-Z0-9]{6}$')
);

CREATE TABLE public.play_pulse_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pulse_id uuid NOT NULL REFERENCES public.play_pulses (id) ON DELETE CASCADE,
  sort_order int NOT NULL,
  type text NOT NULL CHECK (type IN ('mcq', 'text', 'rating')),
  prompt text NOT NULL,
  image_url text,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  rating_max int NOT NULL DEFAULT 5 CHECK (rating_max >= 2 AND rating_max <= 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pulse_id, sort_order)
);

CREATE TABLE public.play_pulse_participants (
  pulse_id uuid NOT NULL REFERENCES public.play_pulses (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pulse_id, user_id)
);

CREATE TABLE public.play_pulse_responses (
  pulse_id uuid NOT NULL REFERENCES public.play_pulses (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  slide_index int NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pulse_id, user_id, slide_index)
);

CREATE INDEX play_pulses_listed_status_idx ON public.play_pulses (listed, status);
CREATE INDEX play_pulses_join_code_idx ON public.play_pulses (join_code);
CREATE INDEX play_pulse_slides_pulse_idx ON public.play_pulse_slides (pulse_id, sort_order);
CREATE INDEX play_pulse_participants_user_idx ON public.play_pulse_participants (user_id);
CREATE INDEX play_pulse_responses_slide_idx ON public.play_pulse_responses (pulse_id, slide_index);

GRANT SELECT ON public.play_pulses, public.play_pulse_slides,
  public.play_pulse_participants, public.play_pulse_responses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.play_pulses, public.play_pulse_slides,
  public.play_pulse_participants, public.play_pulse_responses TO service_role;

ALTER TABLE public.play_pulses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_pulse_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_pulse_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_pulse_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "play pulses select authenticated" ON public.play_pulses;
CREATE POLICY "play pulses select authenticated" ON public.play_pulses
  FOR SELECT TO authenticated
  USING (
    listed = true
    OR created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "play pulse slides select authenticated" ON public.play_pulse_slides;
CREATE POLICY "play pulse slides select authenticated" ON public.play_pulse_slides
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "play pulse participants select authenticated" ON public.play_pulse_participants;
CREATE POLICY "play pulse participants select authenticated" ON public.play_pulse_participants
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "play pulse responses select authenticated" ON public.play_pulse_responses;
CREATE POLICY "play pulse responses select authenticated" ON public.play_pulse_responses
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.play_pulses p
      WHERE p.id = play_pulse_responses.pulse_id
        AND (p.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.play_pulses;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.play_pulse_slides;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.play_pulse_participants;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.play_pulse_responses;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

NOTIFY pgrst, 'reload schema';
