import { PageLoader } from "@/components/platform";
import { beginKnockoutMatch, enterTournament, getTournamentDetail } from "@/lib/play.functions";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Trophy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/play/tournament/$tournamentId")({
  head: () => ({ meta: [{ title: "Knockout — Assessa" }] }),
  component: TournamentPage,
});

function TournamentPage() {
  const { tournamentId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchT = useServerFn(getTournamentDetail);
  const join = useServerFn(enterTournament);
  const play = useServerFn(beginKnockoutMatch);
  const { data, isPending } = useQuery({
    queryKey: ["tournament", tournamentId],
    queryFn: () => fetchT({ data: { tournamentId } }),
    refetchInterval: (query) => (query.state.data?.tournament.status === "active" ? 5000 : false),
  });
  const joinMut = useMutation({
    mutationFn: () => join({ data: { tournamentId } }),
    onSuccess: (result) => {
      toast.success(
        result.alreadyJoined ? "You’re already in this bracket" : "You’re in the bracket",
      );
      void queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not join"),
  });
  const playMut = useMutation({
    mutationFn: (matchId: string) => play({ data: { matchId } }),
    onSuccess: (result) =>
      navigate({ to: "/play/session/$sessionId", params: { sessionId: result.sessionId } }),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Match unavailable"),
  });

  if (isPending || !data) return <PageLoader label="Loading bracket…" />;
  const { tournament, matches, entrants, joined } = data;
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  const myOpen = matches.filter((m) => m.canPlay);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/play/knockout" className="text-xs text-accent underline">
        Knockout
      </Link>

      <header className="space-y-2">
        <h1 className="font-display text-3xl">{tournament.name}</h1>
        <p className="text-sm text-muted-foreground">
          {tournament.size}-player bracket · {statusLabel(tournament.status)} · {entrants.length}{" "}
          entered
        </p>
      </header>

      {tournament.status === "open" ? (
        <section
          className="rounded-2xl border border-border bg-card p-4"
          aria-labelledby="join-heading"
        >
          <h2 id="join-heading" className="text-sm font-semibold">
            Entry
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {joined
              ? "You’re already entered. Each player can only appear once in this bracket."
              : entrants.length >= tournament.size
                ? "This bracket is full."
                : "Opt in once. Duplicate entries are blocked."}
          </p>
          {joined ? (
            <p
              className="mt-3 inline-flex rounded-md bg-teal-500/15 px-3 py-1.5 text-xs font-semibold text-teal-800 dark:text-teal-200"
              role="status"
            >
              Joined
            </p>
          ) : entrants.length < tournament.size ? (
            <button
              type="button"
              onClick={() => joinMut.mutate()}
              disabled={joinMut.isPending}
              className="mt-3 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {joinMut.isPending ? "Joining…" : "Enter bracket"}
            </button>
          ) : null}
        </section>
      ) : null}

      {myOpen.length > 0 ? (
        <section
          className="rounded-2xl border border-primary/30 bg-primary/5 p-4"
          aria-labelledby="your-matches"
        >
          <h2 id="your-matches" className="text-sm font-semibold">
            Your matches
          </h2>
          <ul className="mt-3 space-y-2">
            {myOpen.map((match) => (
              <li
                key={match.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium">
                    Round {match.round + 1} · {formatVs(match.playerA, match.playerB)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatEmails(match.playerA, match.playerB)}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
                  disabled={playMut.isPending || !match.matchId}
                  onClick={() => match.matchId && playMut.mutate(match.matchId)}
                >
                  Play 1v1
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="entrants-heading">
        <h2 id="entrants-heading" className="text-sm font-semibold">
          Entrants
        </h2>
        {entrants.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No one has joined yet.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Tournament entrants">
            {entrants.map((e) => (
              <li
                key={e.userId}
                className="rounded-xl border border-border bg-card px-3 py-2 text-sm"
              >
                <p className="font-medium">{e.name}</p>
                {e.email ? <p className="text-xs text-muted-foreground">{e.email}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="bracket-heading" className="space-y-4">
        <h2 id="bracket-heading" className="text-sm font-semibold">
          Bracket
        </h2>
        {rounds.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Bracket slots appear after an admin starts the tournament.
          </p>
        ) : (
          rounds.map((round) => (
            <div key={round}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {roundTitle(round, rounds.length)}
              </h3>
              <ul className="grid gap-3 md:grid-cols-2">
                {matches
                  .filter((m) => m.round === round)
                  .map((match) => (
                    <li key={match.id}>
                      <MatchCard
                        match={match}
                        playing={playMut.isPending}
                        onPlay={(id) => playMut.mutate(id)}
                      />
                    </li>
                  ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

type MatchView = {
  id: string;
  round: number;
  slot: number;
  matchId: string | null;
  playerA: { id: string; name: string; email: string | null } | null;
  playerB: { id: string; name: string; email: string | null } | null;
  winner: { id: string; name: string; email: string | null } | null;
  status: "complete" | "playable" | "pending" | "empty";
  isMine: boolean;
  canPlay: boolean;
};

function MatchCard({
  match,
  playing,
  onPlay,
}: {
  match: MatchView;
  playing: boolean;
  onPlay: (matchId: string) => void;
}) {
  const complete = match.status === "complete";
  return (
    <article
      className={cn(
        "rounded-2xl border p-4 text-sm",
        match.isMine ? "border-primary/40 bg-primary/5" : "border-border bg-card",
      )}
      aria-label={`Round ${match.round + 1}, match ${match.slot + 1}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground">Match {match.slot + 1}</p>
        <StatusBadge status={match.status} />
      </div>

      <div className="mt-3 space-y-2">
        <PlayerRow player={match.playerA} winnerId={match.winner?.id} side="A" />
        <p className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          vs
        </p>
        <PlayerRow player={match.playerB} winnerId={match.winner?.id} side="B" />
      </div>

      {complete && match.winner ? (
        <p
          className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-900 dark:text-amber-100"
          role="status"
        >
          <Trophy className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Winner: {match.winner.name}
          {match.winner.email ? ` · ${match.winner.email}` : ""}
        </p>
      ) : null}

      {match.canPlay && match.matchId ? (
        <button
          type="button"
          className="mt-3 w-full rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
          disabled={playing}
          onClick={() => onPlay(match.matchId!)}
        >
          Play this match
        </button>
      ) : null}
    </article>
  );
}

function PlayerRow({
  player,
  winnerId,
  side,
}: {
  player: { id: string; name: string; email: string | null } | null;
  winnerId?: string;
  side: "A" | "B";
}) {
  const isWinner = Boolean(player && winnerId && player.id === winnerId);
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2",
        isWinner ? "border-amber-400/60 bg-amber-500/10" : "border-border/70 bg-secondary/20",
      )}
    >
      <p className="font-medium">
        <span className="sr-only">Player {side}: </span>
        {player?.name ?? "TBD"}
        {isWinner ? (
          <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Winner
          </span>
        ) : null}
      </p>
      {player?.email ? <p className="text-[11px] text-muted-foreground">{player.email}</p> : null}
    </div>
  );
}

function StatusBadge({ status }: { status: MatchView["status"] }) {
  const label =
    status === "complete"
      ? "Complete"
      : status === "playable"
        ? "Ready to play"
        : status === "pending"
          ? "Waiting"
          : "Empty";
  return (
    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
  );
}

function statusLabel(status: string) {
  if (status === "open") return "Open for entry";
  if (status === "active") return "In progress";
  if (status === "complete") return "Complete";
  return status;
}

function roundTitle(round: number, totalRounds: number) {
  if (round === totalRounds - 1) return "Final";
  if (round === totalRounds - 2) return "Semi-finals";
  return `Round ${round + 1}`;
}

function formatVs(a: { name: string } | null, b: { name: string } | null) {
  return `${a?.name ?? "TBD"} vs ${b?.name ?? "TBD"}`;
}

function formatEmails(a: { email: string | null } | null, b: { email: string | null } | null) {
  const parts = [a?.email, b?.email].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Names shown when players are seeded";
}
