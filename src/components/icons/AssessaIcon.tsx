import type { PlayKind } from "@/lib/play.math";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export const ASSESSA_ICON_NAMES = [
  "dashboard",
  "play",
  "assessments",
  "achievements",
  "leaderboard",
  "admin",
  "bell",
  "profile",
  "logout",
  "menu",
  "overview",
  "courses",
  "pools",
  "blueprints",
  "users",
  "organization",
  "xp",
  "ask",
  "tour",
  "reset",
  "close",
  "plus",
  "pencil",
  "trash",
  "check",
  "search",
  "arrowRight",
  "arrowLeft",
  "calendar",
  "trophy",
  "target",
  "timer",
  "heart",
  "route",
  "layers",
  "zap",
  "swords",
  "team",
  "arena",
  "knockout",
  "escape",
  "book",
  "flame",
  "sparkles",
  "medal",
  "award",
  "compass",
  "hash",
  "list",
] as const;

export type AssessaIconName = (typeof ASSESSA_ICON_NAMES)[number];

const PLAY_KIND_ICONS: Record<PlayKind, AssessaIconName> = {
  daily: "calendar",
  weekly: "trophy",
  topic: "target",
  speed: "timer",
  survival: "heart",
  marathon: "route",
  flash: "layers",
  rapid: "zap",
  battle: "swords",
  team: "team",
  arena: "arena",
  knockout: "knockout",
  escape: "escape",
};

export function playKindIcon(kind: PlayKind): AssessaIconName {
  return PLAY_KIND_ICONS[kind];
}

type IconProps = {
  name: AssessaIconName;
  className?: string;
  title?: string;
};

/** Assessa mark family — ink stroke, gold-ready via currentColor. */
export function AssessaIcon({ name, className, title }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("h-4 w-4 shrink-0", className)}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      {...(title ? { "aria-label": title } : {})}
    >
      {title ? <title>{title}</title> : null}
      <g stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        {ICON[name]}
      </g>
    </svg>
  );
}

const ICON: Record<AssessaIconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.4" />
      <rect x="13" y="4" width="7" height="4.5" rx="1.4" />
      <rect x="13" y="10.5" width="7" height="9.5" rx="1.4" />
      <rect x="4" y="13" width="7" height="7" rx="1.4" />
    </>
  ),
  play: (
    <>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M10.2 8.6v6.8l6-3.4-6-3.4z" fill="currentColor" stroke="none" />
    </>
  ),
  assessments: (
    <>
      <path d="M8 4.5h8a2 2 0 012 2v13l-6-2.4-6 2.4v-13a2 2 0 012-2z" />
      <path d="M9.5 9.5h5M9.5 12.5h5M9.5 15.5h3" />
    </>
  ),
  achievements: (
    <>
      <path d="M12 3.5l2.1 4.2 4.6.7-3.35 3.25.8 4.55L12 14.4l-4.15 2.2.8-4.55L5.3 8.4l4.6-.7L12 3.5z" />
    </>
  ),
  leaderboard: (
    <>
      <path d="M5 19.5V11h4.2v8.5H5zM9.9 19.5V6h4.2v13.5H9.9zM14.8 19.5V13H19v6.5h-4.2z" />
    </>
  ),
  admin: (
    <>
      <path d="M12 3.6l7 2.6v5.1c0 4.3-2.9 7.5-7 8.9-4.1-1.4-7-4.6-7-8.9V6.2l7-2.6z" />
      <path d="M9.4 12.1l1.8 1.8 3.6-3.7" />
    </>
  ),
  bell: (
    <>
      <path d="M6.5 16.2V11a5.5 5.5 0 1111 0v5.2l1.2 1.8H5.3l1.2-1.8z" />
      <path d="M10 19.2a2 2 0 004 0" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8.2" r="3.1" />
      <path d="M5.5 19.2c.7-3.3 3.2-5 6.5-5s5.8 1.7 6.5 5" />
    </>
  ),
  logout: (
    <>
      <path d="M10 5.5H7.2A2.2 2.2 0 005 7.7v8.6a2.2 2.2 0 002.2 2.2H10" />
      <path d="M10.5 12H20M16.6 8.6L20 12l-3.4 3.4" />
    </>
  ),
  menu: (
    <>
      <path d="M5 7h14M5 12h14M5 17h10" />
    </>
  ),
  overview: (
    <>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.2v5.1l3.4 2" />
    </>
  ),
  courses: (
    <>
      <path d="M4.8 6.2c2.4-1 4.8-1.3 7.2 0 2.4-1.3 4.8-1 7.2 0v11.2c-2.4-1-4.8-1.3-7.2 0-2.4-1.3-4.8-1-7.2 0V6.2z" />
      <path d="M12 6.6v10.6" />
    </>
  ),
  pools: (
    <>
      <rect x="4.5" y="5" width="15" height="4.2" rx="1.2" />
      <rect x="4.5" y="10.4" width="15" height="4.2" rx="1.2" />
      <rect x="4.5" y="15.8" width="15" height="3.4" rx="1.2" />
    </>
  ),
  blueprints: (
    <>
      <path d="M7 4.8h10l3 3.4v11a1.8 1.8 0 01-1.8 1.8H7A1.8 1.8 0 015.2 19.2V6.6A1.8 1.8 0 017 4.8z" />
      <path d="M16.6 4.9v3.4h3.2M8.4 12.2h7.2M8.4 15.4h5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.4" r="2.6" />
      <path d="M4.6 18.6c.6-2.8 2.6-4.3 4.4-4.3 1.8 0 3.8 1.5 4.4 4.3" />
      <circle cx="16.2" cy="9" r="2.1" />
      <path d="M15 14.6c1.6-.2 3.3.8 4.4 4" />
    </>
  ),
  organization: (
    <>
      <path d="M4.8 19.4V8.2L12 4.6l7.2 3.6v11.2" />
      <path d="M9 19.4V13h6v6.4" />
      <path d="M4.8 19.4h14.4" />
    </>
  ),
  xp: (
    <>
      <path d="M12 3.8l1.5 4.4h4.6l-3.7 2.7 1.4 4.4L12 12.7 8.2 15.3l1.4-4.4-3.7-2.7h4.6L12 3.8z" />
    </>
  ),
  ask: (
    <>
      <path d="M5.4 16.6A8.2 8.2 0 1118.6 7.4 8.2 8.2 0 018.8 19L5 20.2l.4-3.6z" />
      <path d="M9.2 10.2h.01M12 10.2h.01M14.8 10.2h.01" />
    </>
  ),
  tour: (
    <>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 4.2v2.4M12 17.4v2.4M4.2 12h2.4M17.4 12h2.4" />
      <path d="M12 8.4l2.8 6.2-6.2-2.8L12 8.4z" fill="currentColor" stroke="none" />
    </>
  ),
  reset: (
    <>
      <path d="M5.4 11a6.6 6.6 0 111.2 4.4" />
      <path d="M5.2 6.8v4.4H9.6" />
    </>
  ),
  close: (
    <>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </>
  ),
  plus: (
    <>
      <path d="M12 6v12M6 12h12" />
    </>
  ),
  pencil: (
    <>
      <path d="M13.4 5.6l4.8 4.8-9.7 9.7H3.8v-4.7l9.6-9.8z" />
      <path d="M11.6 7.4l4.8 4.8" />
    </>
  ),
  trash: (
    <>
      <path d="M5 7.4h14" />
      <path d="M9.2 7.4V5.4h5.6v2" />
      <path d="M7.2 7.4l.8 11.2h8l.8-11.2" />
    </>
  ),
  check: (
    <>
      <path d="M5.5 12.4l4.2 4.3 8.8-9.4" />
    </>
  ),
  search: (
    <>
      <circle cx="10.6" cy="10.6" r="5.4" />
      <path d="M14.8 14.8L19 19" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M5 12h14M13.5 6.5L19 12l-5.5 5.5" />
    </>
  ),
  arrowLeft: (
    <>
      <path d="M19 12H5M10.5 6.5L5 12l5.5 5.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="4.4" y="5.6" width="15.2" height="14" rx="1.8" />
      <path d="M4.4 10h15.2M8.2 4.4v3M15.8 4.4v3" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4.6h8v4.4a4 4 0 01-8 0V4.6z" />
      <path d="M8 6.4H5.6A2.6 2.6 0 008 9M16 6.4h2.4A2.6 2.6 0 0016 9" />
      <path d="M12 13v3.2M8.6 19.4h6.8M10 16.2h4" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="4.4" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13" r="7.2" />
      <path d="M12 13V8.8M10 4.4h4" />
    </>
  ),
  heart: (
    <>
      <path d="M12 19.2s-7.2-4.4-7.2-9.1A3.7 3.7 0 0112 8.2a3.7 3.7 0 017.2 1.9c0 4.7-7.2 9.1-7.2 9.1z" />
    </>
  ),
  route: (
    <>
      <circle cx="6.4" cy="6.6" r="2.1" />
      <circle cx="17.6" cy="17.4" r="2.1" />
      <path d="M8.2 7.8c4.2 0 4.2 8.4 8.2 8.4" />
    </>
  ),
  layers: (
    <>
      <path d="M12 4.6l8 3.6-8 3.6-8-3.6 8-3.6z" />
      <path d="M4.4 12.4L12 16l7.6-3.6" />
      <path d="M4.4 16L12 19.6l7.6-3.6" />
    </>
  ),
  zap: (
    <>
      <path d="M13.2 3.8L6.4 13.2h5.2L10.6 20.2l7.2-10.2h-5.2L13.2 3.8z" />
    </>
  ),
  swords: (
    <>
      <path d="M6.2 18.4L17.6 5.6M16.2 5.2l2.6.4.4 2.6" />
      <path d="M17.8 18.4L6.4 5.6M7.8 5.2L5.2 5.6l-.4 2.6" />
      <path d="M8.6 16.8l-3 3M18.4 16.8l3 3" />
    </>
  ),
  team: (
    <>
      <circle cx="12" cy="7.8" r="2.5" />
      <circle cx="6.6" cy="9.2" r="2" />
      <circle cx="17.4" cy="9.2" r="2" />
      <path d="M8.2 18.8c.5-2.8 2.2-4.2 3.8-4.2s3.3 1.4 3.8 4.2" />
      <path d="M4.4 18.4c.4-2 1.6-3.1 2.8-3.1" />
      <path d="M19.6 18.4c-.4-2-1.6-3.1-2.8-3.1" />
    </>
  ),
  arena: (
    <>
      <path d="M4.4 16.6c2.4 2.2 5 3.2 7.6 3.2s5.2-1 7.6-3.2" />
      <path d="M5.2 12.4c2.1 1.7 4.4 2.5 6.8 2.5s4.7-.8 6.8-2.5" />
      <ellipse cx="12" cy="8.2" rx="7.6" ry="3.2" />
    </>
  ),
  knockout: (
    <>
      <path d="M5 7h4v3H5zM15 7h4v3h-4zM10 14h4v3h-4z" />
      <path d="M7 10v2h10v-2M12 12v2" />
    </>
  ),
  escape: (
    <>
      <rect x="5" y="8.2" width="14" height="11" rx="1.6" />
      <path d="M9 8.2V6.4a3 3 0 016 0v1.8" />
      <circle cx="12" cy="13.8" r="1.2" fill="currentColor" stroke="none" />
      <path d="M12 15v2" />
    </>
  ),
  book: (
    <>
      <path d="M5 6.2c2.2-.9 4.4-1.1 7 0 2.6-1.1 4.8-.9 7 0v11.4c-2.2-.9-4.4-1.1-7 0-2.6-1.1-4.8-.9-7 0V6.2z" />
    </>
  ),
  flame: (
    <>
      <path d="M12 20c3.8 0 6.2-2.6 6.2-6.1 0-3.4-2.4-5.6-3.6-7.3-1 2.2-1.6 3.2-3.2 4.1.4-2.8.2-5.1-1.6-7.1C8 6.4 5.8 9.2 5.8 13.2 5.8 17 8.3 20 12 20z" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 4.2l1.2 3.4 3.5 1.2-3.5 1.2L12 13.4l-1.2-3.4-3.5-1.2 3.5-1.2L12 4.2z" />
      <path d="M18.2 13.6l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9z" />
      <path d="M5.6 14.2l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6.6-1.6z" />
    </>
  ),
  medal: (
    <>
      <circle cx="12" cy="14.2" r="5.2" />
      <path d="M8.4 4.6l3.6 4.4 3.6-4.4" />
    </>
  ),
  award: (
    <>
      <circle cx="12" cy="9.4" r="4.6" />
      <path d="M9.2 13.4l-1.8 6.2L12 17.2l4.6 2.4-1.8-6.2" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M14.6 9.4l-1.4 5.2-5.2 1.4 1.4-5.2 5.2-1.4z" />
    </>
  ),
  hash: (
    <>
      <path d="M9 5.5L7.4 18.5M16.6 5.5L15 18.5M5.2 9.4h14M4.8 14.6h14" />
    </>
  ),
  list: (
    <>
      <path d="M9.4 7H19M9.4 12H19M9.4 17H19" />
      <path d="M5.4 7h.01M5.4 12h.01M5.4 17h.01" />
    </>
  ),
};
