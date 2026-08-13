import { SKILL_TRACK_LABELS, trackForLevel } from "@/lib/gamification";
import { cn } from "@/lib/utils";
import type { CSSProperties, ReactNode } from "react";

export function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="text-hairline text-muted-foreground">{eyebrow}</p> : null}
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function StatTile({
  label,
  value,
  suffix,
  hint,
  className,
  style,
  surface = "paper",
}: {
  label: string;
  value: string | number;
  suffix?: string;
  hint?: string;
  className?: string;
  style?: CSSProperties;
  surface?: "paper" | "metal";
}) {
  const metal = surface === "metal";
  return (
    <div
      className={cn(
        "dash-lift dash-lift-hover flex min-h-[7.5rem] flex-col justify-between gap-2 overflow-hidden p-4",
        metal ? "surface-metal dash-lift-metal" : "surface-paper",
        className,
      )}
      style={style}
    >
      <p className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="font-display text-2xl leading-none tabular-nums sm:text-3xl">
        <span className="break-all">{value}</span>
        {suffix ? (
          <span className="ml-0.5 text-base font-normal text-muted-foreground">{suffix}</span>
        ) : null}
      </p>
      {hint ? (
        <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{hint}</p>
      ) : (
        <span className="h-4" aria-hidden />
      )}
    </div>
  );
}

export function ScorePill({ score, passed }: { score: number; passed: boolean | null }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
        passed
          ? "bg-success/12 text-success"
          : passed === false
            ? "bg-destructive/12 text-destructive"
            : "bg-muted text-muted-foreground",
      )}
    >
      {score}%{passed == null ? null : <span>{passed ? "PASSED" : "NOT PASSED"}</span>}
    </span>
  );
}

export function Meter({
  value,
  tone = "accent",
  className,
}: {
  value: number;
  tone?: "accent" | "success" | "muted";
  className?: string;
}) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-all",
          tone === "accent" && "bg-accent",
          tone === "success" && "bg-success",
          tone === "muted" && "bg-muted-foreground/40",
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function LevelMeter({
  level,
  name,
  xp,
  xpToNext,
  nextLevel,
  progress,
  className,
  style,
  surface = "paper",
}: {
  level: number;
  name: string;
  xp: number;
  xpToNext: number;
  nextLevel: number | null;
  progress: number;
  className?: string;
  style?: CSSProperties;
  surface?: "paper" | "metal";
}) {
  const metal = surface === "metal";
  return (
    <div
      className={cn(
        "dash-lift dash-lift-hover flex h-full min-h-[7.5rem] flex-col justify-between gap-3 p-5",
        metal ? "surface-metal dash-lift-metal" : "surface-paper",
        className,
      )}
      style={style}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Level {level} · {SKILL_TRACK_LABELS[trackForLevel(level)]}
          </p>
          <p className="mt-1 truncate font-display text-xl sm:text-2xl">{name}</p>
        </div>
        <p className="shrink-0 font-display text-xl tabular-nums text-accent sm:text-2xl">
          {xp.toLocaleString()}
          <span className="ml-1 text-xs font-normal text-muted-foreground">XP</span>
        </p>
      </div>
      <div>
        <Meter value={progress * 100} />
        <p className="mt-2 text-xs text-muted-foreground">
          {nextLevel
            ? `${xpToNext.toLocaleString()} XP to Level ${nextLevel}`
            : "Highest level reached"}
        </p>
      </div>
    </div>
  );
}

export function MasteryBar({
  label,
  value,
  meta,
}: {
  label: string;
  value: number;
  meta?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate">{label}</span>
        <span className="font-semibold tabular-nums">{value}%</span>
      </div>
      <Meter className="mt-1.5" value={value} tone={value >= 80 ? "success" : "accent"} />
      {meta ? <p className="mt-1 text-xs text-muted-foreground">{meta}</p> : null}
    </div>
  );
}

export function EmptyState({
  icon = "📄",
  title,
  body,
  action,
}: {
  icon?: string;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface-paper flex flex-col items-center gap-2 px-6 py-14 text-center">
      <span className="text-3xl">{icon}</span>
      <p className="font-display text-lg">{title}</p>
      {body ? <p className="max-w-sm text-sm text-muted-foreground">{body}</p> : null}
      {action}
    </div>
  );
}

export function PageLoader({ label }: { label?: string } = {}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
      {label ? <p className="text-sm text-muted-foreground">{label}</p> : null}
    </div>
  );
}
