import { supabase } from "@/integrations/supabase/client";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Fast gate: local session only. Server fns still validate JWT via middleware.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user) {
      const next = `${location.pathname}${location.searchStr || ""}`;
      throw redirect({ to: "/auth", search: { redirect: next } });
    }
    return { user: sessionData.session.user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
