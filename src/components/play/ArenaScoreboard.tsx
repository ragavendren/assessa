import type { ArenaBoardRow, ArenaSegmentWinner } from "@/lib/play.arena";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  Crown,
  Heart,
  Medal,
  Minus,
  PanelLeftClose,
  PanelTopOpen,
  Timer,
  Trophy,
  ArrowDown,
  ArrowUp,
  Users,
  Zap,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState, type CSSProperties } from "react";

export function ArenaQuestionTimer({
  remaining,
  status,
}: {
  remaining: number | null;
  status: string;
}) {
  if (status === "locked") {
    return (
      <p className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium">
        <Timer className="h-4 w-4" />
        Answers locked
      </p>
    );
  }
  if (status !== "question" || remaining == null) return null;
  return (
    <p className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1.5 text-sm font-medium text-amber-800 dark:text-amber-200">
      <Timer className="h-4 w-4" />
      {remaining}s remaining
    </p>
  );
}

/** Heartbeat countdown next to the question — color shifts as time drains, then bursts. */
export function ArenaHeartbeatTimer({
  remainingMs,
  durationSeconds,
  status,
}: {
  remainingMs: number | null;
  durationSeconds: number;
  status: string;
}) {
  const [burst, setBurst] = useState(false);
  const durationMs = Math.max(1, durationSeconds) * 1000;
  const ratio =
    remainingMs == null || status !== "question"
      ? 1
      : Math.max(0, Math.min(1, remainingMs / durationMs));
  const seconds = remainingMs == null ? null : Math.max(0, Math.ceil(remainingMs / 1000));

  useEffect(() => {
    if (status === "question" && remainingMs != null && remainingMs <= 0) {
      setBurst(true);
      return;
    }
    if (status === "question" && remainingMs != null && remainingMs > 0) {
      setBurst(false);
    }
  }, [remainingMs, status]);

  useEffect(() => {
    if (status === "locked" || status === "revealed") setBurst(true);
  }, [status]);

  const tone = useMemo(() => {
    if (ratio >= 0.75) {
      return {
        label: "Plenty of time",
        heart: "text-emerald-500",
        ring: "stroke-emerald-500",
        chip: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
      };
    }
    if (ratio >= 0.5) {
      return {
        label: "Keep going",
        heart: "text-yellow-500",
        ring: "stroke-yellow-500",
        chip: "bg-yellow-500/15 text-yellow-900 dark:text-yellow-200",
      };
    }
    if (ratio >= 0.25) {
      return {
        label: "Halfway",
        heart: "text-orange-500",
        ring: "stroke-orange-500",
        chip: "bg-orange-500/15 text-orange-900 dark:text-orange-200",
      };
    }
    if (ratio >= 0.1) {
      return {
        label: "Hurry",
        heart: "text-rose-500",
        ring: "stroke-rose-500",
        chip: "bg-rose-500/15 text-rose-900 dark:text-rose-200",
      };
    }
    return {
      label: "Final seconds",
      heart: "text-red-600",
      ring: "stroke-red-600",
      chip: "bg-red-600/15 text-red-800 dark:text-red-200",
    };
  }, [ratio]);

  const beatMs =
    ratio >= 0.75 ? 1100 : ratio >= 0.5 ? 850 : ratio >= 0.25 ? 620 : ratio >= 0.1 ? 420 : 280;

  if (status === "locked" && !burst) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium">
        <Timer className="h-4 w-4" />
        Locked
      </div>
    );
  }

  if (status !== "question" && !burst) return null;
  if (status === "question" && remainingMs == null) return null;

  const circumference = 2 * Math.PI * 18;
  const dash = circumference * ratio;

  return (
    <div className={cn("relative inline-flex items-center gap-3 rounded-2xl px-3 py-2", tone.chip)}>
      <div className="relative flex h-14 w-14 items-center justify-center">
        <svg className="absolute inset-0 h-14 w-14 -rotate-90" viewBox="0 0 44 44" aria-hidden>
          <circle
            cx="22"
            cy="22"
            r="18"
            fill="none"
            className="stroke-current opacity-20"
            strokeWidth="3"
          />
          <circle
            cx="22"
            cy="22"
            r="18"
            fill="none"
            className={cn(tone.ring, "transition-[stroke-dashoffset] duration-200")}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - dash}
          />
        </svg>
        <span
          className={cn(
            "relative z-10 inline-flex",
            tone.heart,
            burst ? "arena-heart-burst" : "arena-heart-beat",
          )}
          style={burst ? undefined : { animationDuration: `${beatMs}ms` }}
        >
          <Heart className="h-7 w-7 fill-current" />
        </span>
        {burst
          ? [
              ["-28px", "-22px"],
              ["24px", "-26px"],
              ["30px", "8px"],
              ["-26px", "18px"],
              ["8px", "28px"],
              ["-8px", "-30px"],
            ].map(([dx, dy], index) => (
              <span
                key={index}
                className={cn(
                  "arena-heart-burst-particle absolute h-2 w-2 rounded-full",
                  tone.heart.replace("text-", "bg-"),
                )}
                style={
                  {
                    "--dx": dx,
                    "--dy": dy,
                    animationDelay: `${index * 30}ms`,
                  } as CSSProperties
                }
              />
            ))
          : null}
      </div>
      <div className="min-w-[4.5rem]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-80">
          {burst && (seconds === 0 || status !== "question") ? "Time’s up" : tone.label}
        </p>
        <p className="text-2xl font-semibold tabular-nums leading-none">
          {seconds != null ? `${seconds}s` : "—"}
        </p>
      </div>
    </div>
  );
}

export function ArenaTeamScoreCard({
  name,
  score,
  correctCount,
  wrongCount,
  rank,
  lastResult,
}: {
  name: string;
  score: number;
  correctCount: number;
  wrongCount: number;
  rank?: number | null;
  lastResult?: {
    correct: boolean | null;
    marks: number;
    timeBonus?: number;
    earlyLockBonus?: number;
  } | null;
}) {
  return (
    <section className="surface-paper rounded-2xl p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Your score card
      </p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{name}</p>
          <p className="text-xs text-muted-foreground">
            {correctCount} correct
            {wrongCount ? ` · ${wrongCount} wrong` : ""}
            {rank ? ` · rank ${rank}` : ""}
          </p>
        </div>
        <p className="text-3xl font-semibold tabular-nums">{score}</p>
      </div>
      {lastResult ? (
        <p
          className={cn(
            "mt-3 text-sm",
            lastResult.correct ? "text-success" : "text-muted-foreground",
          )}
        >
          Last question: {lastResult.correct ? "correct" : "not correct"} · {lastResult.marks} marks
          {lastResult.timeBonus ? ` · +${lastResult.timeBonus} time` : ""}
          {lastResult.earlyLockBonus ? ` · +${lastResult.earlyLockBonus} first lock` : ""}
        </p>
      ) : null}
    </section>
  );
}

export type ArenaAnswerLedgerRow = {
  teamId: string;
  questionIndex: number;
  segment: number;
  correct: boolean | null;
  marks: number;
  timeBonus: number;
  earlyLockBonus: number;
  firstLockedAt: string | null;
  lockLatencyMs: number | null;
  /** Rank change after this question (positive = moved up). */
  rankDelta?: number | null;
};

function bonusTally(score: number, bonusPoints: number) {
  const safeBonus = Math.max(0, bonusPoints);
  const base = score - safeBonus;
  return { base, bonus: safeBonus };
}

function formatLockClock(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  } as Intl.DateTimeFormatOptions);
}

export function ArenaScoreboard({
  rows,
  highlightId,
  currentSegmentWinner,
  segmentWinners,
  champion,
  visible = true,
  showSegmentColumn = true,
  showDetailColumns = true,
  title,
  emptyHint = "Teams appear here as they join.",
  dense: _dense = false,
  undockMode,
  onUndock,
  onDock,
  answerLedger,
  ledgerSegment,
}: {
  rows: ArenaBoardRow[];
  highlightId?: string | null;
  currentSegmentWinner?: ArenaSegmentWinner | null;
  segmentWinners?: ArenaSegmentWinner[];
  champion?: { id: string; name: string; score: number } | null;
  visible?: boolean;
  showSegmentColumn?: boolean;
  showDetailColumns?: boolean;
  title?: string;
  emptyHint?: string;
  dense?: boolean;
  undockMode?: "undock" | "dock" | "hidden";
  onUndock?: () => void;
  onDock?: () => void;
  answerLedger?: ArenaAnswerLedgerRow[];
  /** When set, only show Q chips for this segment; omit for overall. */
  ledgerSegment?: number | null;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const ledgerByTeam = useMemo(() => {
    const map = new Map<string, ArenaAnswerLedgerRow[]>();
    for (const row of answerLedger ?? []) {
      if (ledgerSegment != null && row.segment !== ledgerSegment) continue;
      const list = map.get(row.teamId) ?? [];
      list.push(row);
      map.set(row.teamId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.questionIndex - b.questionIndex);
    }
    return map;
  }, [answerLedger, ledgerSegment]);

  useEffect(() => {
    setExpandedIds(new Set());
  }, [ledgerSegment]);

  const ledgerTeamIds = useMemo(
    () => rows.filter((row) => (ledgerByTeam.get(row.id)?.length ?? 0) > 0).map((row) => row.id),
    [rows, ledgerByTeam],
  );
  const allLedgersOpen =
    ledgerTeamIds.length > 0 && ledgerTeamIds.every((id) => expandedIds.has(id));

  function toggleLedger(teamId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }

  function toggleAllLedgers() {
    setExpandedIds((prev) => {
      if (ledgerTeamIds.length === 0) return prev;
      if (ledgerTeamIds.every((id) => prev.has(id))) return new Set();
      return new Set(ledgerTeamIds);
    });
  }

  if (!visible) {
    return (
      <section className="surface-metal overflow-hidden rounded-2xl p-5">
        <p className="text-sm font-semibold">Scoreboard</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Other teams’ scores stay hidden until the host publishes this segment, then the overall
          board at the end.
        </p>
      </section>
    );
  }

  const dockControls =
    undockMode === "undock" && onUndock ? (
      <button
        type="button"
        onClick={onUndock}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-secondary"
      >
        <PanelTopOpen className="h-3.5 w-3.5" />
        Undock
      </button>
    ) : undockMode === "dock" && onDock ? (
      <button
        type="button"
        onClick={onDock}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-secondary"
      >
        <PanelLeftClose className="h-3.5 w-3.5" />
        Dock
      </button>
    ) : null;

  const ledgerControls =
    ledgerTeamIds.length > 0 ? (
      <button
        type="button"
        onClick={toggleAllLedgers}
        className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-secondary"
      >
        {allLedgersOpen ? "Collapse all ledgers" : "Expand all ledgers"}
      </button>
    ) : null;

  const headerActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {ledgerControls}
      {dockControls}
    </div>
  );

  return (
    <section className="surface-metal overflow-hidden rounded-2xl">
      {champion ? (
        <div className="border-b border-border/60 bg-gradient-to-br from-amber-500/18 via-transparent to-transparent px-5 py-6 text-center">
          <div className="mb-2 flex justify-end">{headerActions}</div>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
            <Crown className="h-3.5 w-3.5" />
            Overall winner
          </p>
          <p className="mt-2 font-display text-3xl">{champion.name}</p>
          <p className="mt-1 text-sm tabular-nums text-muted-foreground">{champion.score} pts</p>
        </div>
      ) : currentSegmentWinner ? (
        <div className="border-b border-border/60 bg-gradient-to-r from-amber-500/15 to-transparent px-5 py-4">
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
              <Trophy className="h-3.5 w-3.5" />
              Segment {currentSegmentWinner.segment + 1} winner
            </p>
            {headerActions}
          </div>
          <p className="mt-1 text-xl font-semibold">{currentSegmentWinner.name}</p>
          <p className="text-xs tabular-nums text-muted-foreground">
            {currentSegmentWinner.score} pts this segment
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Trophy className="h-4 w-4 text-amber-500" />
            {title ?? "Live scoreboard"}
          </h2>
          {headerActions}
        </div>
      )}

      {segmentWinners && segmentWinners.length > 0 ? (
        <ol className="flex flex-wrap gap-2 border-b border-border/60 px-5 py-3">
          {segmentWinners.map((row) => (
            <li
              key={row.segment}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs",
                currentSegmentWinner?.segment === row.segment
                  ? "bg-amber-500/20 font-medium text-amber-800 dark:text-amber-200"
                  : "bg-secondary text-muted-foreground",
              )}
            >
              S{row.segment + 1} · {row.name}
            </li>
          ))}
        </ol>
      ) : null}

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">{emptyHint}</p>
      ) : (
        <div className="w-full overflow-x-hidden">
          <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-border/60">
                <th className="w-12 px-2 py-3 font-medium sm:w-14 sm:px-3">#</th>
                <th className="px-2 py-3 font-medium sm:px-3">Team</th>
                <th className="w-14 px-2 py-3 text-right font-medium sm:w-16 sm:px-3">Pts</th>
                {showDetailColumns ? (
                  <>
                    <th className="hidden w-12 px-2 py-3 text-right font-medium lg:table-cell">
                      ✓
                    </th>
                    <th className="hidden w-12 px-2 py-3 text-right font-medium lg:table-cell">
                      ✗
                    </th>
                    <th
                      className="hidden w-14 px-2 py-3 text-right font-medium lg:table-cell"
                      title="Speed / time remaining bonus"
                    >
                      Time
                    </th>
                    <th
                      className="hidden w-14 px-2 py-3 text-right font-medium lg:table-cell"
                      title="Exclusive earliest correct lock"
                    >
                      First
                    </th>
                    <th className="hidden w-14 px-2 py-3 text-right font-medium xl:table-cell">
                      Bonus
                    </th>
                  </>
                ) : null}
                {showSegmentColumn ? (
                  <th className="hidden w-12 px-2 py-3 text-right font-medium xl:table-cell">
                    Seg
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const mine = highlightId === row.id;
                const questions = ledgerByTeam.get(row.id) ?? [];
                const hasLedger = questions.length > 0;
                const expanded = expandedIds.has(row.id);
                const tally = bonusTally(row.score, row.bonusPoints);
                const colSpan = 3 + (showDetailColumns ? 5 : 0) + (showSegmentColumn ? 1 : 0);
                return (
                  <Fragment key={row.id}>
                    <tr
                      className={cn(
                        "border-b border-border/60 align-top",
                        mine && "bg-primary/8",
                        row.rank === 1 && "bg-amber-500/8",
                        expanded && "border-b-0",
                      )}
                    >
                      <td className="px-2 py-3 sm:px-3 sm:py-3.5">
                        <div className="flex items-center gap-1">
                          <RankMark rank={row.rank} tied={row.tied} />
                          <RankDeltaArrow delta={row.rankDelta ?? null} />
                        </div>
                      </td>
                      <td className="min-w-0 px-2 py-3 sm:px-3 sm:py-3.5">
                        <div className="flex items-start gap-1.5 sm:gap-2">
                          {hasLedger ? (
                            <button
                              type="button"
                              onClick={() => toggleLedger(row.id)}
                              aria-expanded={expanded}
                              aria-label={
                                expanded
                                  ? `Collapse question ledger for ${row.name}`
                                  : `Expand question ledger for ${row.name}`
                              }
                              className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary"
                            >
                              {expanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                          ) : (
                            <span className="mt-0.5 inline-flex h-7 w-7 shrink-0" aria-hidden />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                              {row.name}
                              {mine ? (
                                <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                  You
                                </span>
                              ) : null}
                            </p>
                            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {row.members}
                              </span>
                              {row.memberNames && row.memberNames.length > 0 ? (
                                <span
                                  className="min-w-0 max-w-full truncate"
                                  title={row.memberNames.join(", ")}
                                >
                                  {row.memberNames.join(" · ")}
                                </span>
                              ) : null}
                              {showDetailColumns ? (
                                <span className="inline-flex flex-wrap gap-x-2 lg:hidden">
                                  <span className="text-success">✓{row.correctCount}</span>
                                  <span>✗{row.wrongCount}</span>
                                  {row.timeBonus > 0 ? (
                                    <span className="text-sky-700 dark:text-sky-300">
                                      time +{row.timeBonus}
                                    </span>
                                  ) : null}
                                  {row.earlyLockBonus > 0 ? (
                                    <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-300">
                                      <Zap className="h-3 w-3" />+{row.earlyLockBonus}
                                    </span>
                                  ) : null}
                                </span>
                              ) : row.earlyLockBonus > 0 ? (
                                <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                                  <Zap className="h-3 w-3" />
                                  first lock +{row.earlyLockBonus}
                                </span>
                              ) : null}
                              {hasLedger ? (
                                <button
                                  type="button"
                                  onClick={() => toggleLedger(row.id)}
                                  className="text-[10px] font-semibold uppercase tracking-wide text-primary hover:underline"
                                >
                                  {expanded ? "Hide ledger" : "Show ledger"}
                                </button>
                              ) : null}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-right sm:px-3 sm:py-3.5">
                        <p className="text-base font-semibold tabular-nums sm:text-lg">
                          {row.score}
                        </p>
                        {showDetailColumns && tally.bonus > 0 ? (
                          <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                            {tally.base}+{tally.bonus}
                          </p>
                        ) : null}
                      </td>
                      {showDetailColumns ? (
                        <>
                          <td className="hidden px-2 py-3.5 text-right tabular-nums text-success lg:table-cell">
                            {row.correctCount}
                          </td>
                          <td className="hidden px-2 py-3.5 text-right tabular-nums text-muted-foreground lg:table-cell">
                            {row.wrongCount}
                          </td>
                          <td className="hidden px-2 py-3.5 text-right tabular-nums text-sky-700 dark:text-sky-300 lg:table-cell">
                            {row.timeBonus > 0 ? `+${row.timeBonus}` : "—"}
                          </td>
                          <td className="hidden px-2 py-3.5 text-right tabular-nums text-amber-700 dark:text-amber-300 lg:table-cell">
                            {row.earlyLockBonus > 0 ? `+${row.earlyLockBonus}` : "—"}
                          </td>
                          <td className="hidden px-2 py-3.5 text-right tabular-nums font-medium xl:table-cell">
                            {row.bonusPoints > 0 ? `+${row.bonusPoints}` : "—"}
                          </td>
                        </>
                      ) : null}
                      {showSegmentColumn ? (
                        <td className="hidden px-2 py-3.5 text-right tabular-nums text-muted-foreground xl:table-cell">
                          {row.segmentScore}
                        </td>
                      ) : null}
                    </tr>
                    {expanded && hasLedger ? (
                      <tr
                        className={cn(
                          "border-b border-border/60",
                          mine && "bg-primary/8",
                          row.rank === 1 && "bg-amber-500/8",
                        )}
                      >
                        <td colSpan={colSpan} className="px-2 pb-4 pt-0 sm:px-3">
                          <div className="rounded-xl border border-border/70 bg-secondary/25 px-3 py-3 sm:ml-9">
                            {row.memberNames && row.memberNames.length > 0 ? (
                              <p className="mb-2 break-words text-[11px] text-muted-foreground">
                                Members:{" "}
                                <span className="font-medium text-foreground">
                                  {row.memberNames.join(" · ")}
                                </span>
                              </p>
                            ) : null}
                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Question ledger
                              {ledgerSegment != null ? ` · S${ledgerSegment + 1}` : ""}
                            </p>
                            <ul className="flex flex-wrap gap-2">
                              {questions.map((q) => {
                                const qBonus = (q.timeBonus ?? 0) + (q.earlyLockBonus ?? 0);
                                const qBase = q.marks - qBonus;
                                return (
                                  <li
                                    key={`${row.id}-${q.questionIndex}`}
                                    title={`${formatLockClock(q.firstLockedAt)}${
                                      q.lockLatencyMs != null ? ` · ${q.lockLatencyMs} ms` : ""
                                    }`}
                                    className={cn(
                                      "min-w-0 flex-1 basis-[6.5rem] rounded-lg border px-2.5 py-2 text-[11px] tabular-nums sm:flex-none sm:basis-auto",
                                      q.correct === true
                                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                                        : q.correct === false
                                          ? "border-destructive/40 bg-destructive/10 text-destructive"
                                          : "border-border bg-card text-muted-foreground",
                                    )}
                                  >
                                    <p className="font-semibold">
                                      Q{q.questionIndex + 1}
                                      {q.correct === true
                                        ? " ✓"
                                        : q.correct === false
                                          ? " ✗"
                                          : " ·"}
                                      <RankDeltaArrow
                                        delta={q.rankDelta ?? null}
                                        className="ml-1 inline-flex"
                                        compact
                                      />
                                    </p>
                                    <p className="mt-1 opacity-90">
                                      {q.marks >= 0 ? `+${q.marks}` : q.marks}
                                      {qBonus > 0 ? (
                                        <span className="ml-1 opacity-70">
                                          ({qBase}+{qBonus})
                                        </span>
                                      ) : null}
                                    </p>
                                    {(q.timeBonus > 0 || q.earlyLockBonus > 0) && (
                                      <p className="mt-0.5 text-[10px] opacity-75">
                                        {q.timeBonus > 0 ? `time +${q.timeBonus}` : null}
                                        {q.timeBonus > 0 && q.earlyLockBonus > 0 ? " · " : null}
                                        {q.earlyLockBonus > 0 ? `first +${q.earlyLockBonus}` : null}
                                      </p>
                                    )}
                                    {q.firstLockedAt ? (
                                      <p className="mt-1 text-[10px] opacity-70">
                                        {formatLockClock(q.firstLockedAt)}
                                        {q.lockLatencyMs != null ? ` · ${q.lockLatencyMs} ms` : ""}
                                      </p>
                                    ) : null}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** @deprecated Prefer ArenaLiveLocks under the question. */
export function ArenaLockConsole({
  events,
  status,
}: {
  events: Array<{
    teamId: string;
    teamName: string;
    firstLockedAt: string | null;
    lockLatencyMs: number | null;
    submitted: boolean;
    correct?: boolean | null;
    marks?: number;
    timeBonus?: number;
    earlyLockBonus?: number;
  }>;
  status: string;
}) {
  return <ArenaLiveLocks events={events} status={status} />;
}

export function ArenaLiveLocks({
  events,
  status,
}: {
  events: Array<{
    teamId: string;
    teamName: string;
    firstLockedAt: string | null;
    lockLatencyMs: number | null;
    submitted: boolean;
    correct?: boolean | null;
    earlyLockBonus?: number;
  }>;
  status: string;
}) {
  if (status !== "question" && status !== "locked" && status !== "revealed") return null;
  return (
    <div className="mt-4 rounded-xl border border-border/70 bg-secondary/30 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Live responses
      </p>
      {events.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Waiting for the first team lock…</p>
      ) : (
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {events.map((event, index) => (
            <li
              key={event.teamId}
              className={cn(
                "rounded-lg border px-3 py-2.5 transition-colors",
                event.submitted
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : "border-border bg-card",
                event.earlyLockBonus ? "ring-1 ring-amber-400/50" : "",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold">
                  <span className="mr-1.5 tabular-nums text-muted-foreground">#{index + 1}</span>
                  {event.teamName}
                </p>
                {event.correct != null ? (
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase",
                      event.correct ? "text-success" : "text-destructive",
                    )}
                  >
                    {event.correct ? "Correct" : "Wrong"}
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-300">
                    Locked
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                {formatLockClock(event.firstLockedAt)}
                {event.lockLatencyMs != null ? ` · ${event.lockLatencyMs} ms` : ""}
                {event.earlyLockBonus ? " · first lock" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RankDeltaArrow({
  delta,
  className,
  compact = false,
}: {
  delta: number | null;
  className?: string;
  compact?: boolean;
}) {
  if (delta == null) return null;
  if (delta > 0) {
    return (
      <span
        title={`Moved up ${delta}`}
        className={cn(
          "arena-rank-up inline-flex items-center gap-0.5 font-semibold text-emerald-600 dark:text-emerald-300",
          compact ? "text-[10px]" : "text-[11px]",
          className,
        )}
      >
        <ArrowUp className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
        {!compact ? delta : null}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span
        title={`Moved down ${Math.abs(delta)}`}
        className={cn(
          "arena-rank-down inline-flex items-center gap-0.5 font-semibold text-rose-600 dark:text-rose-300",
          compact ? "text-[10px]" : "text-[11px]",
          className,
        )}
      >
        <ArrowDown className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
        {!compact ? Math.abs(delta) : null}
      </span>
    );
  }
  return (
    <span
      title="Same place"
      className={cn("arena-rank-same inline-flex items-center text-muted-foreground", className)}
    >
      <Minus className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
    </span>
  );
}

function RankMark({ rank, tied }: { rank: number; tied?: boolean }) {
  if (rank <= 3) {
    const tone =
      rank === 1
        ? "arena-medal-gold text-amber-500"
        : rank === 2
          ? "arena-medal-silver text-slate-400"
          : "arena-medal-bronze text-amber-800";
    return (
      <span
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-full bg-secondary",
          tone,
        )}
        title={tied ? `Tied for #${rank}` : `#${rank}`}
      >
        <Medal className="h-4 w-4" />
        {tied ? (
          <span className="absolute -bottom-1 rounded bg-background px-1 text-[8px] font-bold uppercase tracking-wide text-muted-foreground">
            tie
          </span>
        ) : null}
      </span>
    );
  }
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs tabular-nums text-muted-foreground">
      {rank}
    </span>
  );
}
