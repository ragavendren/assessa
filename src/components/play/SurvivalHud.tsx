import { cn } from "@/lib/utils";
import { Heart, Zap } from "lucide-react";

export function SurvivalHud({
  livesLeft,
  maxLives,
  streak,
  index,
  remaining,
  itemRemaining,
  shake,
}: {
  livesLeft: number;
  maxLives: number;
  streak: number;
  index: number;
  remaining: number | null;
  itemRemaining: number | null;
  shake?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-destructive/20 bg-gradient-to-br from-destructive/5 via-card to-card p-4",
        shake && "animate-[shake_0.4s_ease-in-out]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-destructive">
            Survival
          </span>
          {streak > 1 ? (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600">
              <Zap className="h-3.5 w-3.5" />
              {streak} streak
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {Array.from({ length: maxLives }).map((_, i) => (
            <Heart
              key={i}
              className={cn(
                "h-5 w-5 transition-all",
                i < livesLeft
                  ? "fill-destructive text-destructive"
                  : "fill-transparent text-muted-foreground/30",
              )}
            />
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Question <span className="font-semibold text-foreground">{index + 1}</span>
          {streak > 0 ? ` · ${streak} streak` : ""}
        </p>
        <div className="flex gap-3 tabular-nums text-sm">
          {remaining != null ? (
            <span className="rounded-md bg-secondary px-2 py-0.5">{formatClock(remaining)}</span>
          ) : null}
          {itemRemaining != null ? (
            <span className="rounded-md bg-secondary px-2 py-0.5">{itemRemaining}s</span>
          ) : null}
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full bg-destructive transition-all duration-500"
          style={{ width: `${Math.min(100, ((index + 1) / Math.max(8, index + 2)) * 100)}%` }}
        />
      </div>
    </div>
  );
}

export function RapidHud({
  index,
  total,
  itemRemaining,
  streak,
}: {
  index: number;
  total: number;
  itemRemaining: number | null;
  streak: number;
}) {
  const urgent = itemRemaining != null && itemRemaining <= 5;
  return (
    <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-card to-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
          Rapid Fire
        </span>
        {streak > 1 ? (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600">
            <Zap className="h-3.5 w-3.5" />
            {streak} streak
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {index + 1} / {total}
        </p>
        {itemRemaining != null ? (
          <span
            className={cn(
              "rounded-full px-3 py-1 text-lg font-bold tabular-nums",
              urgent ? "bg-destructive/10 text-destructive animate-pulse" : "bg-secondary",
            )}
          >
            {itemRemaining}s
          </span>
        ) : null}
      </div>
    </div>
  );
}

function formatClock(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
