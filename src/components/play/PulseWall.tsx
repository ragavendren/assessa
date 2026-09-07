import type { PulseWallAggregate } from "@/lib/play.pulse";
import { cn } from "@/lib/utils";

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
      <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-5 py-10 text-center text-sm text-muted-foreground">
        {title ?? "Waiting for responses…"}
      </div>
    );
  }

  return (
    <section
      className={cn("rounded-2xl border border-border bg-card p-4", large && "p-6 sm:p-8")}
      aria-label={title ?? "Response wall"}
    >
      {title ? (
        <h2 className={cn("font-semibold", large ? "text-xl" : "text-sm")}>{title}</h2>
      ) : null}
      {wall.kind === "mcq" ? <McqWall wall={wall} large={large} /> : null}
      {wall.kind === "rating" ? <RatingWall wall={wall} large={large} /> : null}
      {wall.kind === "text" ? <TextWall wall={wall} large={large} /> : null}
    </section>
  );
}

function McqWall({
  wall,
  large,
}: {
  wall: Extract<PulseWallAggregate, { kind: "mcq" }>;
  large?: boolean;
}) {
  return (
    <div className={cn("space-y-3", titleGap(large))}>
      <p className="text-xs text-muted-foreground">
        {wall.total} response{wall.total === 1 ? "" : "s"}
      </p>
      <ul className="space-y-2">
        {wall.options.map((opt) => (
          <li key={opt.label}>
            <div className="mb-1 flex justify-between gap-2 text-sm">
              <span className="font-medium">{opt.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {opt.count} · {opt.percent}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary" role="presentation">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${opt.percent}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
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
    <div className={cn("space-y-4", titleGap(large))}>
      <p className={cn("font-semibold tabular-nums", large ? "text-3xl" : "text-xl")}>
        {wall.average}
        <span className="ml-1 text-sm font-normal text-muted-foreground">/ {wall.max} avg</span>
      </p>
      <p className="text-xs text-muted-foreground">
        {wall.total} response{wall.total === 1 ? "" : "s"}
      </p>
      <ul className="space-y-2">
        {wall.histogram.map((row) => (
          <li key={row.rating} className="flex items-center gap-3 text-sm">
            <span className="w-8 tabular-nums text-muted-foreground">{row.rating}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-amber-500 transition-[width] duration-500"
                style={{ width: `${Math.round((row.count / maxCount) * 100)}%` }}
              />
            </div>
            <span className="w-8 text-right tabular-nums text-muted-foreground">{row.count}</span>
          </li>
        ))}
      </ul>
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
  return (
    <div className={cn("space-y-3", titleGap(large))}>
      <p className="text-xs text-muted-foreground">
        {wall.total} response{wall.total === 1 ? "" : "s"}
      </p>
      {wall.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No text responses yet.</p>
      ) : (
        <ul className={cn("grid gap-2", large ? "sm:grid-cols-2 lg:grid-cols-3" : "")}>
          {wall.items.map((item, index) => (
            <li
              key={`${item.userId}-${item.submittedAt}-${index}`}
              className="rounded-xl border border-border bg-secondary/30 px-3 py-2 text-sm"
            >
              {item.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function titleGap(large?: boolean) {
  return large ? "mt-4" : "mt-3";
}
