-- Allow small floating-point drift on difficulty % sums (JS numeric → postgres numeric)
ALTER TABLE public.blueprint_rules
  DROP CONSTRAINT IF EXISTS blueprint_rules_difficulty_sum;

ALTER TABLE public.blueprint_rules
  ADD CONSTRAINT blueprint_rules_difficulty_sum CHECK (
    abs(easy_percentage + medium_percentage + hard_percentage - 100) <= 0.05
  );
