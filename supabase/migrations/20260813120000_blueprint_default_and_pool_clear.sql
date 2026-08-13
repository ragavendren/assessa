-- Default blueprint per course + support clearing pool inventory via admin APIs.

ALTER TABLE public.course_blueprints
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- At most one default blueprint per course.
CREATE UNIQUE INDEX IF NOT EXISTS course_blueprints_one_default_per_course
  ON public.course_blueprints (course_id)
  WHERE is_default = true;

COMMENT ON COLUMN public.course_blueprints.is_default IS
  'When true, this blueprint is pre-selected for new assessments in the course.';
