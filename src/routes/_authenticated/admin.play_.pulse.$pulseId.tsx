import { AdminNav } from "@/components/AdminNav";
import { AdminAccessDenied } from "@/components/admin/AdminPageUi";
import { PulseShareCard } from "@/components/play/PulseShareCard";
import { PulseWall } from "@/components/play/PulseWall";
import { PageLoader } from "@/components/platform";
import { usePulseRealtime } from "@/hooks/use-pulse-realtime";
import { getPulseHostState, runPulseAction } from "@/lib/play.pulse.functions";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/play_/pulse/$pulseId")({
  head: () => ({ meta: [{ title: "Host Pulse — Assessa Admin" }] }),
  component: AdminPulseHostPage,
});

const actionBtn =
  "inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-60";

function AdminPulseHostPage() {
  const { pulseId } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchHost = useServerFn(getPulseHostState);
  const actionFn = useServerFn(runPulseAction);
  usePulseRealtime(pulseId);

  const { data, isPending, error } = useQuery({
    queryKey: ["pulse-host", pulseId],
    queryFn: () => fetchHost({ data: { pulseId } }),
    refetchInterval: 4000,
  });

  const actionMut = useMutation({
    mutationFn: (payload: {
      action: "openLobby" | "showSlide" | "reveal" | "next" | "finish";
      slideIndex?: number;
    }) => actionFn({ data: { pulseId, ...payload } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pulse-host", pulseId] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Action failed"),
  });

  if (isPending) {
    return (
      <div>
        <AdminNav />
        <PageLoader label="Loading host console…" />
      </div>
    );
  }
  if (error || !data) {
    const message =
      error instanceof Error
        ? error.message
        : error &&
            typeof error === "object" &&
            "message" in error &&
            typeof (error as { message: unknown }).message === "string"
          ? (error as { message: string }).message
          : "Admin only.";
    if (/administrator access required/i.test(message)) {
      return (
        <div>
          <AdminNav />
          <AdminAccessDenied />
        </div>
      );
    }
    return (
      <div>
        <AdminNav />
        <div className="surface-paper p-8 text-center">
          <p className="font-display text-xl">Host console could not load</p>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    );
  }

  const { pulse, slides, participants, responseCount, wall, wallVisible } = data;
  const current = slides[pulse.currentIndex] ?? null;
  const busy = actionMut.isPending;

  return (
    <div className="space-y-5">
      <AdminNav />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/admin/play/live-pulse" className="text-xs text-accent underline">
            Pulse list
          </Link>
          <h1 className="mt-1 font-display text-2xl">{pulse.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {pulse.status} · reveal {pulse.revealMode} · {participants.length} joined ·{" "}
            {responseCount} answers on this slide
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/play/pulse-board/$pulseId"
            params={{ pulseId }}
            target="_blank"
            className={actionBtn}
          >
            Undock wall
          </Link>
        </div>
      </div>

      <PulseShareCard pulseId={pulse.id} pulseName={pulse.name} joinCode={pulse.joinCode} />

      <section className="flex flex-wrap gap-2" aria-label="Host controls">
        {pulse.status === "draft" || pulse.status === "lobby" ? (
          <button
            type="button"
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            disabled={busy}
            onClick={() =>
              actionMut.mutate(
                pulse.status === "draft"
                  ? { action: "openLobby" }
                  : { action: "showSlide", slideIndex: 0 },
              )
            }
          >
            {pulse.status === "draft" ? "Start session" : "Start first slide"}
          </button>
        ) : null}
        {pulse.status === "prompt" || pulse.status === "results" ? (
          <>
            <button
              type="button"
              className={actionBtn}
              disabled={busy || pulse.status === "results"}
              onClick={() => actionMut.mutate({ action: "reveal" })}
            >
              Reveal wall
            </button>
            <button
              type="button"
              className={actionBtn}
              disabled={busy}
              onClick={() => actionMut.mutate({ action: "next" })}
            >
              Next slide
            </button>
            <button
              type="button"
              className={actionBtn}
              disabled={busy}
              onClick={() => actionMut.mutate({ action: "finish" })}
            >
              Finish
            </button>
          </>
        ) : null}
        {pulse.status === "complete" ? (
          <button
            type="button"
            className={actionBtn}
            disabled={busy}
            onClick={() => actionMut.mutate({ action: "openLobby" })}
          >
            Restart session
          </button>
        ) : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Current slide</h2>
          {current && (pulse.status === "prompt" || pulse.status === "results") ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {current.type} · #{pulse.currentIndex + 1}/{slides.length}
              </p>
              <p className="text-lg font-medium">{current.prompt}</p>
              {current.imageUrl ? (
                <img
                  src={current.imageUrl}
                  alt=""
                  className="max-h-56 w-full rounded-xl object-cover"
                />
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {pulse.status === "complete"
                ? "Session finished. Restart to run slides again, or pick a slide below."
                : pulse.status === "lobby"
                  ? "Lobby open — start the first slide when ready."
                  : "Start the session to put the first slide live for participants."}
            </p>
          )}
          <ul className="mt-4 space-y-1">
            {slides.map((slide, index) => (
              <li key={slide.id}>
                <button
                  type="button"
                  className={cn(
                    "w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-secondary",
                    index === pulse.currentIndex && "bg-primary/10 font-medium",
                  )}
                  disabled={busy || pulse.status === "draft"}
                  onClick={() => actionMut.mutate({ action: "showSlide", slideIndex: index })}
                >
                  {index + 1}. {slide.prompt.slice(0, 60)}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-4">
          <PulseWall
            wall={wallVisible ? wall : null}
            title={wallVisible ? "Response wall" : "Wall hidden until reveal rules allow"}
          />
          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Participants ({participants.length})</h2>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm">
              {participants.map((p) => (
                <li key={p.userId} className="flex justify-between gap-2">
                  <span>{p.name}</span>
                  {p.email ? (
                    <span className="text-xs text-muted-foreground">{p.email}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
