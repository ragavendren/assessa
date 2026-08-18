import { PLAY_KIND_META, type PlayKind } from "@/lib/play.math";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  Calendar,
  Heart,
  LandPlot,
  Layers,
  Route,
  Swords,
  Target,
  Timer,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

const MODE_ICONS: Partial<Record<PlayKind, LucideIcon>> = {
  daily: Calendar,
  weekly: Trophy,
  topic: Target,
  speed: Timer,
  survival: Heart,
  marathon: Route,
  flash: Layers,
  rapid: Zap,
  battle: Swords,
  team: Users,
  arena: LandPlot,
};

export function playModeIcon(kind: PlayKind) {
  return MODE_ICONS[kind] ?? BookOpen;
}

export function PlayModeCard({
  kind,
  courseId,
  questionCount,
  durationSeconds,
  lives,
  onStart,
  to,
  params,
  search,
  disabled,
  pending,
  footer,
}: {
  kind: PlayKind;
  courseId: string;
  questionCount?: number;
  durationSeconds?: number | null;
  lives?: number | null;
  onStart?: () => void;
  to?: string;
  params?: Record<string, string>;
  search?: Record<string, string | undefined>;
  disabled?: boolean;
  pending?: boolean;
  footer?: ReactNode;
}) {
  const meta = PLAY_KIND_META[kind];
  const Icon = playModeIcon(kind);
  const stats = [
    questionCount ? `${questionCount} Q` : null,
    durationSeconds ? formatShortTime(durationSeconds) : null,
    lives != null ? `${lives} lives` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const body = (
    <>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{meta.label}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{meta.blurb}</p>
          {stats ? (
            <p className="mt-2 text-[11px] tabular-nums text-muted-foreground">{stats}</p>
          ) : null}
        </div>
      </div>
      {footer}
    </>
  );

  const className = cn(
    "group block w-full rounded-xl border border-border p-4 text-left transition-colors",
    "hover:border-primary/30 hover:bg-secondary/40",
    disabled && "pointer-events-none opacity-50",
  );

  if (to) {
    return (
      <Link
        to={to as "/play/topics"}
        {...(params ? { params: params as { tournamentId: string } } : {})}
        {...(search ? { search: search as { courseId: string } } : {})}
        className={className}
      >
        {body}
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={onStart}
      className={className}
      data-course={courseId}
    >
      {body}
    </button>
  );
}

function formatShortTime(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  return `${m} min`;
}
