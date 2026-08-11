import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const ADMIN_NAV = [
  { to: "/admin", label: "Overview" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/performance", label: "Performance" },
  { to: "/admin/exams/new", label: "New assessment" },
  { to: "/admin/gamification", label: "Gamification" },
] as const;

export function AdminNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <nav className="mb-8 flex flex-wrap gap-2">
      {ADMIN_NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-sm transition-colors",
            pathname === item.to ||
              (item.to !== "/admin" && pathname.startsWith(item.to))
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
