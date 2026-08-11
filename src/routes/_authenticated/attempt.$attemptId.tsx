import { PageLoader } from "@/components/platform";
import { getAttemptPaper, finishAttempt } from "@/lib/platform.functions";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/attempt/$attemptId")({
  head: () => ({
    meta: [
      { title: "Assessment in progress — Assessa" },
      {
        name: "description",
        content: "Answer the questions before the timer runs out. Scoring is handled server-side.",
      },
      { property: "og:title", content: "Assessment in progress — Assessa" },
      { property: "og:description", content: "Your live assessment attempt." },
    ],
  }),
  component: AttemptRunner,
});

function AttemptRunner() {
  const { attemptId } = Route.useParams();
  const navigate = useNavigate();
  const fetchPaper = useServerFn(getAttemptPaper);
  const submit = useServerFn(finishAttempt);

  const { data, isPending, error } = useQuery({
    queryKey: ["paper", attemptId],
    queryFn: () => fetchPaper({ data: { attemptId } }),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const [answers, setAnswers] = useState<Record<string, number | number[]>>({});
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const submittedRef = useRef(false);

  const mutation = useMutation({
    mutationFn: (payload: Record<string, number | number[]>) =>
      submit({ data: { attemptId, answers: payload } }),
    onSuccess: () => navigate({ to: "/results/$attemptId", params: { attemptId } }),
    onError: (err) => {
      submittedRef.current = false;
      toast.error(err instanceof Error ? err.message : "Submission failed");
    },
  });

  const doSubmit = useCallback(
    (payload: Record<string, number | number[]>) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      mutation.mutate(payload);
    },
    [mutation],
  );

  const deadline = data && !data.submitted ? data.deadline : null;

  useEffect(() => {
    if (!deadline) return;
    const tick = () => {
      const left = Math.max(0, Math.round((new Date(deadline).getTime() - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) doSubmit(answers);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline, answers, doSubmit]);

  useEffect(() => {
    if (data && data.submitted) navigate({ to: "/results/$attemptId", params: { attemptId } });
  }, [data, attemptId, navigate]);

  const questions = useMemo(
    () => (data && !data.submitted ? data.questions : []),
    [data],
  );

  if (isPending) return <PageLoader />;
  if (error || !data) {
    return (
      <div className="surface-paper p-8 text-center">
        <p className="font-display text-xl">Attempt unavailable</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "This attempt could not be loaded."}
        </p>
      </div>
    );
  }
  if (data.submitted) return <PageLoader />;

  const question = questions[index];
  const answeredCount = Object.values(answers).filter(isAnswered).length;
  const lowTime = remaining != null && remaining <= 60;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="surface-paper sticky top-20 z-30 mb-6 flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="min-w-0">
          <p className="text-hairline text-muted-foreground">{data.exam.topic}</p>
          <p className="truncate font-medium">{data.exam.title}</p>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <p className="text-hairline text-muted-foreground">Answered</p>
            <p className="font-display text-lg">
              {answeredCount}/{questions.length}
            </p>
          </div>
          <div className="text-right">
            <p className="text-hairline text-muted-foreground">Time left</p>
            <p
              className={cn(
                "font-display text-lg tabular-nums",
                lowTime && "text-destructive",
              )}
            >
              {remaining == null ? "—" : formatClock(remaining)}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {questions.map((q, i) => (
          <button
            key={q.id}
            onClick={() => setIndex(i)}
            className={cn(
              "h-8 w-8 rounded-md border text-xs font-semibold transition-colors",
              i === index
                ? "border-accent bg-accent text-accent-foreground"
                : isAnswered(answers[q.id])
                  ? "border-success/40 bg-success/12 text-success"
                  : "border-border bg-card text-muted-foreground",
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {question ? (
        <article className="surface-paper p-6">
          <p className="text-hairline text-muted-foreground">
            Question {index + 1} of {questions.length} · {question.subtopic}
            {question.multiSelect ? " · select all that apply" : ""}
          </p>
          <h2 className="mt-3 font-display text-2xl leading-snug">{question.prompt}</h2>
          <div className="mt-6 space-y-2.5">
            {question.options.map((option, optionIndex) => {
              const selected = isOptionSelected(answers[question.id], optionIndex);
              return (
                <button
                  key={optionIndex}
                  onClick={() =>
                    setAnswers((prev) => ({
                      ...prev,
                      [question.id]: toggleAnswer(
                        prev[question.id],
                        optionIndex,
                        question.multiSelect,
                      ),
                    }))
                  }
                  className={cn(
                    "flex w-full items-start gap-3 rounded-md border p-3.5 text-left text-sm transition-colors",
                    selected
                      ? "border-accent bg-accent/10"
                      : "border-border bg-card hover:bg-secondary/50",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border text-[11px] font-semibold",
                      question.multiSelect ? "rounded-md" : "rounded-full",
                      selected ? "border-accent bg-accent text-accent-foreground" : "border-border",
                    )}
                  >
                    {String.fromCharCode(65 + optionIndex)}
                  </span>
                  <span>{option}</span>
                </button>
              );
            })}
          </div>
        </article>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
            disabled={index >= questions.length - 1}
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            Next
          </button>
        </div>
        <button
          onClick={() => {
            if (answeredCount < questions.length) {
              const ok = window.confirm(
                `${questions.length - answeredCount} question(s) unanswered. Submit anyway?`,
              );
              if (!ok) return;
            }
            doSubmit(answers);
          }}
          disabled={mutation.isPending}
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {mutation.isPending ? "Submitting…" : "Submit assessment"}
        </button>
      </div>
    </div>
  );
}

function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function isAnswered(value: number | number[] | undefined) {
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "number";
}

function isOptionSelected(value: number | number[] | undefined, optionIndex: number) {
  if (Array.isArray(value)) return value.includes(optionIndex);
  return value === optionIndex;
}

function toggleAnswer(
  current: number | number[] | undefined,
  optionIndex: number,
  multiSelect: boolean,
) {
  if (!multiSelect) return optionIndex;
  const selected = Array.isArray(current) ? current : typeof current === "number" ? [current] : [];
  return selected.includes(optionIndex)
    ? selected.filter((value) => value !== optionIndex)
    : [...selected, optionIndex].sort((a, b) => a - b);
}
