import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { BookOpen, LayoutDashboard, Sparkles, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  icon?: LucideIcon;
  match?: (pathname: string) => boolean;
};

type NavGroup = {
  label?: string;
  items: NavItem[];
};

const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    items: [
      {
        to: "/admin",
        label: "Overview",
        icon: LayoutDashboard,
        match: (p) =>
          p === "/admin" ||
          p === "/admin/" ||
          p.startsWith("/admin/exams") ||
          p.startsWith("/admin/performance"),
      },
      {
        to: "/admin/users",
        label: "User management",
        icon: Users,
        match: (p) => p.startsWith("/admin/users") || p.startsWith("/admin/organizations"),
      },
    ],
  },
  {
    label: "Question bank",
    items: [
      {
        to: "/admin/courses",
        label: "Question bank",
        icon: BookOpen,
        match: (p) =>
          p.startsWith("/admin/courses") ||
          p.startsWith("/admin/pools") ||
          p.startsWith("/admin/blueprints") ||
          p.startsWith("/admin/series"),
      },
    ],
  },
  {
    items: [
      {
        to: "/admin/gamification",
        label: "Engagement",
        icon: Sparkles,
        match: (p) => p.startsWith("/admin/gamification") || p.startsWith("/admin/play"),
      },
    ],
  },
];

export function AdminNav() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <nav className="mb-4 flex max-w-full flex-wrap items-center gap-x-2 gap-y-2" aria-label="Admin">
      {ADMIN_NAV_GROUPS.map((group, groupIndex) => (
        <div
          key={group.label ?? `group-${groupIndex}`}
          className="flex flex-wrap items-center gap-2"
        >
          {groupIndex > 0 ? (
            <span className="mx-1 hidden h-4 w-px bg-border sm:block" aria-hidden />
          ) : null}
          {group.label ? <span className="sr-only">{group.label}</span> : null}
          {group.items.map((item) => {
            const active = item.match
              ? item.match(pathname)
              : pathname === item.to || pathname.startsWith(`${item.to}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
