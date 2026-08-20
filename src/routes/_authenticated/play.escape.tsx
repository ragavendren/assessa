import { PlayLobbyList } from "@/components/play/PlayLobbyList";
import { PageLoader } from "@/components/platform";
import { getEscapeRooms } from "@/lib/play.functions";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/play/escape")({
  validateSearch: z.object({
    courseId: z.string().uuid().optional(),
  }),
  head: () => ({ meta: [{ title: "Escape rooms — Assessa" }] }),
  component: EscapeListPage,
});

function EscapeListPage() {
  const { courseId } = Route.useSearch();
  const fetchRooms = useServerFn(getEscapeRooms);
  const { data, isPending } = useQuery({
    queryKey: ["escape-rooms", courseId ?? "all"],
    queryFn: () => fetchRooms({ data: { courseId: courseId ?? null } }),
  });

  const items = useMemo(() => {
    if (!data) return [];
    return data.map((room) => ({
      id: room.id,
      title: room.name,
      meta: `${room.scenes.length} scenes${room.courseName ? ` · ${room.courseName}` : ""}`,
      statusLabel: "Open",
      statusTone: "lobby" as const,
      to: "/play/escape/$scenarioId",
      params: { scenarioId: room.id },
    }));
  }, [data]);

  if (isPending || !data) return <PageLoader label="Loading escape rooms…" />;

  return (
    <PlayLobbyList
      title="Escape rooms"
      blurb="Pick a published scenario and work through each incident scene."
      empty={
        courseId
          ? "No escape rooms for this course yet."
          : "No escape scenarios are published right now."
      }
      items={items}
    />
  );
}
