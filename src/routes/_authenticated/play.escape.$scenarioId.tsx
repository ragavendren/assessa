import { PageLoader } from "@/components/platform";
import { beginEscapeScene, completeEscapeBeat, getEscapeRooms } from "@/lib/play.functions";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  const fetchRooms = useServerFn(getEscapeRooms);
  const start = useServerFn(beginEscapeScene);
  const continueBeat = useServerFn(completeEscapeBeat);
  const { data } = useQuery({ queryKey: ["escape-rooms"], queryFn: () => fetchRooms() });
  const room = data?.find((item) => item.id === scenarioId);

  const startMut = useMutation({
    mutationFn: (sceneIndex: number) => start({ data: { scenarioId, sceneIndex } }),
    onSuccess: (result) =>
      navigate({ to: "/play/session/$sessionId", params: { sessionId: result.sessionId } }),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not start scene"),
  });

  const beatMut = useMutation({
    mutationFn: (sceneIndex: number) => continueBeat({ data: { scenarioId, sceneIndex } }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["escape-rooms"] });
      if (result.stageReward) {
        toast.success(`Reward: ${result.stageReward.label}`);
      } else {
        toast.success("Stage cleared");
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not continue"),
  });

  if (!data) return <PageLoader />;
  if (!room) return <p className="text-sm text-muted-foreground">Scenario not found.</p>;

  const scenes = room.scenes as Array<{
    id: string;
    title: string;
    body: string;
    topic: string;
    question_count: number;
    question_source?: string | null;
    reward_code?: string | null;
    reward_label?: string | null;
    unlocked?: boolean;
    completed?: boolean;
  }>;
  const restored = Boolean(
    (room as { restoredAt?: string | null }).restoredAt ||
    (scenes.length > 0 && scenes.every((s) => s.completed)),
  );
  const completedCount = scenes.filter((s) => s.completed).length;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link to="/play/escape" className="text-xs text-accent underline">
        Escape rooms
      </Link>

      <header className="space-y-2 rounded-2xl border border-border bg-card p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">
          Critical alert
        </p>
        <h1 className="font-display text-2xl">{room.name}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{room.intro}</p>
        <div className="flex flex-wrap gap-3 pt-1 text-xs text-muted-foreground">
          <span>
            Progress {completedCount}/{scenes.length}
          </span>
          {restored ? <span className="font-medium text-emerald-700">SYSTEM RESTORED</span> : null}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-teal-700 transition-all"
            style={{
              width: `${scenes.length ? Math.round((completedCount / scenes.length) * 100) : 0}%`,
            }}
          />
        </div>
      </header>

      <ol className="space-y-3">
        {scenes.map((scene, index) => {
          const unlocked = scene.unlocked !== false;
          const completed = Boolean(scene.completed);
          const storyOnly =
            (scene.question_source ?? "pool") === "none" || scene.question_count <= 0;
          return (
            <li
              key={scene.id}
              className={cn(
                "rounded-2xl border border-border p-4",
                completed && "border-emerald-600/30 bg-emerald-500/5",
                !unlocked && "opacity-60",
              )}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>
                  Stage {index + 1}
                  {index < scenes.length - 1 ? " →" : ""}
                </span>
                {!storyOnly ? <span>· {scene.topic}</span> : <span>· story</span>}
                {scene.reward_label || scene.reward_code ? (
                  <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px]">
                    Reward: {scene.reward_label || scene.reward_code}
                  </span>
                ) : null}
                {completed ? (
                  <span className="ml-auto font-medium text-emerald-700">Cleared</span>
                ) : !unlocked ? (
                  <span className="ml-auto">Locked</span>
                ) : null}
              </div>
              <p className="mt-1 font-medium">{scene.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{scene.body}</p>
              {unlocked && !completed ? (
                storyOnly ? (
                  <button
                    type="button"
                    disabled={beatMut.isPending}
                    onClick={() => beatMut.mutate(index)}
                    className="mt-3 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-60"
                  >
                    {beatMut.isPending ? "Saving…" : "Continue"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={startMut.isPending}
                    onClick={() => startMut.mutate(index)}
                    className="mt-3 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-60"
                  >
                    Enter
                  </button>
                )
              ) : null}
            </li>
          );
        })}
      </ol>

      {restored ? (
        <div className="rounded-2xl border border-emerald-600/40 bg-emerald-500/10 p-5 text-center">
          <p className="text-sm font-semibold text-emerald-800">SYSTEM RESTORED</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Critical systems are back online. Document the RCA and stand down.
          </p>
        </div>
      ) : null}
    </div>
  );
}
