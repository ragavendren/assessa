import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  match?: (pathname: string) => boolean;
};

type NavGroup = {
  label?: string;
  items: NavItem[];
};

const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { to: "/admin", label: "Overview", match: (p) => p === "/admin" },
      { to: "/admin/users", label: "Users" },
      { to: "/admin/organizations", label: "Organisations" },
      { to: "/admin/performance", label: "Performance" },
    ],
  },
  {
    label: "Question bank",
    items: [
      {
        to: "/admin/courses",
        label: "Question bank",
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
        to: "/admin/exams/new",
        label: "New assessment",
        match: (p) => p.startsWith("/admin/exams"),
      },
      { to: "/admin/gamification", label: "Gamification" },
    ],
  },
];

export function AdminNav() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <nav className="mb-8 flex flex-wrap items-center gap-x-2 gap-y-3" aria-label="Admin">
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
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
