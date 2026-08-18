import { PageLoader } from "@/components/platform";
import { listLiveArenas } from "@/lib/play.functions";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/play/arena/")({
  validateSearch: z.object({
    activityId: z.string().uuid().optional(),
  }),
  head: () => ({ meta: [{ title: "Live Arena — Assessa" }] }),
  component: ArenaListPage,
});

function ArenaListPage() {
  const { activityId } = Route.useSearch();
  const fetchArenas = useServerFn(listLiveArenas);
  const { data, isPending } = useQuery({
    queryKey: ["live-arenas", activityId ?? "all"],
    queryFn: () => fetchArenas({ data: { activityId: activityId ?? null } }),
  });
  if (isPending || !data) return <PageLoader />;

  return (
    <div className="space-y-4">
      <Link to="/play" className="text-xs text-accent underline">
        Play
      </Link>
      <h1 className="font-display text-2xl">Live Arena</h1>
      <p className="max-w-xl text-sm text-muted-foreground">
        Join a hosted team quiz. Pick a team name — anyone using the same name is on your team.
      </p>
      {data.arenas.length === 0 ? (
        <p className="text-sm text-muted-foreground">No live arenas are open right now.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.arenas.map((arena) => (
            <li key={arena.id}>
              <Link
                to="/play/arena/$arenaId"
                params={{ arenaId: arena.id }}
                className="block rounded-xl border border-border p-4 hover:bg-secondary"
              >
                <p className="font-medium">{arena.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {arena.segment_count} segments · {arena.questions_per_segment} Q each ·{" "}
                  {arena.per_question_seconds}s
                </p>
                <p
                  className={cn(
                    "mt-2 text-xs font-medium capitalize",
                    arena.status === "complete"
                      ? "text-amber-700 dark:text-amber-300"
                      : arena.status === "lobby"
                        ? "text-accent"
                        : "text-muted-foreground",
                  )}
                >
                  {arena.status === "complete" ? "Finished · view scoreboard" : arena.status}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
