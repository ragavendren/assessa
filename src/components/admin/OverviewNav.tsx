import { cn } from "@/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, ClipboardList, LayoutDashboard } from "lucide-react";

const TABS = [
  {
    to: "/admin",
    label: "Overview",
    icon: LayoutDashboard,
    match: (pathname: string) => pathname === "/admin" || pathname === "/admin/",
  },
  {
    to: "/admin/performance",
    label: "Performance",
    icon: BarChart3,
    match: (pathname: string) => pathname.startsWith("/admin/performance"),
  },
  {
    to: "/admin/exams/new",
    label: "New assessment",
    icon: ClipboardList,
    match: (pathname: string) => pathname.startsWith("/admin/exams"),
  },
] as const;

/** Cohort dashboard, per-paper analytics, and assessment authoring. */
export function OverviewNav() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <nav className="mb-4 flex flex-wrap gap-1.5" aria-label="Overview sections">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
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
