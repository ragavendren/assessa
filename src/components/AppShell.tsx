import { BrandMark } from "@/components/BrandMark";
import { ProfileCompletionGate } from "@/components/ProfileCompletionGate";
import { UserAvatar } from "@/components/UserAvatar";
import { useMe } from "@/hooks/use-me";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, LogOut, Menu } from "lucide-react";
import { useState, type ReactNode } from "react";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/exams", label: "My Exams" },
  { to: "/achievements", label: "Achievements" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/profile", label: "Profile" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { data } = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
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
          <Link to="/dashboard" className="inline-flex items-center">
            <BrandMark wordmarkClassName="hidden sm:inline" />
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
              className="transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-105"
              aria-label="Profile"
            >
              <UserAvatar
                avatarId={data?.profile.avatar_id}
                name={data?.profile.full_name}
                className="h-8 w-8"
                emojiClassName="text-sm"
              />
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
      <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-8">
        <ProfileCompletionGate>{children}</ProfileCompletionGate>
      </main>
    </div>
  );
}
