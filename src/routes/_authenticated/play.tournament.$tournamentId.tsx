import { PageLoader } from "@/components/platform";
import { beginKnockoutMatch, enterTournament, getTournamentDetail } from "@/lib/play.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
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
  });
  const joinMut = useMutation({
    mutationFn: () => join({ data: { tournamentId } }),
    onSuccess: () => {
      toast.success("You’re in");
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

  if (isPending || !data) return <PageLoader />;
  const { tournament, matches, entrants } = data;

  return (
    <div className="space-y-5">
      <Link to="/play" className="text-xs text-accent underline">
        Play
      </Link>
      <h1 className="font-display text-2xl">{tournament.name}</h1>
      <p className="text-sm text-muted-foreground">
        {tournament.size} players · {tournament.status} · {entrants.length} entered
      </p>
      {tournament.status === "open" ? (
        <button
          type="button"
          onClick={() => joinMut.mutate()}
          className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
        >
          Enter bracket
        </button>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {matches.map((match) => (
          <div key={match.id} className="rounded-md border border-border p-3 text-sm">
            <p className="text-xs text-muted-foreground">
              Round {match.round + 1} · slot {match.slot + 1}
            </p>
            <p className="mt-1">
              {(match.player_a ?? "TBD").slice(0, 8)} vs {(match.player_b ?? "TBD").slice(0, 8)}
            </p>
            {match.match_id && !match.winner_id ? (
              <button
                type="button"
                className="mt-2 text-xs text-accent"
                onClick={() => playMut.mutate(match.match_id!)}
              >
                Play match
              </button>
            ) : match.winner_id ? (
              <p className="mt-1 text-xs text-muted-foreground">Winner set</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
