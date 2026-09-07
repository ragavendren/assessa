import { PulseWall } from "@/components/play/PulseWall";
import { PageLoader } from "@/components/platform";
import { usePulseRealtime } from "@/hooks/use-pulse-realtime";
import { getPulseHostState } from "@/lib/play.pulse.functions";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/admin/play_/pulse-board/$pulseId")({
  head: () => ({ meta: [{ title: "Pulse wall — Assessa" }] }),
  component: PulseBoardPage,
});

function PulseBoardPage() {
  const { pulseId } = Route.useParams();
  const fetchHost = useServerFn(getPulseHostState);
  usePulseRealtime(pulseId);

  const { data, isPending, error } = useQuery({
    queryKey: ["pulse-board", pulseId],
    queryFn: () => fetchHost({ data: { pulseId } }),
    refetchInterval: 3000,
  });

  if (isPending) return <PageLoader label="Loading wall…" />;
  if (error || !data) {
    return <p className="p-6 text-sm text-muted-foreground">Wall unavailable.</p>;
  }

  const slide = data.slides[data.pulse.currentIndex] ?? null;

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <header className="mx-auto mb-6 max-w-5xl text-center">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">{data.pulse.name}</p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl">
          {slide?.prompt ?? "Waiting for the next slide"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Code {data.pulse.joinCode} · {data.participants.length} joined · {data.responseCount}{" "}
          answers
        </p>
        {slide?.imageUrl ? (
          <img
            src={slide.imageUrl}
            alt=""
            className="mx-auto mt-4 max-h-64 rounded-2xl object-cover"
          />
        ) : null}
      </header>
      <div className="mx-auto max-w-5xl">
        <PulseWall wall={data.wallVisible ? data.wall : null} large />
      </div>
    </div>
  );
}
