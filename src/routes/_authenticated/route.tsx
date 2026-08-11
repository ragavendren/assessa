import { supabase } from "@/integrations/supabase/client";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Prefer getSession for fast path, then validate the user once a session exists.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      const next = `${location.pathname}${location.searchStr || ""}`;
      throw redirect({ to: "/auth", search: { redirect: next } });
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      await supabase.auth.signOut();
      const next = `${location.pathname}${location.searchStr || ""}`;
      throw redirect({ to: "/auth", search: { redirect: next } });
    }
    return { user: data.user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
