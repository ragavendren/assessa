CREATE TABLE public.xp_rules (
  code text PRIMARY KEY,
  label text NOT NULL,
  points int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.xp_rules TO authenticated;
GRANT ALL ON public.xp_rules TO service_role;
ALTER TABLE public.xp_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xp rules readable" ON public.xp_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage xp rules" ON public.xp_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT INSERT, UPDATE, DELETE ON public.xp_rules TO authenticated;

INSERT INTO public.xp_rules (code, label, points) VALUES
  ('exam_started','Exam started',5),
  ('exam_completed','Exam completed',25),
  ('exam_passed','Passed exam',50),
  ('score_80','Score above 80%',25),
  ('score_90','Score above 90%',50),
  ('score_95','Score above 95%',75),
  ('perfect_score','Perfect score',100);

-- ADMIN WRITE ACCESS
GRANT INSERT, UPDATE, DELETE ON public.exams TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.badges TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.exam_invitations TO authenticated;

CREATE POLICY "admins manage exams" ON public.exams FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage questions" ON public.questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage badges" ON public.badges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage invitations" ON public.exam_invitations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));