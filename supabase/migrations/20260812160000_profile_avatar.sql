-- Participant avatar selection (fixed catalog ids, not uploaded files).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_id text;

COMMENT ON COLUMN public.profiles.avatar_id IS
  'Catalog avatar id from the app avatar list (e.g. nova, atlas). Null = initials fallback.';
