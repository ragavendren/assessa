import { PulseWall } from "@/components/play/PulseWall";
import { PageLoader } from "@/components/platform";
import { usePulseRealtime } from "@/hooks/use-pulse-realtime";
import {
  getPulsePlayerState,
  joinPlayPulse,
  submitPlayPulseResponse,
} from "@/lib/play.pulse.functions";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/play/pulse/$pulseId")({
  head: () => ({ meta: [{ title: "Pulse — Assessa" }] }),
  component: PulsePlayerPage,
});

function PulsePlayerPage() {
  const { pulseId } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchPlayer = useServerFn(getPulsePlayerState);
  const joinFn = useServerFn(joinPlayPulse);
  const submitFn = useServerFn(submitPlayPulseResponse);
  usePulseRealtime(pulseId);
  const [text, setText] = useState("");

  const { data, isPending, error } = useQuery({
    queryKey: ["pulse-player", pulseId],
    queryFn: () => fetchPlayer({ data: { pulseId } }),
    refetchInterval: 3500,
  });

  const joinMut = useMutation({
    mutationFn: () => joinFn({ data: { pulseId } }),
    onSuccess: () => {
      toast.success("You’re in");
      void queryClient.invalidateQueries({ queryKey: ["pulse-player", pulseId] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not join"),
  });

  const submitMut = useMutation({
    mutationFn: (response: { choiceIndex: number } | { text: string } | { rating: number }) =>
      submitFn({
        data: {
          pulseId,
          slideIndex: data!.pulse.currentIndex,
          response,
        },
      }),
    onSuccess: () => {
      toast.success("Response sent");
      setText("");
      void queryClient.invalidateQueries({ queryKey: ["pulse-player", pulseId] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not submit"),
  });

  if (isPending || !data) return <PageLoader label="Loading Pulse…" />;
  if (error) {
    return (
      <p className="text-sm text-muted-foreground">
        {error instanceof Error ? error.message : "Pulse unavailable."}
      </p>
    );
  }

  const { pulse, slide, joined, canAnswer, wall, wallVisible, participantCount } = data;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link to="/play/pulse" className="text-xs text-accent underline">
        Pulse
      </Link>
      <header>
        <h1 className="font-display text-2xl">{pulse.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Code {pulse.joinCode} · {pulse.status} · {participantCount} joined
        </p>
      </header>

      {!joined ? (
        <section className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Join to answer slides and see the wall.</p>
          <button
            type="button"
            className="mt-3 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            disabled={joinMut.isPending}
            onClick={() => joinMut.mutate()}
          >
            {joinMut.isPending ? "Joining…" : "Join Pulse"}
          </button>
        </section>
      ) : null}

      {pulse.status === "lobby" ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Lobby open — waiting for the host to start the first slide.
        </p>
      ) : null}

      {slide ? (
        <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Slide {pulse.currentIndex + 1} · {slide.type}
          </p>
          <h2 className="text-lg font-semibold">{slide.prompt}</h2>
          {slide.imageUrl ? (
            <img src={slide.imageUrl} alt="" className="max-h-56 w-full rounded-xl object-cover" />
          ) : null}

          {canAnswer && slide.type === "mcq" ? (
            <ul className="space-y-2">
              {slide.options.map((opt, index) => (
                <li key={`${opt}-${index}`}>
                  <button
                    type="button"
                    disabled={submitMut.isPending}
                    className="w-full rounded-xl border border-border px-3 py-2 text-left text-sm hover:bg-secondary disabled:opacity-60"
                    onClick={() => submitMut.mutate({ choiceIndex: index })}
                  >
                    {opt}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {canAnswer && slide.type === "rating" ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: slide.ratingMax }, (_, i) => i + 1).map((rating) => (
                <button
                  key={rating}
                  type="button"
                  disabled={submitMut.isPending}
                  className="h-10 w-10 rounded-full border border-border text-sm font-semibold hover:bg-secondary disabled:opacity-60"
                  onClick={() => submitMut.mutate({ rating })}
                >
                  {rating}
                </button>
              ))}
            </div>
          ) : null}

          {canAnswer && slide.type === "text" ? (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim()) submitMut.mutate({ text: text.trim() });
              }}
            >
              <label className="sr-only" htmlFor="pulse-text">
                Your response
              </label>
              <textarea
                id="pulse-text"
                className="field min-h-[5rem] w-full text-sm"
                value={text}
                maxLength={280}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type your response…"
              />
              <button
                type="submit"
                disabled={submitMut.isPending || !text.trim()}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                Submit
              </button>
            </form>
          ) : null}

          {data.myResponse ? (
            <p className="text-xs text-teal-700 dark:text-teal-300" role="status">
              Your response is in
              {"choiceIndex" in data.myResponse
                ? ` · option ${data.myResponse.choiceIndex + 1}`
                : "rating" in data.myResponse
                  ? ` · ${data.myResponse.rating}`
                  : ""}
              .
            </p>
          ) : null}
        </section>
      ) : null}

      <PulseWall
        wall={wallVisible ? wall : null}
        title={
          wallVisible
            ? "Response wall"
            : pulse.revealMode === "host"
              ? "Host will reveal the wall"
              : pulse.revealMode === "all_in"
                ? "Wall opens when everyone has answered"
                : "Waiting for responses"
        }
      />

      {pulse.status === "complete" ? (
        <p className={cn("text-center text-sm text-muted-foreground")}>This Pulse is complete.</p>
      ) : null}
    </div>
  );
}
