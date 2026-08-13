import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { BookOpen, GitBranch, Layers3, Shapes } from "lucide-react";

const TABS = [
  {
    to: "/admin/courses",
    label: "Courses",
    hint: "Start here",
    icon: BookOpen,
  },
  {
    to: "/admin/pools",
    label: "Pools",
    hint: "Question bank",
    icon: Layers3,
  },
  {
    to: "/admin/blueprints",
    label: "Blueprints",
    hint: "Weightage",
    icon: Shapes,
  },
  {
    to: "/admin/series",
    label: "Series",
    hint: "Reuse rules",
    icon: GitBranch,
  },
] as const;

export function QuestionBankNav() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <nav className="mb-6" aria-label="Question bank sections">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
                "group flex items-start gap-3 rounded-md border px-3 py-2.5 transition-colors",
                active
                  ? "border-primary/35 bg-primary/5 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-border hover:bg-secondary/50 hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
                  active
                    ? "border-primary/30 bg-background text-foreground"
                    : "border-border bg-secondary/40",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{tab.label}</span>
                <span className="block text-[11px] text-muted-foreground">{tab.hint}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
