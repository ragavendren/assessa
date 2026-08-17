import { PageLoader } from "@/components/platform";
import { beginEscapeScene, getEscapeRooms } from "@/lib/play.functions";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/play/escape/$scenarioId")({
  head: () => ({ meta: [{ title: "Escape room — Assessa" }] }),
  component: EscapeScenePage,
});

function EscapeScenePage() {
  const { scenarioId } = Route.useParams();
  const navigate = useNavigate();
  const fetchRooms = useServerFn(getEscapeRooms);
  const start = useServerFn(beginEscapeScene);
  const { data } = useQuery({ queryKey: ["escape-rooms"], queryFn: () => fetchRooms() });
  const room = data?.find((item) => item.id === scenarioId);
  const startMut = useMutation({
    mutationFn: (sceneIndex: number) => start({ data: { scenarioId, sceneIndex } }),
    onSuccess: (result) =>
      navigate({ to: "/play/session/$sessionId", params: { sessionId: result.sessionId } }),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not start scene"),
  });

  if (!data) return <PageLoader />;
  if (!room) return <p className="text-sm text-muted-foreground">Scenario not found.</p>;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link to="/play/escape" className="text-xs text-accent underline">
        Escape rooms
      </Link>
      <h1 className="font-display text-2xl">{room.name}</h1>
      <p className="text-sm text-muted-foreground">{room.intro}</p>
      <ol className="space-y-3">
        {room.scenes.map((scene, index) => (
          <li key={scene.id} className="rounded-md border border-border p-4">
            <p className="text-xs text-muted-foreground">
              Scene {index + 1} · {scene.topic}
            </p>
            <p className="font-medium">{scene.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{scene.body}</p>
            <button
              type="button"
              onClick={() => startMut.mutate(index)}
              className="mt-3 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground"
            >
              Enter
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
