-- Optional SQL seed used by `supabase db reset` (local).
-- Remote/admin seeding is handled by `npm run db:seed`.

-- Baseline levels (safe to re-run)
INSERT INTO public.levels (level, name, min_xp) VALUES
  (1, 'Novice', 0),
  (2, 'Learner', 100),
  (3, 'Practitioner', 250),
  (4, 'Achiever', 500),
  (5, 'Expert', 900),
  (6, 'Mentor', 1400),
  (7, 'Leader', 2000),
  (8, 'Master', 2800)
ON CONFLICT (level) DO UPDATE
SET name = EXCLUDED.name,
    min_xp = EXCLUDED.min_xp;
