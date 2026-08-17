import { cn } from "@/lib/utils";
import { speedZoneOf, type SpeedZone } from "@/lib/play.speed";
import { Timer } from "lucide-react";

export type { SpeedZone };
export { crossedSpeedAlert, SPEED_ALERTS, speedZoneOf } from "@/lib/play.speed";

export function SpeedHud({
  remaining,
  durationSeconds,
  index,
  total,
  alert,
}: {
  remaining: number;
  durationSeconds: number;
  index: number;
  total: number;
  alert?: { title: string; body: string } | null;
}) {
  const zone = speedZoneOf(remaining, durationSeconds);
  const pctLeft = durationSeconds > 0 ? Math.max(0, remaining / durationSeconds) : 1;
  const redzone = zone === "red";
  const label =
    zone === "red"
      ? "Red zone"
      : zone === "five"
        ? "5% left"
        : zone === "ten"
          ? "10% left"
          : zone === "quarter"
            ? "25% left"
            : zone === "half"
              ? "50% left"
              : "On the clock";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border p-4",
        zone === "ok" && "border-border bg-card",
        zone === "half" && "border-amber-400/40 bg-amber-500/5",
        zone === "quarter" && "border-orange-400/50 bg-orange-500/10",
        zone === "ten" && "border-orange-600/60 bg-orange-600/10",
        zone === "red" && "speed-redzone border-destructive bg-destructive/10",
      )}
    >
      {alert ? (
        <div
          className={cn(
            "speed-alert mb-3 rounded-lg px-3 py-2 text-center",
            redzone ? "bg-destructive text-destructive-foreground" : "bg-amber-500 text-amber-950",
          )}
        >
          <p className="text-sm font-semibold">{alert.title}</p>
          <p className="text-xs opacity-90">{alert.body}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold uppercase tracking-wide">
          <Timer className="h-3.5 w-3.5" />
          Speed Challenge
        </span>
        <p className="text-xs text-muted-foreground">
          {index + 1} / {total}
        </p>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {redzone ? "Red zone" : label}
        </p>
        <p
          className={cn(
            "speed-clock font-display text-4xl tabular-nums leading-none md:text-5xl",
            zone === "ok" && "text-foreground",
            zone === "half" && "text-amber-700 speed-tick",
            zone === "quarter" && "text-orange-700 speed-tick",
            zone === "ten" && "text-orange-800 speed-tick-fast",
            redzone && "text-destructive speed-tick-red",
          )}
        >
          {Math.floor(remaining / 60)}
          <span
            className={cn(
              "speed-colon",
              zone === "quarter" && "speed-colon-mid",
              (zone === "ten" || redzone) && "speed-colon-fast",
            )}
          >
            :
          </span>
          {String(remaining % 60).padStart(2, "0")}
        </p>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full transition-[width] duration-1000 ease-linear",
            zone === "ok" && "bg-primary",
            zone === "half" && "bg-amber-500",
            zone === "quarter" && "bg-orange-500",
            zone === "ten" && "bg-orange-700",
            redzone && "bg-destructive",
          )}
          style={{ width: `${pctLeft * 100}%` }}
        />
      </div>
    </div>
  );
}
