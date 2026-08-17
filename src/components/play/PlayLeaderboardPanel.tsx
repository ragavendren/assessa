import { formatDuration } from "@/lib/gamification";
import type { PlayKind } from "@/lib/play.math";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Medal, Trophy } from "lucide-react";
import { getPlayBoard } from "@/lib/play.functions";

type BoardRow = {
  rank: number;
  name: string;
  score: number;
  durationSeconds?: number;
};

export function PlayLeaderboardPanel({
  kind,
  courseId,
  courseName,
  topic,
  compact,
  limit = 5,
}: {
  kind: PlayKind;
  courseId: string;
  courseName: string;
  topic?: string | null;
  compact?: boolean;
  limit?: number;
}) {
  const fetchBoard = useServerFn(getPlayBoard);
  const { data, isPending } = useQuery({
    queryKey: ["play-board", kind, courseId, topic ?? ""],
    queryFn: () =>
      fetchBoard({
        data: {
          kind,
          courseId,
          ...(topic ? { topic } : {}),
        },
      }),
  });

  const rows = (data?.rows ?? []) as BoardRow[];

  if (isPending) {
    return (
      <div className={cn("animate-pulse rounded-lg bg-secondary/60", compact ? "h-24" : "h-32")} />
    );
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">No scores yet — be the first on this board.</p>
        <Link
          to="/play/leaderboard"
          search={{ courseId, kind, ...(topic ? { topic } : {}) }}
          className="inline-flex items-center gap-1 text-xs text-accent underline"
        >
          <Trophy className="h-3 w-3" />
          Open {courseName} board
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ol className="space-y-1">
        {rows.slice(0, limit).map((row) => (
          <li
            key={row.rank}
            className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-secondary/50"
          >
            <span className="flex min-w-0 items-center gap-2">
              <RankBadge rank={row.rank} />
              <span className="truncate">{row.name}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {row.score}
              {row.durationSeconds ? (
                <span className="ml-1 hidden sm:inline">
                  · {formatDuration(row.durationSeconds)}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
      {!compact ? (
        <Link
          to="/play/leaderboard"
          search={{ courseId, kind, ...(topic ? { topic } : {}) }}
          className="inline-flex items-center gap-1 text-xs font-medium text-accent underline"
        >
          <Trophy className="h-3 w-3" />
          Full {courseName} board
        </Link>
      ) : null}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    const tone = rank === 1 ? "text-amber-500" : rank === 2 ? "text-slate-400" : "text-amber-700";
    return (
      <span className={cn("inline-flex w-5 justify-center", tone)}>
        <Medal className="h-3.5 w-3.5" />
      </span>
    );
  }
  return <span className="w-5 text-center text-xs tabular-nums text-muted-foreground">{rank}</span>;
}
