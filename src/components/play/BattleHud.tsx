import { cn } from "@/lib/utils";
import { Swords, Trophy } from "lucide-react";

export type BattleLivePlayer = {
  name: string;
  email?: string | null;
  ready: boolean;
  playStatus: "waiting" | "playing" | "done";
  answered: number;
  currentIndex: number;
  total: number;
  score: number | null;
  correctCount: number | null;
  isMe: boolean;
  userId?: string | null;
};

export function BattleHud({
  me,
  opponent,
  waitingForOpponent,
  winnerId,
  winnerName,
  myUserId,
  title = "Battle",
}: {
  me: BattleLivePlayer;
  opponent: BattleLivePlayer;
  waitingForOpponent?: boolean;
  winnerId?: string | null;
  winnerName?: string | null;
  myUserId?: string | null;
  title?: string;
}) {
  const iWon = Boolean(winnerId && myUserId && winnerId === myUserId);
  const opponentWon = Boolean(winnerId && !iWon);
  const resolvedWinner = winnerName ?? (iWon ? me.name : opponentWon ? opponent.name : null);

  return (
    <section
      className="surface-metal overflow-hidden rounded-2xl"
      aria-label={`${title} scoreboard`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold">
          <Swords className="h-4 w-4 text-primary" aria-hidden />
          {title}
        </p>
        {waitingForOpponent ? (
          <p className="text-xs text-amber-700 dark:text-amber-300" role="status">
            Waiting for opponent to start…
          </p>
        ) : null}
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <BattlePlayerCard player={me} highlight={iWon} isWinner={iWon} />
        <BattlePlayerCard player={opponent} highlight={opponentWon} isWinner={opponentWon} />
      </div>
      {winnerId && resolvedWinner ? (
        <p
          className="border-t border-border/60 px-4 py-2 text-center text-xs text-muted-foreground"
          role="status"
        >
          <Trophy className="mr-1 inline h-3.5 w-3.5 text-amber-500" aria-hidden />
          Winner: <span className="font-semibold text-foreground">{resolvedWinner}</span>
          {" · "}
          {me.name} vs {opponent.name}
        </p>
      ) : null}
    </section>
  );
}

function BattlePlayerCard({
  player,
  highlight,
  isWinner,
}: {
  player: BattleLivePlayer;
  highlight?: boolean;
  isWinner?: boolean;
}) {
  const progress = Math.min(
    100,
    Math.round(((player.answered || player.currentIndex) / Math.max(1, player.total)) * 100),
  );
  const statusLabel =
    player.playStatus === "done"
      ? "Finished"
      : player.playStatus === "playing"
        ? "Playing"
        : player.ready
          ? "Ready"
          : "Waiting";

  return (
    <article
      className={cn(
        "rounded-xl border p-3",
        player.isMe ? "border-primary/40 bg-primary/5" : "border-border bg-card",
        highlight && "ring-1 ring-amber-400/50",
      )}
      aria-label={`${player.name}${player.isMe ? " (you)" : ""}${isWinner ? ", winner" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">
            {player.name}
            {player.isMe ? (
              <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                You
              </span>
            ) : null}
            {isWinner ? (
              <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Winner
              </span>
            ) : null}
          </p>
          {player.email ? (
            <p className="truncate text-[11px] text-muted-foreground">{player.email}</p>
          ) : null}
          <p className="mt-0.5 text-[11px] text-muted-foreground">{statusLabel}</p>
        </div>
        <p
          className="text-lg font-semibold tabular-nums"
          aria-label={`Score ${player.score ?? "pending"}`}
        >
          {player.score != null ? player.score : "—"}
        </p>
      </div>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Questions answered"
      >
        <div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-2 text-[11px] tabular-nums text-muted-foreground">
        {player.answered || player.currentIndex}/{player.total} answered
        {player.correctCount != null ? ` · ${player.correctCount} correct` : ""}
      </p>
    </article>
  );
}
