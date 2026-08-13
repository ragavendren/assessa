import { cn } from "@/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, GitBranch, Layers3, Shapes } from "lucide-react";

const TABS = [
  { to: "/admin/courses", label: "Courses", icon: BookOpen },
  { to: "/admin/pools", label: "Pools", icon: Layers3 },
  { to: "/admin/blueprints", label: "Blueprints", icon: Shapes },
  { to: "/admin/series", label: "Series", icon: GitBranch },
] as const;

/** Compact question-bank section tabs (replaces the old card grid + workflow strip). */
export function QuestionBankNav() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <nav className="mb-4 flex flex-wrap gap-1.5" aria-label="Question bank sections">
      {TABS.map((tab) => {
        const active =
          pathname === tab.to ||
          pathname === `${tab.to}/` ||
          (tab.to !== "/admin/courses" && pathname.startsWith(tab.to));
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
