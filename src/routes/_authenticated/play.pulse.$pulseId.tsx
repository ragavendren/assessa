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
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/play/pulse/$pulseId")({
  head: () => ({ meta: [{ title: "Pulse — Assessa" }] }),
  component: PulsePlayerPage,
});

function queryErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return "Pulse unavailable.";
}

function PulsePlayerPage() {
  const { pulseId } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchPlayer = useServerFn(getPulsePlayerState);
  const joinFn = useServerFn(joinPlayPulse);
  const submitFn = useServerFn(submitPlayPulseResponse);
  usePulseRealtime(pulseId);
  const [text, setText] = useState("");
  const autoJoinAttempted = useRef(false);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["pulse-player", pulseId],
    queryFn: () => fetchPlayer({ data: { pulseId } }),
    refetchInterval: 3500,
    retry: 1,
  });

  const joinMut = useMutation({
    mutationFn: () => joinFn({ data: { pulseId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pulse-player", pulseId] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not join"),
  });

  // Fallback if an older server build did not auto-enroll on load.
  useEffect(() => {
    if (!data || data.joined || autoJoinAttempted.current || joinMut.isPending) return;
    if (data.pulse.status === "draft") return;
    autoJoinAttempted.current = true;
    joinMut.mutate();
    // intentionally only when membership is missing
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mutate once per visit
  }, [data?.joined, data?.pulse.status]);

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

  if (isPending && !data) {
    return <PageLoader label="Loading Pulse…" />;
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-border bg-card p-6 text-center">
        <p className="font-display text-xl">Could not open this Pulse</p>
        <p className="text-sm text-muted-foreground">{queryErrorMessage(error)}</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
            onClick={() => void refetch()}
          >
            Try again
          </button>
          <Link
            to="/play/pulse"
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
          >
            Back to Pulse
          </Link>
        </div>
      </div>
    );
  }

  const { pulse, slide, joined, canAnswer, wall, wallVisible, participantCount } = data;
  const joining = joinMut.isPending && !joined;

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
          <p className="text-sm text-muted-foreground">
            {joining ? "Joining this Pulse…" : "Join to answer slides and see the response wall."}
          </p>
          <button
            type="button"
            className="mt-3 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            disabled={joinMut.isPending}
            onClick={() => {
              autoJoinAttempted.current = true;
              joinMut.mutate();
            }}
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

      {pulse.status === "draft" ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          This Pulse is not open yet. Ask the host to open the lobby.
        </p>
      ) : null}

      {slide ? (
        <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Slide {pulse.currentIndex + 1} · {slide.type}
            {pulse.status === "results" || pulse.status === "complete" ? " · closed" : null}
          </p>
          <h2 className="text-lg font-semibold">{slide.prompt}</h2>
          {slide.imageUrl ? (
            <img src={slide.imageUrl} alt="" className="max-h-56 w-full rounded-xl object-cover" />
          ) : null}

          {slide.type === "mcq" ? (
            <ul className="space-y-2">
              {slide.options.map((opt, index) => {
                const selected =
                  data.myResponse &&
                  "choiceIndex" in data.myResponse &&
                  data.myResponse.choiceIndex === index;
                return (
                  <li key={`${opt}-${index}`}>
                    <button
                      type="button"
                      disabled={!canAnswer || submitMut.isPending}
                      className={cn(
                        "w-full rounded-xl border px-3 py-2 text-left text-sm disabled:opacity-70",
                        selected ? "border-primary bg-primary/10 font-medium" : "border-border",
                        canAnswer && "hover:bg-secondary disabled:opacity-60",
                      )}
                      onClick={() => {
                        if (canAnswer) submitMut.mutate({ choiceIndex: index });
                      }}
                    >
                      {opt}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {slide.type === "rating" ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: slide.ratingMax }, (_, i) => i + 1).map((rating) => {
                const selected =
                  data.myResponse &&
                  "rating" in data.myResponse &&
                  data.myResponse.rating === rating;
                return (
                  <button
                    key={rating}
                    type="button"
                    disabled={!canAnswer || submitMut.isPending}
                    className={cn(
                      "h-10 w-10 rounded-full border text-sm font-semibold disabled:opacity-70",
                      selected ? "border-primary bg-primary/10" : "border-border",
                      canAnswer && "hover:bg-secondary disabled:opacity-60",
                    )}
                    onClick={() => {
                      if (canAnswer) submitMut.mutate({ rating });
                    }}
                  >
                    {rating}
                  </button>
                );
              })}
            </div>
          ) : null}

          {slide.type === "text" ? (
            canAnswer ? (
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
            ) : data.myResponse && "text" in data.myResponse ? (
              <p className="rounded-xl border border-border bg-secondary/30 px-3 py-2 text-sm">
                {data.myResponse.text}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Responses are closed for this slide.</p>
            )
          ) : null}

          {data.myResponse && slide.type !== "text" ? (
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

          {!canAnswer && pulse.status === "prompt" && !joined ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">Join to submit an answer.</p>
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
