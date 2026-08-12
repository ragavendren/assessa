-- Admin-managed organisation + department catalog (profiles still store names as text).

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizations_name_unique UNIQUE (name)
);

CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT departments_org_name_unique UNIQUE (organization_id, name)
);

CREATE INDEX departments_organization_id_idx ON public.departments (organization_id);

GRANT SELECT ON public.organizations TO authenticated, anon;
GRANT SELECT ON public.departments TO authenticated, anon;
GRANT ALL ON public.organizations TO service_role;
GRANT ALL ON public.departments TO service_role;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organizations readable" ON public.organizations
  FOR SELECT TO authenticated, anon USING (active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "departments readable" ON public.departments
  FOR SELECT TO authenticated, anon USING (active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "organizations admin write" ON public.organizations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "departments admin write" ON public.departments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed from existing free-text profile values
INSERT INTO public.organizations (name)
SELECT DISTINCT trim(organization)
FROM public.profiles
WHERE organization IS NOT NULL AND length(trim(organization)) > 0
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.departments (organization_id, name)
SELECT o.id, trim(p.department)
FROM public.profiles p
JOIN public.organizations o ON lower(o.name) = lower(trim(p.organization))
WHERE p.department IS NOT NULL
  AND length(trim(p.department)) > 0
  AND p.organization IS NOT NULL
  AND length(trim(p.organization)) > 0
ON CONFLICT (organization_id, name) DO NOTHING;
