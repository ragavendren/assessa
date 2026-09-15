import { PulseSelfPacedForm } from "@/components/play/PulseSelfPacedForm";
import { PulseWall } from "@/components/play/PulseWall";
import { PageLoader } from "@/components/platform";
import { usePulseRealtime } from "@/hooks/use-pulse-realtime";
import {
  getPulsePlayerState,
  joinPlayPulse,
  submitPlayPulseResponse,
  submitPlayPulseResponsesBatch,
} from "@/lib/play.pulse.functions";
import type { PulseResponsePayload } from "@/lib/play.pulse";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const submitBatchFn = useServerFn(submitPlayPulseResponsesBatch);
  usePulseRealtime(pulseId);
  const [text, setText] = useState("");
  const [multiIndexes, setMultiIndexes] = useState<number[]>([]);
  const [otherText, setOtherText] = useState("");
  const [matrixRatings, setMatrixRatings] = useState<Array<number | null>>([]);
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

  useEffect(() => {
    if (!data || data.joined || autoJoinAttempted.current || joinMut.isPending) return;
    autoJoinAttempted.current = true;
    joinMut.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mutate once per visit
  }, [data?.joined, data?.pulse.status]);

  useEffect(() => {
    setText("");
    setMultiIndexes([]);
    setOtherText("");
    setMatrixRatings(data?.slide?.type === "matrix" ? data.slide.options.map(() => null) : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on slide identity only
  }, [data?.pulse.currentIndex, data?.slide?.type, data?.slide?.options?.length]);

  const submitMut = useMutation({
    mutationFn: (args: { slideIndex: number; response: PulseResponsePayload }) =>
      submitFn({
        data: {
          pulseId,
          slideIndex: args.slideIndex,
          response: args.response,
        },
      }),
    onSuccess: () => {
      toast.success("Saved");
      setText("");
      setMultiIndexes([]);
      setOtherText("");
      void queryClient.invalidateQueries({ queryKey: ["pulse-player", pulseId] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not submit"),
  });

  const batchMut = useMutation({
    mutationFn: (answers: Array<{ slideIndex: number; response: PulseResponsePayload }>) =>
      submitBatchFn({ data: { pulseId, answers } }),
    onSuccess: () => {
      toast.success("All responses submitted");
      void queryClient.invalidateQueries({ queryKey: ["pulse-player", pulseId] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not submit"),
  });

  const otherOptionIndex = useMemo(() => {
    if (!data?.slide || data.slide.type !== "multi") return -1;
    return data.slide.options.findIndex((o) => /^other\b/i.test(o));
  }, [data?.slide]);

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
  const selfPaced = data.selfPaced === true;

  return (
    <div className={cn("mx-auto space-y-5", selfPaced ? "max-w-3xl" : "max-w-2xl")}>
      <Link to="/play/pulse" className="text-xs text-accent underline">
        Pulse
      </Link>

      {!selfPaced ? (
        <header>
          <h1 className="font-display text-2xl">{pulse.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Code {pulse.joinCode} · {pulse.status} · {participantCount} joined
          </p>
        </header>
      ) : null}

      {!joined ? (
        <section className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            {joining ? "Joining this Pulse…" : "Join to answer and continue."}
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
          Lobby open — waiting for the host to open the survey.
        </p>
      ) : null}

      {selfPaced && joined && (pulse.status === "prompt" || pulse.status === "complete") ? (
        <PulseSelfPacedForm
          pulseName={pulse.name}
          sections={data.sections}
          slides={data.slides}
          myResponses={data.myResponses}
          answerableCount={data.answerableCount}
          canAnswer={canAnswer && pulse.status === "prompt"}
          submitting={batchMut.isPending}
          onSubmitAll={async (answers) => {
            await batchMut.mutateAsync(answers);
          }}
        />
      ) : null}

      {selfPaced && joined && pulse.status === "complete" && data.slides.length === 0 ? (
        <div className="rounded-3xl border border-border bg-gradient-to-br from-teal-500/10 via-card to-background p-6 text-center">
          <p className="font-display text-xl">Survey closed</p>
          <p className="mt-2 text-sm text-muted-foreground">Thanks for participating.</p>
        </div>
      ) : null}

      {!selfPaced && slide ? (
        <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Slide {pulse.currentIndex + 1} · {slide.type}
            {pulse.status === "results" || pulse.status === "complete" ? " · closed" : null}
          </p>
          <h2 className="text-lg font-semibold">{slide.prompt}</h2>
          {slide.imageUrl ? (
            <img src={slide.imageUrl} alt="" className="max-h-56 w-full rounded-xl object-cover" />
          ) : null}

          {slide.type === "section" ? (
            canAnswer ? (
              <button
                type="button"
                disabled={submitMut.isPending}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                onClick={() =>
                  submitMut.mutate({
                    slideIndex: pulse.currentIndex,
                    response: { acknowledged: true },
                  })
                }
              >
                Continue
              </button>
            ) : data.myResponse ? (
              <p className="text-sm text-muted-foreground">Section acknowledged.</p>
            ) : null
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
                        if (canAnswer) {
                          submitMut.mutate({
                            slideIndex: pulse.currentIndex,
                            response: { choiceIndex: index },
                          });
                        }
                      }}
                    >
                      {opt}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {slide.type === "multi" ? (
            canAnswer ? (
              <div className="space-y-3">
                <ul className="space-y-2">
                  {slide.options.map((opt, index) => {
                    const checked = multiIndexes.includes(index);
                    return (
                      <li key={`${opt}-${index}`}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-sm",
                            checked ? "border-primary bg-primary/10" : "border-border",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={checked}
                            onChange={() =>
                              setMultiIndexes((prev) =>
                                prev.includes(index)
                                  ? prev.filter((i) => i !== index)
                                  : [...prev, index],
                              )
                            }
                          />
                          <span>{opt}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                {otherOptionIndex >= 0 && multiIndexes.includes(otherOptionIndex) ? (
                  <input
                    className="field h-9 w-full text-sm"
                    value={otherText}
                    maxLength={200}
                    placeholder="Please specify…"
                    onChange={(e) => setOtherText(e.target.value)}
                  />
                ) : null}
                <button
                  type="button"
                  disabled={submitMut.isPending || multiIndexes.length < 1}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
                  onClick={() =>
                    submitMut.mutate({
                      slideIndex: pulse.currentIndex,
                      response: {
                        choiceIndexes: multiIndexes,
                        ...(otherText.trim() ? { otherText: otherText.trim() } : {}),
                      },
                    })
                  }
                >
                  Submit selections
                </button>
              </div>
            ) : data.myResponse && "choiceIndexes" in data.myResponse ? (
              <p className="rounded-xl border border-border bg-secondary/30 px-3 py-2 text-sm">
                {data.myResponse.choiceIndexes
                  .map((i) => slide.options[i] ?? `#${i + 1}`)
                  .join(", ")}
                {data.myResponse.otherText ? ` · Other: ${data.myResponse.otherText}` : ""}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Responses are closed for this slide.</p>
            )
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
                      if (canAnswer) {
                        submitMut.mutate({
                          slideIndex: pulse.currentIndex,
                          response: { rating },
                        });
                      }
                    }}
                  >
                    {rating}
                  </button>
                );
              })}
            </div>
          ) : null}

          {slide.type === "matrix" ? (
            canAnswer ? (
              <div className="space-y-4 overflow-x-auto">
                {slide.options.map((rowLabel, rowIndex) => (
                  <fieldset key={`${rowLabel}-${rowIndex}`} className="min-w-[16rem]">
                    <legend className="mb-2 text-sm font-medium">{rowLabel}</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: slide.ratingMax }, (_, i) => i + 1).map((rating) => {
                        const selected = matrixRatings[rowIndex] === rating;
                        return (
                          <button
                            key={rating}
                            type="button"
                            className={cn(
                              "h-9 w-9 rounded-md border text-xs font-semibold",
                              selected ? "border-primary bg-primary/10" : "border-border",
                            )}
                            onClick={() =>
                              setMatrixRatings((prev) => {
                                const next = [...prev];
                                next[rowIndex] = rating;
                                return next;
                              })
                            }
                          >
                            {rating}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
                <button
                  type="button"
                  disabled={
                    submitMut.isPending ||
                    matrixRatings.length !== slide.options.length ||
                    matrixRatings.some((r) => r == null)
                  }
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
                  onClick={() =>
                    submitMut.mutate({
                      slideIndex: pulse.currentIndex,
                      response: { ratings: matrixRatings.map((r) => r as number) },
                    })
                  }
                >
                  Submit ratings
                </button>
              </div>
            ) : data.myResponse && "ratings" in data.myResponse ? (
              <ul className="space-y-1 text-sm">
                {slide.options.map((label, i) => (
                  <li key={`${label}-${i}`}>
                    {label}:{" "}
                    {data.myResponse && "ratings" in data.myResponse
                      ? data.myResponse.ratings[i]
                      : "—"}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Responses are closed for this slide.</p>
            )
          ) : null}

          {slide.type === "text" ? (
            canAnswer ? (
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (text.trim()) {
                    submitMut.mutate({
                      slideIndex: pulse.currentIndex,
                      response: { text: text.trim() },
                    });
                  }
                }}
              >
                <label className="sr-only" htmlFor="pulse-text">
                  Your response
                </label>
                <textarea
                  id="pulse-text"
                  className="field min-h-[5rem] w-full text-sm"
                  value={text}
                  maxLength={2000}
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

          {!canAnswer && pulse.status === "prompt" && !joined ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">Join to submit an answer.</p>
          ) : null}
        </section>
      ) : null}

      {!selfPaced ? (
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
      ) : null}

      {pulse.status === "complete" && !selfPaced ? (
        <p className="text-center text-sm text-muted-foreground">This Pulse is complete.</p>
      ) : null}
    </div>
  );
}
