import { cn } from "@/lib/utils";
import { useId, useMemo, useState } from "react";

export type ScoreTrendPoint = {
  label: string;
  score: number;
  passed: boolean;
};

type ScoreTrendChartProps = {
  points: ScoreTrendPoint[];
  className?: string;
  /** How many recent points to plot. */
  limit?: number;
};

const WIDTH = 480;
const HEIGHT = 168;
const PAD = { top: 16, right: 12, bottom: 28, left: 36 };

/** Accessible SVG score trend with axes, area fill, and hover details. */
export function ScoreTrendChart({ points, className, limit = 8 }: ScoreTrendChartProps) {
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);

  const series = useMemo(() => points.slice(-limit), [points, limit]);

  const layout = useMemo(() => {
    const plotW = WIDTH - PAD.left - PAD.right;
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    const yMax = 100;
    const yMin = 0;

    const xFor = (index: number) => {
      if (series.length <= 1) return PAD.left + plotW / 2;
      return PAD.left + (index / (series.length - 1)) * plotW;
    };
    const yFor = (score: number) => {
      const clamped = Math.max(yMin, Math.min(yMax, score));
      return PAD.top + plotH - (clamped / yMax) * plotH;
    };

    const coords = series.map((point, index) => ({
      ...point,
      x: xFor(index),
      y: yFor(point.score),
    }));

    const linePath =
      coords.length === 0
        ? ""
        : coords
            .map(
              (point, index) =>
                `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
            )
            .join(" ");

    const areaPath =
      coords.length === 0
        ? ""
        : `${linePath} L ${coords[coords.length - 1]!.x.toFixed(1)} ${(PAD.top + plotH).toFixed(1)} L ${coords[0]!.x.toFixed(1)} ${(PAD.top + plotH).toFixed(1)} Z`;

    const yTicks = [0, 25, 50, 75, 100];

    return { coords, linePath, areaPath, yTicks, yFor, plotH };
  }, [series]);

  if (series.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Complete assessments to unlock your score trend.
      </p>
    );
  }

  const activePoint = active != null ? layout.coords[active] : null;
  const latest = layout.coords[layout.coords.length - 1];
  const first = layout.coords[0];
  const delta = latest && first && layout.coords.length > 1 ? latest.score - first.score : null;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">Latest score</p>
          <p className="font-display text-2xl tabular-nums leading-none">
            {latest?.score ?? 0}
            <span className="text-base text-muted-foreground">%</span>
          </p>
        </div>
        {delta != null ? (
          <p
            className={cn(
              "rounded-md px-2 py-1 text-xs font-semibold tabular-nums",
              delta > 0 && "bg-success/12 text-success",
              delta < 0 && "bg-destructive/12 text-destructive",
              delta === 0 && "bg-secondary text-muted-foreground",
            )}
          >
            {delta > 0 ? "+" : ""}
            {delta} pts vs first in range
          </p>
        ) : null}
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-44 w-full overflow-visible"
          role="img"
          aria-label={`Score trend across ${series.length} assessments`}
          onMouseLeave={() => setActive(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {layout.yTicks.map((tick) => {
            const y = layout.yFor(tick);
            return (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={WIDTH - PAD.right}
                  y1={y}
                  y2={y}
                  stroke="var(--color-border)"
                  strokeDasharray={tick === 0 ? undefined : "3 4"}
                  strokeWidth={tick === 0 ? 1.25 : 1}
                />
                <text
                  x={PAD.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-muted-foreground"
                  style={{ fontSize: 10 }}
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {layout.areaPath ? (
            <path d={layout.areaPath} fill={`url(#${gradientId})`} className="animate-dash-rise" />
          ) : null}
          {layout.linePath ? (
            <path
              d={layout.linePath}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-dash-rise"
            />
          ) : null}

          {layout.coords.map((point, index) => (
            <g key={`${point.label}-${index}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r={active === index ? 6 : 4.5}
                fill={point.passed ? "var(--color-success)" : "var(--color-destructive)"}
                stroke="var(--color-card)"
                strokeWidth={2}
                className="transition-[r] duration-150"
              />
              <circle
                cx={point.x}
                cy={point.y}
                r={14}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                tabIndex={0}
                role="img"
                aria-label={`${point.label}: ${point.score}% ${point.passed ? "passed" : "not passed"}`}
              />
              <text
                x={point.x}
                y={HEIGHT - 8}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: 10 }}
              >
                {shortLabel(point.label, series.length)}
              </text>
            </g>
          ))}

          {activePoint ? (
            <g pointerEvents="none">
              <line
                x1={activePoint.x}
                x2={activePoint.x}
                y1={PAD.top}
                y2={PAD.top + layout.plotH}
                stroke="var(--color-foreground)"
                strokeOpacity={0.15}
                strokeDasharray="3 3"
              />
            </g>
          ) : null}
        </svg>

        {activePoint ? (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs shadow-md"
            style={{
              left: `${(activePoint.x / WIDTH) * 100}%`,
              top: Math.max(4, (activePoint.y / HEIGHT) * 100 - 18) + "%",
            }}
          >
            <p className="font-semibold tabular-nums text-foreground">{activePoint.score}%</p>
            <p className="text-muted-foreground">{activePoint.label}</p>
            <p className={activePoint.passed ? "text-success" : "text-destructive"}>
              {activePoint.passed ? "Passed" : "Not passed"}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-success" aria-hidden />
          Passed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive" aria-hidden />
          Not passed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-accent" aria-hidden />
          Score over time
        </span>
      </div>
    </div>
  );
}

function shortLabel(label: string, count: number) {
  if (!label) return "—";
  if (count > 6) {
    const parts = label.split(" ");
    return parts[0] ?? label.slice(0, 6);
  }
  return label.length > 8 ? label.slice(0, 7) + "…" : label;
}
