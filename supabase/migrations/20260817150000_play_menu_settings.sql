-- Master Play menu switch. Per-mode on/off stays on challenges.status.

CREATE TABLE public.play_settings (
  id text PRIMARY KEY DEFAULT 'default',
  menu_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.play_settings (id, menu_enabled)
VALUES ('default', true)
ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.play_settings TO authenticated;
GRANT ALL ON public.play_settings TO service_role;

ALTER TABLE public.play_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "play settings readable" ON public.play_settings
  FOR SELECT TO authenticated USING (true);
