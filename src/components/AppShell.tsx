import { supabase } from "@/integrations/supabase/client";
import { getMe } from "@/lib/platform.functions";
import { initials } from "@/lib/gamification";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bell, LogOut, Menu } from "lucide-react";
import { useState, type ReactNode } from "react";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/exams", label: "My Exams" },
  { to: "/progress", label: "Progress" },
  { to: "/achievements", label: "Achievements" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/profile", label: "Profile" },
] as const;

export function useMe() {
  const fetchMe = useServerFn(getMe);
  return useQuery({ queryKey: ["me"], queryFn: () => fetchMe(), staleTime: 60_000 });
}

export function AppShell({ children }: { children: ReactNode }) {
  const { data } = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [open, setOpen] = useState(false);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const nav = data?.isAdmin ? [...NAV, { to: "/admin", label: "Admin" } as const] : NAV;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary font-display text-sm text-primary-foreground">
              As
            </span>
            <span className="hidden font-display text-lg sm:block">Assessa</span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  pathname.startsWith(item.to)
                    ? "bg-secondary font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/notifications"
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
            </Link>
            <Link
              to="/profile"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
              aria-label="Profile"
            >
              {initials(data?.profile.full_name ?? "")}
            </Link>
            <button
              onClick={signOut}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
            <button
              onClick={() => setOpen((value) => !value)}
              className="rounded-md p-2 text-muted-foreground md:hidden"
              aria-label="Menu"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </div>
        {open ? (
          <nav className="grid gap-1 border-t border-border px-4 py-3 md:hidden">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
