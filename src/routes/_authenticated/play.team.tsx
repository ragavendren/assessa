import { PageLoader } from "@/components/platform";
import { beginPlay, getPlayBoard } from "@/lib/play.functions";
import { isoWeekKey } from "@/lib/play.math";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/play/team")({
  head: () => ({ meta: [{ title: "Team Challenge — Assessa" }] }),
  component: TeamChallengePage,
});

function TeamChallengePage() {
  const navigate = useNavigate();
  const fetchBoard = useServerFn(getPlayBoard);
  const start = useServerFn(beginPlay);
  const { data, isPending } = useQuery({
    queryKey: ["play-board", "team"],
    queryFn: () => fetchBoard({ data: { kind: "weekly", team: true } }),
  });
  const startMut = useMutation({
    mutationFn: () => start({ data: { kind: "weekly" } }),
    onSuccess: (result) =>
      navigate({ to: "/play/session/$sessionId", params: { sessionId: result.sessionId } }),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not start"),
  });

  if (isPending || !data) return <PageLoader />;

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <Link to="/play" className="text-xs text-accent underline">
        Play
      </Link>
      <h1 className="font-display text-2xl">Team Challenge</h1>
      <p className="text-sm text-muted-foreground">
        {isoWeekKey()} · department average of this week’s weekly challenge.
      </p>
      <button
        type="button"
        onClick={() => startMut.mutate()}
        className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
      >
        Play this week’s paper
      </button>
      <ol className="space-y-2">
        {data.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No department scores yet.</p>
        ) : (
          data.rows.map((row) => (
            <li
              key={row.rank}
              className="flex justify-between rounded-md border border-border px-3 py-2 text-sm"
            >
              <span>
                {row.rank}. {row.name}
              </span>
              <span className="tabular-nums">
                {row.score}
                {"attempts" in row ? ` · ${row.attempts} plays` : ""}
              </span>
            </li>
          ))
        )}
      </ol>
    </div>
  );
}
