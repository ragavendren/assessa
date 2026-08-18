import { cn } from "@/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";
import { Gamepad2, Sparkles } from "lucide-react";

const TABS = [
  { to: "/admin/gamification", label: "Gamification", icon: Sparkles },
  { to: "/admin/play", label: "Play modes", icon: Gamepad2 },
] as const;

/** XP, badges, and Play mode controls. */
export function EngagementNav() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <nav className="mb-4 flex flex-wrap gap-1.5" aria-label="Engagement sections">
      {TABS.map((tab) => {
        const active = pathname === tab.to || pathname.startsWith(`${tab.to}/`);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
              active
                ? "border-primary/35 bg-primary/10 text-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
