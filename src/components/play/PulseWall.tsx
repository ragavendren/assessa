import type { PulseWallAggregate } from "@/lib/play.pulse";
import { cn } from "@/lib/utils";

/** Mentimeter-inspired wall palette — vivid, distinct, not purple-default. */
const WALL_COLORS = [
  {
    bar: "bg-teal-500",
    soft: "bg-teal-500/15",
    text: "text-teal-800 dark:text-teal-200",
    chip: "bg-teal-500 text-white",
  },
  {
    bar: "bg-rose-500",
    soft: "bg-rose-500/15",
    text: "text-rose-800 dark:text-rose-200",
    chip: "bg-rose-500 text-white",
  },
  {
    bar: "bg-amber-500",
    soft: "bg-amber-500/15",
    text: "text-amber-900 dark:text-amber-200",
    chip: "bg-amber-500 text-white",
  },
  {
    bar: "bg-sky-500",
    soft: "bg-sky-500/15",
    text: "text-sky-900 dark:text-sky-200",
    chip: "bg-sky-500 text-white",
  },
  {
    bar: "bg-emerald-500",
    soft: "bg-emerald-500/15",
    text: "text-emerald-900 dark:text-emerald-200",
    chip: "bg-emerald-500 text-white",
  },
  {
    bar: "bg-orange-500",
    soft: "bg-orange-500/15",
    text: "text-orange-900 dark:text-orange-200",
    chip: "bg-orange-500 text-white",
  },
  {
    bar: "bg-cyan-600",
    soft: "bg-cyan-500/15",
    text: "text-cyan-900 dark:text-cyan-200",
    chip: "bg-cyan-600 text-white",
  },
  {
    bar: "bg-lime-600",
    soft: "bg-lime-500/20",
    text: "text-lime-900 dark:text-lime-200",
    chip: "bg-lime-600 text-white",
  },
] as const;

const COLLAGE_INK = [
  "text-teal-600 dark:text-teal-300",
  "text-rose-600 dark:text-rose-300",
  "text-amber-600 dark:text-amber-300",
  "text-sky-600 dark:text-sky-300",
  "text-emerald-600 dark:text-emerald-300",
  "text-orange-600 dark:text-orange-300",
  "text-cyan-700 dark:text-cyan-300",
  "text-fuchsia-600 dark:text-fuchsia-300",
] as const;

function colorAt(index: number) {
  return WALL_COLORS[index % WALL_COLORS.length]!;
}

function inkAt(index: number) {
  return COLLAGE_INK[index % COLLAGE_INK.length]!;
}

export function PulseWall({
  wall,
  title,
  large,
}: {
  wall: PulseWallAggregate | null;
  title?: string;
  large?: boolean;
}) {
  if (!wall) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-gradient-to-br from-secondary/40 via-background to-teal-500/5 px-5 py-12 text-center text-sm text-muted-foreground">
        {title ?? "Waiting for responses…"}
      </div>
    );
  }

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
        large ? "p-6 sm:p-8" : "p-4",
      )}
      aria-label={title ?? "Response wall"}
    >
      {title ? (
        <div className="mb-1 flex flex-wrap items-end justify-between gap-2">
          <h2
            className={cn(
              "font-display font-semibold tracking-tight",
              large ? "text-2xl" : "text-sm",
            )}
          >
            {title}
          </h2>
          <ResponseCount total={wall.total} large={large} />
        </div>
      ) : (
        <div className="mb-1 flex justify-end">
          <ResponseCount total={wall.total} large={large} />
        </div>
      )}
      {wall.kind === "mcq" ? <McqWall wall={wall} large={large} /> : null}
      {wall.kind === "rating" ? <RatingWall wall={wall} large={large} /> : null}
      {wall.kind === "text" ? <TextWall wall={wall} large={large} /> : null}
    </section>
  );
}

function ResponseCount({ total, large }: { total: number; large?: boolean }) {
  return (
    <p className={cn("tabular-nums text-muted-foreground", large ? "text-sm" : "text-xs")}>
      {total} response{total === 1 ? "" : "s"}
    </p>
  );
}

function McqWall({
  wall,
  large,
}: {
  wall: Extract<PulseWallAggregate, { kind: "mcq" }>;
  large?: boolean;
}) {
  const maxPercent = Math.max(1, ...wall.options.map((o) => o.percent));
  return (
    <ul className={cn("space-y-3", large ? "mt-5 space-y-4" : "mt-3")}>
      {wall.options.map((opt, index) => {
        const color = colorAt(index);
        const width = wall.total === 0 ? 0 : Math.max(opt.percent, opt.count > 0 ? 6 : 0);
        return (
          <li
            key={`${opt.label}-${index}`}
            className="animate-[pulse-wall-rise_0.45s_ease-out_both]"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className={cn("font-medium", large ? "text-base" : "text-sm")}>
                {opt.label}
              </span>
              <span
                className={cn(
                  "shrink-0 tabular-nums font-semibold",
                  color.text,
                  large ? "text-base" : "text-sm",
                )}
              >
                {opt.percent}%
                <span className="ml-1.5 font-normal text-muted-foreground">({opt.count})</span>
              </span>
            </div>
            <div
              className={cn(
                "overflow-hidden rounded-full bg-secondary/80",
                large ? "h-5" : "h-3.5",
              )}
              role="presentation"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-700 ease-out",
                  color.bar,
                  opt.percent === maxPercent && opt.count > 0 && "shadow-sm",
                )}
                style={{ width: `${width}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function RatingWall({
  wall,
  large,
}: {
  wall: Extract<PulseWallAggregate, { kind: "rating" }>;
  large?: boolean;
}) {
  const maxCount = Math.max(1, ...wall.histogram.map((h) => h.count));
  return (
    <div className={cn(large ? "mt-5" : "mt-3")}>
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <p
          className={cn(
            "font-display font-semibold tabular-nums leading-none",
            large ? "text-5xl" : "text-3xl",
          )}
        >
          {wall.average}
        </p>
        <p className="pb-1 text-sm text-muted-foreground">average · scale 1–{wall.max}</p>
      </div>
      <div className={cn("flex items-end justify-between gap-2 sm:gap-3", large ? "h-48" : "h-36")}>
        {wall.histogram.map((row, index) => {
          const color = colorAt(index);
          const height = Math.round((row.count / maxCount) * 100);
          return (
            <div
              key={row.rating}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
            >
              <span className={cn("tabular-nums text-xs font-semibold", color.text)}>
                {row.count > 0 ? row.count : ""}
              </span>
              <div
                className={cn(
                  "relative w-full max-w-[3.5rem] overflow-hidden rounded-t-xl transition-[height] duration-700 ease-out",
                  color.soft,
                  large ? "min-h-3" : "min-h-2",
                )}
                style={{ height: `${Math.max(height, row.count > 0 ? 8 : 3)}%` }}
              >
                <div className={cn("absolute inset-x-0 bottom-0 h-full rounded-t-xl", color.bar)} />
              </div>
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {row.rating}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TextWall({
  wall,
  large,
}: {
  wall: Extract<PulseWallAggregate, { kind: "text" }>;
  large?: boolean;
}) {
  const words = wall.words?.length
    ? wall.words
    : // Older payloads without words[] — fall back to raw phrases as chips.
      wall.items.map((item) => ({ word: item.text, count: 1 }));
  const maxCount = Math.max(1, ...words.map((w) => w.count));

  if (wall.items.length === 0) {
    return <p className="mt-4 text-sm text-muted-foreground">No text responses yet.</p>;
  }

  return (
    <div className={cn(large ? "mt-5" : "mt-3")}>
      <div
        className={cn(
          "relative flex flex-wrap content-center items-center justify-center gap-x-3 gap-y-2 overflow-hidden rounded-2xl bg-gradient-to-br from-secondary/50 via-background to-amber-500/5 px-3 py-6",
          large ? "min-h-[18rem] gap-x-4 gap-y-3 px-6 py-10" : "min-h-[12rem]",
        )}
        aria-label="Word collage"
      >
        {words.map((entry, index) => {
          const weight = entry.count / maxCount;
          const fontSize = large ? 0.95 + weight * 2.1 : 0.8 + weight * 1.45;
          const rotate = ((index * 37) % 9) - 4;
          return (
            <span
              key={`${entry.word}-${index}`}
              className={cn(
                "inline-block font-display font-semibold leading-tight transition-transform duration-300 hover:scale-105",
                inkAt(index),
                "animate-[pulse-wall-rise_0.5s_ease-out_both]",
              )}
              style={{
                fontSize: `${fontSize}rem`,
                transform: `rotate(${rotate}deg)`,
                animationDelay: `${Math.min(index, 24) * 35}ms`,
                opacity: 0.72 + weight * 0.28,
              }}
              title={`${entry.count} mention${entry.count === 1 ? "" : "s"}`}
            >
              {entry.word}
            </span>
          );
        })}
      </div>

      {wall.items.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recent answers
          </p>
          <ul className="flex flex-wrap gap-2">
            {wall.items.slice(0, large ? 18 : 10).map((item, index) => {
              const color = colorAt(index);
              return (
                <li
                  key={`${item.userId}-${item.submittedAt}-${index}`}
                  className={cn(
                    "max-w-full rounded-full px-3 py-1.5 text-xs font-medium shadow-sm",
                    color.chip,
                    "animate-[pulse-wall-rise_0.4s_ease-out_both]",
                  )}
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <span className="line-clamp-2">{item.text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
