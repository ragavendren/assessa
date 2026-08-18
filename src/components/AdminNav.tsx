import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { AssessaIcon, type AssessaIconName } from "@/components/icons";

type NavItem = {
  to: string;
  label: string;
  title: string;
  icon: AssessaIconName;
  match: (pathname: string) => boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    label: "Assessments",
    items: [
      {
        to: "/admin",
        label: "Overview",
        title: "Cohort stats and paper performance",
        icon: "overview",
        match: (p) => p === "/admin" || p === "/admin/" || p.startsWith("/admin/performance"),
      },
      {
        to: "/admin/exams",
        label: "Assessments",
        title: "Create, publish, and schedule papers",
        icon: "assessments",
        match: (p) => p.startsWith("/admin/exams"),
      },
    ],
  },
  {
    label: "Library",
    items: [
      {
        to: "/admin/courses",
        label: "Courses",
        title: "Shared containers for assessment papers and Play",
        icon: "courses",
        match: (p) => p.startsWith("/admin/courses"),
      },
      {
        to: "/admin/pools",
        label: "Pools",
        title: "Reusable questions for papers and Play",
        icon: "pools",
        match: (p) => p.startsWith("/admin/pools"),
      },
      {
        to: "/admin/blueprints",
        label: "Blueprints",
        title: "Optional topic mix when generating a paper",
        icon: "blueprints",
        match: (p) => p.startsWith("/admin/blueprints"),
      },
    ],
  },
  {
    label: "Play",
    items: [
      {
        to: "/admin/play",
        label: "Play",
        title: "Daily, weekly, and hosted games from the same pools",
        icon: "play",
        match: (p) => p.startsWith("/admin/play"),
      },
      {
        to: "/admin/gamification",
        label: "XP",
        title: "XP rules and badges",
        icon: "xp",
        match: (p) => p.startsWith("/admin/gamification"),
      },
    ],
  },
  {
    label: "People",
    items: [
      {
        to: "/admin/users",
        label: "Users",
        title: "Participants, roles, and access",
        icon: "users",
        match: (p) => p.startsWith("/admin/users"),
      },
      {
        to: "/admin/organizations",
        label: "Organisations",
        title: "Organisations and teams used at signup",
        icon: "organization",
        match: (p) => p.startsWith("/admin/organizations"),
      },
    ],
  },
];

export function AdminNav() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <nav className="mb-4 flex max-w-full flex-wrap items-center gap-x-4 gap-y-2" aria-label="Admin">
      {ADMIN_NAV_GROUPS.map((group, groupIndex) => (
        <div key={group.label} className="flex flex-wrap items-center gap-1.5">
          {groupIndex > 0 ? (
            <span className="mx-0.5 hidden h-4 w-px bg-border sm:block" aria-hidden />
          ) : null}
          <span className="sr-only">{group.label}</span>
          {group.items.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.to}
                to={item.to}
                title={item.title}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                <AssessaIcon name={item.icon} className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
