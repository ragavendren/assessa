import { BrandMark } from "@/components/BrandMark";
import { AssessaIcon, type AssessaIconName } from "@/components/icons";
import { HelpButton, HelpMenuLink, HelpProvider } from "@/components/help/HelpCenter";
import { ProfileCompletionGate } from "@/components/ProfileCompletionGate";
import { UserAvatar } from "@/components/UserAvatar";
import { XpHud } from "@/components/XpHud";
import { useMe } from "@/hooks/use-me";
import { usePresenceHeartbeat } from "@/hooks/use-presence-heartbeat";
import { getPlayFlags } from "@/lib/play.functions";
import { listNotifications } from "@/lib/platform.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type ReactNode } from "react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", tour: "nav-dashboard", icon: "dashboard" },
  { to: "/play", label: "Play", tour: "nav-play", icon: "play" },
  { to: "/exams", label: "Assessments", tour: "nav-assessments", icon: "assessments" },
  { to: "/achievements", label: "Achievements", tour: "nav-achievements", icon: "achievements" },
  { to: "/leaderboard", label: "Leaderboard", tour: "nav-leaderboard", icon: "leaderboard" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { data } = useMe();
  usePresenceHeartbeat(Boolean(data?.profile?.id));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchPlayFlags = useServerFn(getPlayFlags);
  const fetchNotifications = useServerFn(listNotifications);
  const { data: playFlags } = useQuery({
    queryKey: ["play-flags"],
    queryFn: () => fetchPlayFlags(),
    staleTime: 60_000,
  });
  const { data: notices } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(),
    staleTime: 30_000,
  });
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const soloDisplay = /\/admin\/play\/scoreboard\/[^/]+\/?$/.test(pathname);
  const [open, setOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const playOn = playFlags?.menuEnabled !== false;
  const isAdmin = Boolean(data?.isAdmin);
  const nav = [
    ...NAV.filter((item) => item.to !== "/play" || playOn),
    ...(isAdmin
      ? [{ to: "/admin", label: "Admin", tour: "nav-admin", icon: "admin" } as const]
      : []),
  ];
  const unreadCount = (notices ?? []).filter((item) => !item.read).length;

  function navActive(to: string) {
    if (to === "/leaderboard") {
      return pathname === "/leaderboard" || pathname.startsWith("/play/leaderboard");
    }
    if (to === "/play") {
      return pathname.startsWith("/play") && !pathname.startsWith("/play/leaderboard");
    }
    if (to === "/admin") {
      return pathname.startsWith("/admin");
    }
    return pathname === to || pathname.startsWith(`${to}/`);
  }

  useEffect(() => {
    if (!avatarOpen) return;
    function onPointer(event: MouseEvent) {
      if (!avatarMenuRef.current?.contains(event.target as Node)) setAvatarOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setAvatarOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [avatarOpen]);

  return (
    <HelpProvider isAdmin={isAdmin} playOn={playOn} profileReady={data != null && !data.needsOrg}>
      {soloDisplay ? (
        <div className="min-h-screen bg-background">{children}</div>
      ) : (
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
                    data-tour={item.tour}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                      navActive(item.to)
                        ? "bg-secondary font-medium text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <AssessaIcon name={item.icon as AssessaIconName} className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                ))}
              </nav>

              <div className="ml-auto flex items-center gap-2">
                <div data-tour="hud-xp">
                  <XpHud />
                </div>
                <HelpButton />
                <Link
                  to="/notifications"
                  data-tour="nav-notifications"
                  className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label={
                    unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
                  }
                >
                  <AssessaIcon name="bell" className="h-4 w-4" />
                  {unreadCount > 0 ? (
                    <span className="absolute right-1 top-1 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] font-semibold leading-4 text-destructive-foreground">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  ) : null}
                </Link>
                {isAdmin ? (
                  <div ref={avatarMenuRef} className="relative">
                    <button
                      type="button"
                      aria-label="Account menu"
                      aria-expanded={avatarOpen}
                      aria-haspopup="menu"
                      onClick={() => setAvatarOpen((value) => !value)}
                      className="rounded-full transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-105"
                    >
                      <UserAvatar
                        avatarId={data?.profile.avatar_id}
                        name={data?.profile.full_name}
                        className="h-8 w-8"
                        emojiClassName="text-sm"
                      />
                    </button>
                    {avatarOpen ? (
                      <div
                        role="menu"
                        className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg"
                      >
                        <Link
                          to="/profile"
                          role="menuitem"
                          onClick={() => setAvatarOpen(false)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary",
                            pathname.startsWith("/profile")
                              ? "font-medium text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          <AssessaIcon name="profile" className="h-4 w-4" />
                          Profile
                        </Link>
                        <Link
                          to="/admin"
                          role="menuitem"
                          onClick={() => setAvatarOpen(false)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary",
                            pathname.startsWith("/admin")
                              ? "font-medium text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          <AssessaIcon name="admin" className="h-4 w-4" />
                          Admin
                        </Link>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <Link
                    to="/profile"
                    className="rounded-full transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-105"
                    aria-label="Profile"
                  >
                    <UserAvatar
                      avatarId={data?.profile.avatar_id}
                      name={data?.profile.full_name}
                      className="h-8 w-8"
                      emojiClassName="text-sm"
                    />
                  </Link>
                )}
                <button
                  onClick={signOut}
                  className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label="Sign out"
                >
                  <AssessaIcon name="logout" className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setOpen((value) => !value)}
                  className="rounded-md p-2 text-muted-foreground md:hidden"
                  aria-label="Menu"
                >
                  <AssessaIcon name="menu" className="h-4 w-4" />
                </button>
              </div>
            </div>
            {open ? (
              <nav className="grid gap-1 border-t border-border px-4 py-3 md:hidden">
                {nav.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    data-tour={item.tour}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-secondary hover:text-foreground",
                      navActive(item.to)
                        ? "bg-secondary font-medium text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    <AssessaIcon name={item.icon as AssessaIconName} className="h-4 w-4" />
                    {item.label}
                  </Link>
                ))}
                <HelpMenuLink onClick={() => setOpen(false)} />
              </nav>
            ) : null}
          </header>
          <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-8">
            <ProfileCompletionGate>{children}</ProfileCompletionGate>
          </main>
        </div>
      )}
    </HelpProvider>
  );
}
