import { AppShell } from "@/components/AppShell";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { resolveClientSession } = await import("@/lib/auth-session");
    // Wait briefly so post-login navigation does not bounce back to /auth.
    const session = await resolveClientSession({ waitMs: 2000 });
    if (!session?.user) {
      const next = `${location.pathname}${location.searchStr || ""}`;
      throw redirect({ to: "/auth", search: { redirect: next } });
    }
    return { user: session.user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
