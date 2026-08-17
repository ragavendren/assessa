import { PodiumMedal } from "@/components/PodiumMedal";
import { formatAttemptCount, formatDuration, initials } from "@/lib/gamification";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type BoardStageRow = {
  rank: number;
  name: string;
  score: number;
  exams?: number;
  attempts?: number;
  durationSeconds?: number | null;
  isMe?: boolean;
};

export type BoardColumns = "play" | "exam-single" | "exam-all";

export function BoardStage({
  rows,
  columns,
  scoreSuffix = "",
  podiumHint = "Best score first",
}: {
  rows: BoardStageRow[];
  columns: BoardColumns;
  scoreSuffix?: string;
  podiumHint?: string;
}) {
  const topThree = rows.filter((row) => row.rank <= 3);

  return (
    <div className="board-stage grid overflow-hidden rounded-[var(--radius-lg)] border border-border lg:grid-cols-[minmax(18.5rem,22.5rem)_minmax(0,1fr)] lg:items-start">
      <Podium rows={topThree} columns={columns} scoreSuffix={scoreSuffix} hint={podiumHint} />
      <RankTable rows={rows} columns={columns} scoreSuffix={scoreSuffix} />
    </div>
  );
}

function Podium({
  rows,
  columns,
  scoreSuffix,
  hint,
}: {
  rows: BoardStageRow[];
  columns: BoardColumns;
  scoreSuffix: string;
  hint: string;
}) {
  if (rows.length === 0) return null;

  const first = rows.find((row) => row.rank === 1);
  const second = rows.find((row) => row.rank === 2);
  const third = rows.find((row) => row.rank === 3);
  const ordered = [second, first, third].filter((row): row is BoardStageRow => Boolean(row));

  return (
    <section className="relative overflow-hidden bg-[linear-gradient(165deg,#0f172a_0%,#1e293b_52%,#0f172a_100%)] px-3 pb-6 pt-5 text-slate-100 sm:px-5 sm:pb-7 sm:pt-5 lg:border-r lg:border-white/10">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-10 top-0 h-36 w-36 rounded-full bg-amber-400/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 top-8 h-32 w-32 rounded-full bg-sky-300/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-r from-[#64748b] via-[#fbbf24] to-[#c2410c] opacity-80"
      />

      <div className="relative mb-4 flex items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-amber-200/70">
            Metallic podium
          </p>
          <p className="font-display text-lg leading-tight text-white">Top 3</p>
        </div>
        <p className="max-w-[10rem] text-right text-[11px] text-slate-400">{hint}</p>
      </div>

      <div className="relative grid grid-cols-3 items-end gap-2 sm:gap-4">
        {ordered.map((row) => (
          <PodiumCard key={row.rank} row={row} columns={columns} scoreSuffix={scoreSuffix} />
        ))}
      </div>
    </section>
  );
}

function PodiumCard({
  row,
  columns,
  scoreSuffix,
}: {
  row: BoardStageRow;
  columns: BoardColumns;
  scoreSuffix: string;
}) {
  const place = Math.min(row.rank, 3) as 1 | 2 | 3;
  const metal = {
    1: {
      order: "order-2",
      pedestal: "from-[#fbbf24] via-[#d97706] to-[#92400e]",
      pedestalHeight: "h-[5.25rem] sm:h-24",
      rim: "from-[#fef3c7] via-white/80 to-[#b45309]",
      glow: "shadow-[0_10px_28px_rgba(251,191,36,0.28)]",
      label: "Gold",
    },
    2: {
      order: "order-1",
      pedestal: "from-[#e2e8f0] via-[#94a3b8] to-[#475569]",
      pedestalHeight: "h-16 sm:h-[4.5rem]",
      rim: "from-[#f8fafc] via-white/70 to-[#64748b]",
      glow: "shadow-[0_8px_22px_rgba(148,163,184,0.22)]",
      label: "Silver",
    },
    3: {
      order: "order-3",
      pedestal: "from-[#fdba74] via-[#ea580c] to-[#9a3412]",
      pedestalHeight: "h-14 sm:h-16",
      rim: "from-[#ffedd5] via-white/60 to-[#c2410c]",
      glow: "shadow-[0_8px_22px_rgba(234,88,12,0.22)]",
      label: "Bronze",
    },
  }[place];

  const stats = [
    columns !== "play" ? formatAttemptCount(row.attempts ?? 0) : null,
    formatDuration(row.durationSeconds),
    columns === "exam-all" ? `${row.exams ?? 0} exams` : null,
  ].filter(Boolean);

  return (
    <div
      className={cn(
        "animate-medal-pop flex min-w-0 flex-col items-center text-center",
        metal.order,
        row.isMe && "rounded-t-xl ring-1 ring-amber-300/35",
      )}
    >
      <PodiumMedal place={place} size={place === 1 ? 72 : 58} className="shrink-0" />

      <p className="mt-1.5 max-w-full truncate px-1 text-xs font-semibold text-white sm:text-sm">
        {row.name}
        {row.isMe ? (
          <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
            You
          </span>
        ) : null}
      </p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">{metal.label}</p>

      <div className={cn("mt-2 w-full max-w-[11rem]", metal.glow)}>
        <div
          className={cn(
            "relative flex flex-col items-center justify-end overflow-hidden rounded-t-md bg-gradient-to-b px-1.5 pb-2.5 pt-3",
            metal.pedestal,
            metal.pedestalHeight,
          )}
        >
          <div
            className={cn("absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r opacity-90", metal.rim)}
          />
          <div className="badge-shimmer-sweep pointer-events-none absolute inset-0 opacity-35">
            <div className="absolute -left-8 top-0 h-full w-10 bg-gradient-to-r from-transparent via-white/50 to-transparent" />
          </div>
          <p className="relative font-display text-lg leading-none text-white sm:text-2xl">
            {row.score}
            <span className="text-sm">{scoreSuffix}</span>
          </p>
          <p className="relative mt-1 line-clamp-2 text-[10px] leading-tight text-white/80">
            {stats.join(" · ")}
          </p>
        </div>
      </div>
    </div>
  );
}

function RankTable({
  rows,
  columns,
  scoreSuffix,
}: {
  rows: BoardStageRow[];
  columns: BoardColumns;
  scoreSuffix: string;
}) {
  const grid =
    columns === "exam-single"
      ? "sm:grid-cols-[3.25rem_minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_4.5rem]"
      : columns === "exam-all"
        ? "sm:grid-cols-[3.25rem_minmax(0,1.4fr)_repeat(3,minmax(0,0.7fr))_4.5rem]"
        : "sm:grid-cols-[3.25rem_minmax(0,1.6fr)_minmax(0,0.9fr)_4.5rem]";

  return (
    <section className="board-stage-table min-h-full overflow-hidden bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div>
          <p className="text-hairline text-muted-foreground">Full field</p>
          <p className="font-display text-base">All ranks</p>
        </div>
        <p className="text-xs tabular-nums text-muted-foreground">{rows.length} listed</p>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">No rankings yet.</p>
      ) : (
        <>
          <div
            className={cn(
              "hidden border-b border-border px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid sm:gap-3 sm:px-5",
              grid,
            )}
          >
            <span>#</span>
            <span>Participant</span>
            {columns === "exam-single" ? (
              <>
                <span>Attempts</span>
                <span>Time</span>
              </>
            ) : columns === "exam-all" ? (
              <>
                <span>Assessments</span>
                <span>Attempts</span>
                <span>Avg time</span>
              </>
            ) : (
              <span>Time</span>
            )}
            <span className="text-right">Score</span>
          </div>
          <ul className="max-h-[36rem] divide-y divide-border overflow-auto">
            {rows.map((row, index) => (
              <FieldRow
                key={`${row.rank}-${row.name}`}
                row={row}
                columns={columns}
                scoreSuffix={scoreSuffix}
                delayMs={40 + index * 22}
                grid={grid}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function FieldRow({
  row,
  columns,
  scoreSuffix,
  delayMs,
  grid,
}: {
  row: BoardStageRow;
  columns: BoardColumns;
  scoreSuffix: string;
  delayMs: number;
  grid: string;
}) {
  const place = row.rank <= 3 ? (row.rank as 1 | 2 | 3) : null;
  const highlight =
    row.rank === 1
      ? "bg-amber-500/10 sm:border-l-2 sm:border-l-amber-400"
      : row.rank === 2
        ? "bg-slate-400/10 sm:border-l-2 sm:border-l-slate-400"
        : row.rank === 3
          ? "bg-orange-500/10 sm:border-l-2 sm:border-l-orange-500"
          : null;

  return (
    <li
      className={cn(
        "animate-brand-rise grid gap-2 px-4 py-3 sm:items-center sm:gap-3 sm:px-5 sm:py-3.5",
        grid,
        highlight,
        row.isMe && row.rank > 3 && "bg-accent/10",
      )}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <span className="flex items-center gap-1.5 font-display text-xl tabular-nums text-muted-foreground">
        {place ? <PodiumMedal place={place} size={28} className="shrink-0" /> : null}#{row.rank}
      </span>

      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            place ? "bg-background/80" : "bg-secondary",
          )}
        >
          {initials(row.name === "You" ? "You" : row.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {row.name}
            {row.isMe ? (
              <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-accent">
                You
              </span>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground sm:hidden">
            {columns !== "play" ? `${formatAttemptCount(row.attempts ?? 0)} · ` : ""}
            {formatDuration(row.durationSeconds)}
            {columns === "exam-all" ? ` · ${row.exams ?? 0} assessments` : ""}
          </p>
        </div>
      </div>

      {columns === "exam-all" ? (
        <p className="hidden text-sm tabular-nums text-muted-foreground sm:block">
          {row.exams ?? 0}
        </p>
      ) : null}

      {columns !== "play" ? (
        <p className="hidden text-sm tabular-nums text-muted-foreground sm:block">
          {row.attempts ?? 0}
        </p>
      ) : null}

      <p className="hidden text-sm tabular-nums text-muted-foreground sm:block">
        {formatDuration(row.durationSeconds)}
      </p>

      <p className="font-display text-xl tabular-nums sm:text-right sm:text-2xl">
        {row.score}
        {scoreSuffix}
      </p>
    </li>
  );
}

export function LeaderboardHero({
  kicker = "Leaderboard",
  title,
  subtitle,
  chips,
  tabs,
}: {
  kicker?: string;
  title: string;
  subtitle: string;
  chips?: ReactNode;
  tabs?: ReactNode;
}) {
  return (
    <header className="relative overflow-hidden rounded-[var(--radius-lg)] border border-border bg-primary text-primary-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 top-0 h-40 w-40 rounded-full bg-accent/30 blur-3xl animate-brand-glow"
      />
      <div className="relative z-10 flex flex-wrap items-end justify-between gap-4 p-5 md:p-6">
        <div className="animate-brand-rise min-w-0">
          <p className="text-hairline text-primary-foreground/65">{kicker}</p>
          <h1 className="mt-1 font-display text-3xl leading-none tracking-tight md:text-4xl">
            {title}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-primary-foreground/75">{subtitle}</p>
        </div>
        {chips ? (
          <div className="animate-brand-rise-delayed flex flex-wrap gap-2">{chips}</div>
        ) : null}
      </div>
      {tabs ? (
        <div className="relative z-10 border-t border-primary-foreground/10 px-5 py-3 md:px-6">
          {tabs}
        </div>
      ) : null}
    </header>
  );
}

export function LeaderboardChip({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-primary-foreground/15 bg-primary-foreground/8 px-3 py-2 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-primary-foreground/70">
        {icon}
        <span className="text-hairline">{label}</span>
      </div>
      <p className="mt-0.5 font-display text-xl leading-none">{value}</p>
    </div>
  );
}
