import type { ArenaBoardRow, ArenaSegmentWinner } from "@/lib/play.arena";
import { cn } from "@/lib/utils";
import { Crown, Medal, Trophy, Users } from "lucide-react";

export function ArenaScoreboard({
  rows,
  highlightId,
  currentSegmentWinner,
  segmentWinners,
  champion,
  visible = true,
  showSegmentColumn = true,
  emptyHint = "Teams appear here as they join.",
}: {
  rows: ArenaBoardRow[];
  highlightId?: string | null;
  currentSegmentWinner?: ArenaSegmentWinner | null;
  segmentWinners?: ArenaSegmentWinner[];
  champion?: { id: string; name: string; score: number } | null;
  visible?: boolean;
  showSegmentColumn?: boolean;
  emptyHint?: string;
}) {
  if (!visible) {
    return (
      <section className="surface-metal overflow-hidden rounded-2xl p-5">
        <p className="text-sm font-semibold">Scoreboard</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Rankings and the overall board appear after the host reveals the key.
        </p>
        {segmentWinners && segmentWinners.length > 0 ? (
          <ol className="mt-3 flex flex-wrap gap-2">
            {segmentWinners.map((row) => (
              <li key={row.segment} className="rounded-full bg-secondary px-3 py-1 text-xs">
                S{row.segment + 1} · {row.name}
              </li>
            ))}
          </ol>
        ) : null}
      </section>
    );
  }

  return (
    <section className="surface-metal overflow-hidden rounded-2xl">
      {champion ? (
        <div className="border-b border-border/60 bg-gradient-to-br from-amber-500/18 via-transparent to-transparent px-5 py-6 text-center">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
            <Crown className="h-3.5 w-3.5" />
            Overall winner
          </p>
          <p className="mt-2 font-display text-3xl">{champion.name}</p>
          <p className="mt-1 text-sm tabular-nums text-muted-foreground">{champion.score} pts</p>
        </div>
      ) : currentSegmentWinner ? (
        <div className="border-b border-border/60 bg-gradient-to-r from-amber-500/15 to-transparent px-5 py-4">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
            <Trophy className="h-3.5 w-3.5" />
            Segment {currentSegmentWinner.segment + 1} winner
          </p>
          <p className="mt-1 text-xl font-semibold">{currentSegmentWinner.name}</p>
          <p className="text-xs tabular-nums text-muted-foreground">
            {currentSegmentWinner.score} pts this segment
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Trophy className="h-4 w-4 text-amber-500" />
            Live scoreboard
          </h2>
        </div>
      )}

      {segmentWinners && segmentWinners.length > 0 ? (
        <ol className="flex flex-wrap gap-2 border-b border-border/60 px-5 py-3">
          {segmentWinners.map((row) => (
            <li
              key={row.segment}
              className={cn(
                "rounded-full px-3 py-1 text-xs",
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
        <p className="px-5 py-6 text-sm text-muted-foreground">{emptyHint}</p>
      ) : (
        <ol className="divide-y divide-border/70">
          {rows.map((row) => {
            const mine = highlightId === row.id;
            return (
              <li
                key={row.id}
                className={cn(
                  "flex items-center gap-3 px-5 py-3",
                  mine && "bg-primary/8",
                  row.rank === 1 && "bg-amber-500/8",
                )}
              >
                <RankMark rank={row.rank} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {row.name}
                    {mine ? (
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        You
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {row.members}
                    </span>
                    <span>
                      {row.correctCount} correct
                      {row.wrongCount ? ` · ${row.wrongCount} wrong` : ""}
                    </span>
                  </p>
                </div>
                {showSegmentColumn ? (
                  <p className="hidden text-right text-xs tabular-nums text-muted-foreground sm:block">
                    Seg {row.segmentScore}
                  </p>
                ) : null}
                <p className="w-14 text-right text-lg font-semibold tabular-nums">{row.score}</p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function RankMark({ rank }: { rank: number }) {
  if (rank <= 3) {
    const tone = rank === 1 ? "text-amber-500" : rank === 2 ? "text-slate-400" : "text-amber-800";
    return (
      <span
        className={cn("flex h-9 w-9 items-center justify-center rounded-full bg-secondary", tone)}
      >
        <Medal className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs tabular-nums text-muted-foreground">
      {rank}
    </span>
  );
}
