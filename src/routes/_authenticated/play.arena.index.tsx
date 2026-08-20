import { PlayLobbyList } from "@/components/play/PlayLobbyList";
import { PageLoader } from "@/components/platform";
import { listLiveArenas } from "@/lib/play.functions";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/play/arena/")({
  validateSearch: z.object({
    activityId: z.string().uuid().optional(),
    courseId: z.string().uuid().optional(),
  }),
  head: () => ({ meta: [{ title: "Live Arena lobbies — Assessa" }] }),
  component: ArenaListPage,
});

function ArenaListPage() {
  const { activityId, courseId } = Route.useSearch();
  const fetchArenas = useServerFn(listLiveArenas);
  const { data, isPending } = useQuery({
    queryKey: ["live-arenas", activityId ?? "all", courseId ?? "all"],
    queryFn: () =>
      fetchArenas({
        data: {
          activityId: activityId ?? null,
          courseId: courseId ?? null,
        },
      }),
  });

  const items = useMemo(() => {
    if (!data?.arenas) return [];
    return data.arenas.map((arena) => {
      const open = arena.status === "lobby" || arena.status === "draft";
      const done = arena.status === "complete";
      return {
        id: arena.id,
        title: arena.name,
        meta: [
          `${arena.segment_count}×${arena.questions_per_segment} questions`,
          `${arena.per_question_seconds}s timer`,
          arena.courseName ? arena.courseName : null,
        ]
          .filter(Boolean)
          .join(" · "),
        statusLabel: done ? "Finished" : open ? "Lobby open" : arena.status,
        statusTone: (done ? "done" : open ? "lobby" : "live") as "done" | "lobby" | "live",
        to: "/play/arena/$arenaId",
        params: { arenaId: arena.id },
      };
    });
  }, [data?.arenas]);

  if (isPending || !data) return <PageLoader label="Loading lobbies…" />;

  return (
    <PlayLobbyList
      title="Live Arena"
      blurb="Open lobbies for hosted team quizzes. Join with a team name — anyone using the same name is on your side."
      empty={
        courseId || activityId
          ? "No lobbies for this course or activity right now. Check back when a host opens one."
          : "No live arenas are open right now. Ask a host to open a lobby from Play control."
      }
      items={items}
    />
  );
}
