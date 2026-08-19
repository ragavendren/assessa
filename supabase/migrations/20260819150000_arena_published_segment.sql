-- Host publishes one segment's standings at a time; -1 means none yet.
ALTER TABLE public.play_arenas
  ADD COLUMN IF NOT EXISTS published_through_segment int NOT NULL DEFAULT -1;

ALTER TABLE public.play_arenas
  DROP CONSTRAINT IF EXISTS play_arenas_published_through_segment_check;

ALTER TABLE public.play_arenas
  ADD CONSTRAINT play_arenas_published_through_segment_check
  CHECK (published_through_segment >= -1 AND published_through_segment <= 12);
