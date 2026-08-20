import { PlayLobbyList } from "@/components/play/PlayLobbyList";
import { PageLoader } from "@/components/platform";
import { listPlayTournaments } from "@/lib/play.functions";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/play/knockout")({
  validateSearch: z.object({
    courseId: z.string().uuid().optional(),
  }),
  head: () => ({ meta: [{ title: "Knockout brackets — Assessa" }] }),
  component: KnockoutListPage,
});

function KnockoutListPage() {
  const { courseId } = Route.useSearch();
  const fetchTournaments = useServerFn(listPlayTournaments);
  const { data, isPending } = useQuery({
    queryKey: ["play-tournaments", courseId ?? "all"],
    queryFn: () => fetchTournaments({ data: { courseId: courseId ?? null } }),
  });

  const items = useMemo(() => {
    if (!data?.tournaments) return [];
    return data.tournaments.map((row) => ({
      id: row.id,
      title: row.name,
      meta: `${row.size}-player bracket · ${row.status}`,
      statusLabel: row.status === "active" ? "In progress" : row.status,
      statusTone: (row.status === "active"
        ? "live"
        : row.status === "open"
          ? "lobby"
          : "neutral") as "live" | "lobby" | "neutral",
      to: "/play/tournament/$tournamentId",
      params: { tournamentId: row.id },
    }));
  }, [data?.tournaments]);

  if (isPending || !data) return <PageLoader label="Loading brackets…" />;

  return (
    <PlayLobbyList
      title="Knockout"
      blurb="Join an open bracket tournament. Matches draw from the pool chosen when the bracket was created."
      empty={
        courseId
          ? "No knockout brackets for this course yet."
          : "No knockout brackets are open right now."
      }
      items={items}
    />
  );
}
