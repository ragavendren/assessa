import { PageLoader } from "@/components/platform";
import { SubmitScoringOverlay } from "@/components/ResultCelebration";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { getAttemptPaper, finishAttempt } from "@/lib/platform.functions";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useBlocker, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, Clock3, LogOut, Send } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
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
  const confirm = useConfirm();
  const promptId = useId();
  const optionsLabelId = useId();
  const questionHeadingRef = useRef<HTMLHeadingElement>(null);

  const { data, isPending, error } = useQuery({
    queryKey: ["paper", attemptId],
    queryFn: () => fetchPaper({ data: { attemptId } }),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const [answers, setAnswers] = useState<Record<string, number | number[]>>({});
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittedRef = useRef(false);
  const allowLeaveRef = useRef(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const questions = useMemo(() => (data && !data.submitted ? data.questions : []), [data]);
  const isLiveAttempt = Boolean(data && data.submitted === false);

  const mutation = useMutation({
    mutationFn: (payload: Record<string, number | number[]>) =>
      submit({ data: { attemptId, answers: payload } }),
    onSuccess: () => {
      allowLeaveRef.current = true;
      void navigate({
        to: "/results/$attemptId",
        params: { attemptId },
        ignoreBlocker: true,
        replace: true,
      });
    },
    onError: (err) => {
      submittedRef.current = false;
      allowLeaveRef.current = false;
      setIsSubmitting(false);
      toast.error(err instanceof Error ? err.message : "Submission failed");
    },
  });

  const doSubmit = useCallback(
    (payload: Record<string, number | number[]>) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      allowLeaveRef.current = true;
      setIsSubmitting(true);
      mutation.mutate(payload);
    },
    [mutation],
  );

  const requestTerminate = useCallback(async () => {
    if (submittedRef.current || isSubmitting) return false;

    const currentAnswers = answersRef.current;
    const answered = Object.values(currentAnswers).filter(isAnswered).length;
    const unanswered = Math.max(0, questions.length - answered);

    const ok = await confirm({
      title: "Terminate this attempt?",
      description:
        unanswered > 0
          ? `Leaving ends this session and uses one attempt. ${unanswered} unanswered question(s) will stay unanswered and count against your score.`
          : "Leaving ends this session and uses one attempt. Your answers will be locked and scored.",
      confirmLabel: "Terminate attempt",
      cancelLabel: "Stay in attempt",
      tone: "destructive",
    });
    if (!ok) return false;

    submittedRef.current = true;
    allowLeaveRef.current = true;
    setIsSubmitting(true);
    try {
      await submit({ data: { attemptId, answers: currentAnswers } });
      await navigate({
        to: "/results/$attemptId",
        params: { attemptId },
        ignoreBlocker: true,
        replace: true,
      });
      return true;
    } catch (err) {
      submittedRef.current = false;
      allowLeaveRef.current = false;
      setIsSubmitting(false);
      toast.error(err instanceof Error ? err.message : "Could not terminate attempt");
      return false;
    }
  }, [attemptId, confirm, isSubmitting, navigate, questions.length, submit]);

  useBlocker({
    disabled: !isLiveAttempt || isSubmitting || submittedRef.current,
    enableBeforeUnload: () =>
      isLiveAttempt && !allowLeaveRef.current && !submittedRef.current && !isSubmitting,
    shouldBlockFn: async () => {
      if (allowLeaveRef.current || submittedRef.current || isSubmitting || !isLiveAttempt) {
        return false;
      }
      // Terminate (submit) then cancel the original destination — we go to results.
      await requestTerminate();
      return true;
    },
  });

  const deadline = data && !data.submitted ? data.deadline : null;

  useEffect(() => {
    if (!deadline) return;
    const tick = () => {
      const left = Math.max(0, Math.round((new Date(deadline).getTime() - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) doSubmit(answersRef.current);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline, doSubmit]);

  useEffect(() => {
    if (data && data.submitted) {
      allowLeaveRef.current = true;
      void navigate({
        to: "/results/$attemptId",
        params: { attemptId },
        ignoreBlocker: true,
        replace: true,
      });
    }
  }, [data, attemptId, navigate]);

  useEffect(() => {
    questionHeadingRef.current?.focus({ preventScroll: true });
  }, [index]);

  if (isPending) return <PageLoader />;
  if (error || !data) {
    return (
      <div className="surface-paper p-8 text-center" role="alert">
        <p className="font-display text-xl">Attempt unavailable</p>
        <p className="mt-2 text-base text-muted-foreground">
          {error instanceof Error ? error.message : "This attempt could not be loaded."}
        </p>
      </div>
    );
  }
  if (data.submitted) return <PageLoader />;

  const question = questions[index];
  const answeredCount = Object.values(answers).filter(isAnswered).length;
  const progressPct =
    questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;
  const lowTime = remaining != null && remaining <= 60;
  const timePct =
    remaining != null && data.exam.duration > 0
      ? Math.min(100, Math.round((remaining / (data.exam.duration * 60)) * 100))
      : null;

  const goTo = (next: number) => {
    setIndex(Math.max(0, Math.min(questions.length - 1, next)));
  };

  const handleSubmit = () => {
    void (async () => {
      const unanswered = questions.length - answeredCount;
      const ok = await confirm({
        title: "Submit this assessment?",
        description:
          unanswered > 0
            ? `${unanswered} question(s) unanswered. Are you sure you want to submit? Answers cannot be changed after submit.`
            : "Are you sure you want to submit this assessment? Answers cannot be changed after submit.",
        confirmLabel: unanswered > 0 ? "Submit anyway" : "Submit assessment",
        tone: "destructive",
      });
      if (!ok) return;
      doSubmit(answers);
    })();
  };

  const handleExit = () => {
    void requestTerminate();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 font-sans">
      <SubmitScoringOverlay active={isSubmitting || mutation.isPending} />

      <a
        href="#attempt-question"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-24 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to current question
      </a>

      <header className="surface-paper sticky top-20 z-30 flex flex-wrap items-center justify-between gap-4 border border-border px-5 py-4 shadow-sm sm:px-6">
        <div className="min-w-0 flex-1 pr-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {data.exam.topic}
          </p>
          <h1 className="mt-1 truncate text-lg font-semibold leading-tight text-foreground sm:text-xl">
            {data.exam.title}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 tabular-nums",
              lowTime
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-border bg-secondary/60 text-foreground",
            )}
            aria-live={lowTime ? "assertive" : "polite"}
            aria-atomic="true"
          >
            <Clock3 className="h-4 w-4 shrink-0" aria-hidden />
            <span className="text-xs font-medium uppercase tracking-wide opacity-80">Time</span>
            <span className="font-display text-xl leading-none font-semibold">
              {remaining == null ? "—" : formatClock(remaining)}
            </span>
          </div>
          <button
            type="button"
            onClick={handleExit}
            disabled={mutation.isPending || isSubmitting}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border-2 border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Exit attempt
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={mutation.isPending || isSubmitting}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="h-4 w-4" aria-hidden />
            {mutation.isPending || isSubmitting ? "Submitting…" : "Submit assessment"}
          </button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-8 lg:items-start">
        <div className="min-w-0 space-y-5">
          {question ? (
            <article
              id="attempt-question"
              className="surface-paper border border-border px-5 py-6 sm:px-7 sm:py-8"
              aria-labelledby={promptId}
            >
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="rounded-md bg-secondary px-2.5 py-1 text-xs font-semibold tracking-wide text-foreground uppercase">
                  Question {index + 1} of {questions.length}
                </span>
                {question.subtopic ? (
                  <span className="text-sm font-medium text-muted-foreground">
                    {question.subtopic}
                  </span>
                ) : null}
                {question.multiSelect ? (
                  <span className="rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                    Select all that apply
                  </span>
                ) : (
                  <span className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    Choose one answer
                  </span>
                )}
              </div>

              <h2
                id={promptId}
                ref={questionHeadingRef}
                tabIndex={-1}
                className="mt-5 scroll-mt-36 text-xl font-semibold leading-snug tracking-tight text-foreground outline-none sm:text-2xl sm:leading-snug"
              >
                {question.prompt}
              </h2>
              {question.imageUrl ? (
                <img
                  src={question.imageUrl}
                  alt="Question prompt reference"
                  className="mt-4 w-full max-w-2xl rounded-lg border border-border object-contain"
                  loading="lazy"
                />
              ) : null}

              <div
                className="mt-7 space-y-3"
                role={question.multiSelect ? "group" : "radiogroup"}
                aria-labelledby={optionsLabelId}
              >
                <p id={optionsLabelId} className="sr-only">
                  {question.multiSelect ? "Select all options that apply" : "Select one option"}
                </p>
                {question.options.map((option, optionIndex) => {
                  const selected = isOptionSelected(answers[question.id], optionIndex);
                  const optionLetter = String.fromCharCode(65 + optionIndex);
                  return (
                    <button
                      key={optionIndex}
                      type="button"
                      role={question.multiSelect ? "checkbox" : "radio"}
                      aria-checked={selected}
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
                        "flex w-full min-h-14 items-start gap-3.5 rounded-xl border-2 px-4 py-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        selected
                          ? "border-accent bg-accent/12 shadow-sm"
                          : "border-border bg-card hover:border-foreground/20 hover:bg-secondary/40",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center border-2 text-sm font-bold",
                          question.multiSelect ? "rounded-md" : "rounded-full",
                          selected
                            ? "border-accent bg-accent text-accent-foreground"
                            : "border-border bg-background text-foreground",
                        )}
                        aria-hidden
                      >
                        {optionLetter}
                      </span>
                      <span className="min-w-0 flex-1 pt-1 text-base leading-relaxed text-foreground">
                        {option}
                      </span>
                      {selected ? <span className="sr-only">Selected</span> : null}
                    </button>
                  );
                })}
              </div>
            </article>
          ) : null}

          <nav
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-3 sm:px-4"
            aria-label="Question navigation"
          >
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border-2 border-input bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Previous
            </button>
            <p className="hidden text-sm font-medium tabular-nums text-muted-foreground sm:block">
              {index + 1} / {questions.length}
            </p>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              disabled={index >= questions.length - 1}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border-2 border-primary bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </nav>
        </div>

        <aside
          className="surface-paper space-y-6 border border-border px-5 py-5 lg:sticky lg:top-[8.75rem] lg:self-start"
          aria-label="Attempt status"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Time left
              </p>
              {lowTime ? (
                <span className="rounded-md bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
                  Low time
                </span>
              ) : null}
            </div>
            <p
              className={cn(
                "mt-2 font-display text-4xl font-semibold tabular-nums leading-none",
                lowTime && "text-destructive",
              )}
              aria-hidden
            >
              {remaining == null ? "—" : formatClock(remaining)}
            </p>
            {timePct != null ? (
              <div
                className="mt-4 h-2.5 overflow-hidden rounded-full bg-secondary"
                role="progressbar"
                aria-label="Time remaining"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={timePct}
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500",
                    lowTime ? "bg-destructive" : "bg-accent",
                  )}
                  style={{ width: `${Math.max(timePct, 2)}%` }}
                />
              </div>
            ) : null}
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Progress
              </p>
              <p className="font-display text-xl font-semibold tabular-nums">
                {answeredCount}/{questions.length}
              </p>
            </div>
            <div
              className="mt-3 h-2.5 overflow-hidden rounded-full bg-secondary"
              role="progressbar"
              aria-label="Questions answered"
              aria-valuemin={0}
              aria-valuemax={questions.length}
              aria-valuenow={answeredCount}
            >
              <div
                className="h-full rounded-full bg-success transition-[width] duration-300"
                style={{ width: `${Math.max(progressPct, answeredCount > 0 ? 4 : 0)}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{progressPct}% answered</p>
          </div>

          <div>
            <p
              id="question-map-label"
              className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
              Question map
            </p>
            <div className="flex flex-wrap gap-2" role="list" aria-labelledby="question-map-label">
              {questions.map((q, i) => {
                const answered = isAnswered(answers[q.id]);
                const current = i === index;
                return (
                  <button
                    key={q.id}
                    type="button"
                    role="listitem"
                    onClick={() => goTo(i)}
                    aria-label={`Question ${i + 1}${current ? ", current" : ""}${answered ? ", answered" : ", unanswered"}`}
                    aria-current={current ? "true" : undefined}
                    className={cn(
                      "inline-flex h-10 w-10 items-center justify-center rounded-lg border-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      current
                        ? "border-accent bg-accent text-accent-foreground shadow-sm"
                        : answered
                          ? "border-success/50 bg-success/15 text-success"
                          : "border-border bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground",
                    )}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm border-2 border-accent bg-accent" aria-hidden />
                Current
              </li>
              <li className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-sm border-2 border-success/50 bg-success/15"
                  aria-hidden
                />
                Answered
              </li>
              <li className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm border-2 border-border bg-card" aria-hidden />
                Unanswered
              </li>
            </ul>
          </div>

          <dl className="space-y-3 border-t border-border pt-5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Topic</dt>
              <dd className="truncate text-right font-semibold text-foreground">
                {data.exam.topic}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Duration</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {data.exam.duration} min
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Current</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {index + 1} / {questions.length}
              </dd>
            </div>
          </dl>
        </aside>
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
