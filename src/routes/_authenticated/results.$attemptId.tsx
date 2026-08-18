import { BadgeMark } from "@/components/BadgeMark";
import { MasteryBar, PageLoader, ScorePill } from "@/components/platform";
import { ResultCelebration } from "@/components/ResultCelebration";
import { formatDuration } from "@/lib/gamification";
import { getResult } from "@/lib/platform.functions";
import { cn } from "@/lib/utils";
import { flyXpOnce } from "@/lib/xp-fly";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, CircleHelp, Lightbulb, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

export const Route = createFileRoute("/_authenticated/results/$attemptId")({
  head: () => ({
    meta: [
      { title: "Your result — Assessa" },
      {
        name: "description",
        content:
          "Score, pass status, XP earned, badges unlocked and answer review for your attempt.",
      },
      { property: "og:title", content: "Your result — Assessa" },
      {
        property: "og:description",
        content: "Your assessment score, XP and badges.",
      },
    ],
  }),
  component: ResultPage,
});

type ReviewItem = {
  id: string;
  prompt: string;
  imageUrl?: string | null;
  options: string[];
  correctIndex: number;
  correctIndexes: number[];
  multiSelect: boolean;
  explanation: string | null;
  subtopic: string | null;
  givenIndex: number | null;
  givenIndexes: number[];
};

function ResultPage() {
  const { attemptId } = Route.useParams();
  const fetchResult = useServerFn(getResult);
  const { data, isPending, error } = useQuery({
    queryKey: ["result", attemptId],
    queryFn: () => fetchResult({ data: { attemptId } }),
    retry: false,
  });
  const [revealed, setRevealed] = useState(false);
  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState(1);
  const xpOriginRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!data) return;
    setRevealed(false);
    setPage(1);
    const timer = window.setTimeout(() => setRevealed(true), 120);
    const xp = (data.gains ?? []).reduce((sum, gain) => sum + gain.points, 0);
    if (xp > 0) {
      window.setTimeout(() => flyXpOnce(`exam:${attemptId}`, xp, xpOriginRef.current), 400);
    }
    return () => window.clearTimeout(timer);
  }, [data, attemptId]);

  const reviewStats = useMemo(() => {
    const review = (data?.review ?? []) as ReviewItem[];
    let correct = 0;
    let incorrect = 0;
    let skipped = 0;
    for (const item of review) {
      const status = reviewStatus(item);
      if (status === "correct") correct += 1;
      else if (status === "skipped") skipped += 1;
      else incorrect += 1;
    }
    return { correct, incorrect, skipped, total: review.length };
  }, [data?.review]);

  const review = useMemo(() => (data?.review ?? []) as ReviewItem[], [data?.review]);
  const totalPages = Math.max(1, Math.ceil(review.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return review.slice(start, start + pageSize);
  }, [review, currentPage, pageSize]);
  const rangeStart = review.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, review.length);

  if (isPending) return <PageLoader label="Preparing your result…" />;
  if (error || !data) {
    return (
      <div className="surface-paper p-8 text-center">
        <p className="font-display text-xl">Result unavailable</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "This result could not be loaded."}
        </p>
      </div>
    );
  }

  const { attempt, exam } = data;

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <div
        className={cn(
          "transition-all duration-500",
          revealed ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        )}
      >
        <ResultCelebration
          passed={!!attempt.passed}
          score={attempt.score ?? 0}
          title={exam.title}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-stretch">
        <div className="animate-brand-rise-delayed surface-paper flex flex-col justify-center px-6 py-6 sm:px-8 sm:py-7">
          <p className="text-hairline text-muted-foreground">Score summary</p>
          <div className="mt-4">
            <ScorePill score={attempt.score} passed={attempt.passed} />
          </div>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg bg-secondary/50 px-3.5 py-3">
              <dt className="text-xs text-muted-foreground">Correct</dt>
              <dd className="mt-1 font-display text-xl tabular-nums">
                {attempt.correctCount}/{attempt.total}
              </dd>
            </div>
            <div className="rounded-lg bg-secondary/50 px-3.5 py-3">
              <dt className="text-xs text-muted-foreground">Pass mark</dt>
              <dd className="mt-1 font-display text-xl tabular-nums">{exam.passMark}%</dd>
            </div>
            <div className="rounded-lg bg-secondary/50 px-3.5 py-3">
              <dt className="text-xs text-muted-foreground">Duration</dt>
              <dd className="mt-1 font-medium">{formatDuration(attempt.durationSeconds)}</dd>
            </div>
            {data.rank ? (
              <div className="rounded-lg bg-secondary/50 px-3.5 py-3">
                <dt className="text-xs text-muted-foreground">Rank</dt>
                <dd className="mt-1 font-medium">
                  #{data.rank.rank} of {data.rank.total}
                </dd>
              </div>
            ) : (
              <div className="rounded-lg bg-secondary/50 px-3.5 py-3">
                <dt className="text-xs text-muted-foreground">Topic</dt>
                <dd className="mt-1 truncate font-medium">{exam.topic}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="grid gap-5">
          {data.gains.length > 0 ? (
            <div
              className="animate-achievement-card surface-paper flex h-full flex-col px-6 py-6"
              style={{ animationDelay: "80ms" }}
            >
              <p className="text-hairline text-muted-foreground">XP earned</p>
              <ul ref={xpOriginRef} className="mt-4 flex-1 space-y-2.5 text-sm">
                {data.gains.map((gain) => (
                  <li key={gain.label} className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{gain.label}</span>
                    <span className="shrink-0 font-semibold text-accent">+{gain.points} XP</span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
                Level {data.level.level} · {data.level.name} ·{" "}
                {data.level.nextLevel
                  ? `${data.level.xpToNext} XP to Level ${data.level.nextLevel}`
                  : "Max level"}
              </p>
            </div>
          ) : (
            <div className="animate-brand-rise-delayed surface-paper px-6 py-6">
              <p className="text-hairline text-muted-foreground">Topic</p>
              <p className="mt-2 font-display text-xl">{exam.topic}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Review your answers below to reinforce what you learned.
              </p>
            </div>
          )}
        </div>
      </div>

      {(data.career ?? []).length > 0 ? (
        <div
          className="animate-brand-rise-delayed surface-paper space-y-3 px-6 py-6 sm:px-8"
          style={{ animationDelay: "100ms" }}
        >
          <p className="text-hairline text-muted-foreground">Career readiness</p>
          <p className="text-sm text-muted-foreground">
            Skill bands from this assessment&apos;s topic coverage.
          </p>
          <div className="mt-2 space-y-3">
            {(data.career ?? []).map((domain) => (
              <MasteryBar key={domain.topic} label={domain.topic} value={domain.mastery} />
            ))}
          </div>
          <Link to="/play/topics" className="inline-block text-sm text-accent underline">
            Practice weak topics in Play →
          </Link>
        </div>
      ) : null}

      {data.newBadges.length > 0 ? (
        <div
          className="animate-achievement-card surface-paper px-6 py-6 sm:px-7"
          style={{ animationDelay: "140ms" }}
        >
          <p className="text-hairline text-muted-foreground">New badges unlocked</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {data.newBadges.map((badge, index) => (
              <div
                key={badge.code}
                className="flex items-start gap-3.5 rounded-xl border border-border/70 bg-secondary/50 p-4"
              >
                <BadgeMark
                  icon={badge.icon}
                  code={badge.code}
                  name={badge.name}
                  track={badge.track}
                  size="lg"
                  className="animate-medal-pop"
                />
                <div className="min-w-0">
                  <p className="font-medium">{badge.name}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {badge.description}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-accent">+{badge.xp} XP</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {review.length > 0 ? (
        <section id="answer-review" className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-hairline text-muted-foreground">Answer review</p>
              <h2 className="mt-1 font-display text-2xl tracking-tight">How you did</h2>
              <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
                Compare your choices with the correct answers. Explanations sit beside each question
                for quicker reading.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap gap-2 text-xs font-medium">
                <span className="rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-success">
                  {reviewStats.correct} correct
                </span>
                <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-destructive">
                  {reviewStats.incorrect} incorrect
                </span>
                {reviewStats.skipped > 0 ? (
                  <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-muted-foreground">
                    {reviewStats.skipped} skipped
                  </span>
                ) : null}
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="whitespace-nowrap">Per page</span>
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                  }}
                  className="rounded-md border border-input bg-card px-2.5 py-1.5 text-sm font-medium text-foreground"
                >
                  {[5, 10, 15, 20].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="space-y-5">
            {pageItems.map((item, index) => {
              const absoluteIndex = (currentPage - 1) * pageSize + index;
              return (
                <ReviewCard
                  key={item.id}
                  item={item}
                  index={absoluteIndex}
                  style={{ animationDelay: `${120 + index * 40}ms` }}
                />
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3.5 sm:px-5">
            <p className="text-sm text-muted-foreground">
              Showing{" "}
              <span className="font-medium text-foreground">
                {rangeStart}–{rangeEnd}
              </span>{" "}
              of <span className="font-medium text-foreground">{review.length}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPage((p) => Math.max(1, p - 1));
                  document.getElementById("answer-review")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }}
                disabled={currentPage <= 1}
                className="rounded-md border border-input px-3.5 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
              >
                Previous
              </button>
              <span className="min-w-[5.5rem] text-center text-sm tabular-nums text-muted-foreground">
                Page {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => {
                  setPage((p) => Math.min(totalPages, p + 1));
                  document.getElementById("answer-review")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }}
                disabled={currentPage >= totalPages}
                className="rounded-md border border-input px-3.5 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          Answer review is disabled for this assessment mode.
        </p>
      )}

      <div className="flex flex-wrap gap-3 border-t border-border pt-8">
        <Link
          to="/exams"
          className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Back to my exams
        </Link>
        {attempt.passed ? (
          <Link
            to="/achievements"
            className="rounded-md border border-input px-4 py-2.5 text-sm font-medium hover:bg-secondary"
          >
            View achievements
          </Link>
        ) : (
          <Link
            to="/exams/$examId"
            params={{ examId: exam.id }}
            className="rounded-md border border-input px-4 py-2.5 text-sm font-medium hover:bg-secondary"
          >
            Try again
          </Link>
        )}
        {exam.enableLeaderboard ? (
          <Link
            to="/leaderboard"
            search={{ examId: exam.id }}
            className="rounded-md border border-input px-4 py-2.5 text-sm font-medium hover:bg-secondary"
          >
            View leaderboard
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function ReviewCard({
  item,
  index,
  style,
}: {
  item: ReviewItem;
  index: number;
  style?: CSSProperties;
}) {
  const status = reviewStatus(item);
  const correctSet = new Set(item.correctIndexes ?? [item.correctIndex]);
  const givenSet = new Set(item.givenIndexes ?? (item.givenIndex != null ? [item.givenIndex] : []));

  return (
    <article
      className={cn(
        "animate-achievement-card overflow-hidden rounded-xl border bg-card",
        status === "correct" && "border-success/35",
        status === "incorrect" && "border-destructive/35",
        status === "skipped" && "border-border",
      )}
      style={style}
    >
      <header
        className={cn(
          "flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4 sm:px-6 sm:py-5",
          status === "correct" && "border-success/20 bg-success/8",
          status === "incorrect" && "border-destructive/20 bg-destructive/8",
          status === "skipped" && "border-border bg-secondary/40",
        )}
      >
        <div className="min-w-0 flex-1 pr-2">
          <p className="text-xs text-muted-foreground">
            Question {index + 1}
            {item.subtopic ? ` · ${item.subtopic}` : ""}
            {item.multiSelect ? " · select all that apply" : ""}
          </p>
          <h3 className="mt-2 text-base font-medium leading-snug sm:text-lg">{item.prompt}</h3>
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt="Question prompt reference"
              className="mt-3 w-full max-w-xl rounded-md border border-border object-contain"
              loading="lazy"
            />
          ) : null}
        </div>
        <StatusBadge status={status} />
      </header>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.9fr)]">
        <div className="space-y-2.5 border-border px-5 py-5 sm:px-6 sm:py-6 lg:border-r">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Options
          </p>
          {item.options.map((option, optionIndex) => {
            const isCorrect = correctSet.has(optionIndex);
            const isGiven = givenSet.has(optionIndex);
            const tone = optionTone(isCorrect, isGiven);

            return (
              <div
                key={optionIndex}
                className={cn(
                  "flex items-start gap-3 rounded-lg border px-3.5 py-3 text-sm leading-relaxed",
                  tone === "correct" && "border-success/45 bg-success/12 text-foreground",
                  tone === "wrong" && "border-destructive/45 bg-destructive/10 text-foreground",
                  tone === "missed" && "border-success/30 bg-success/6 text-foreground",
                  tone === "neutral" && "border-border/80 bg-background text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border text-[11px] font-semibold",
                    item.multiSelect ? "rounded-md" : "rounded-full",
                    tone === "correct" && "border-success bg-success text-success-foreground",
                    tone === "wrong" &&
                      "border-destructive bg-destructive text-destructive-foreground",
                    tone === "missed" && "border-success/60 bg-success/20 text-success",
                    tone === "neutral" && "border-border bg-card",
                  )}
                >
                  {String.fromCharCode(65 + optionIndex)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn(tone !== "neutral" && "font-medium")}>{option}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {isCorrect ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                        <Check className="h-3 w-3" aria-hidden />
                        Correct answer
                      </span>
                    ) : null}
                    {isGiven && !isCorrect ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                        <X className="h-3 w-3" aria-hidden />
                        Your answer
                      </span>
                    ) : null}
                    {isGiven && isCorrect ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                        <Check className="h-3 w-3" aria-hidden />
                        Your answer
                      </span>
                    ) : null}
                    {isCorrect && !isGiven && givenSet.size > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                        Missed
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <aside
          className={cn(
            "flex flex-col border-t border-border px-5 py-5 sm:px-6 sm:py-6 lg:border-t-0",
            item.explanation ? "bg-accent/[0.06]" : "bg-secondary/25",
          )}
        >
          <p
            className={cn(
              "flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide",
              item.explanation ? "text-accent" : "text-muted-foreground",
            )}
          >
            <Lightbulb className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Explanation
          </p>
          {item.explanation ? (
            <p className="mt-3 flex-1 text-sm leading-relaxed text-foreground/90">
              {item.explanation}
            </p>
          ) : (
            <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
              No explanation was provided for this question. Use the highlighted options to see what
              was correct.
            </p>
          )}
          <div className="mt-5 space-y-2 border-t border-border/70 pt-4 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Correct: </span>
              {lettersFromIndexes([...correctSet])}
            </p>
            <p>
              <span className="font-medium text-foreground">Your pick: </span>
              {givenSet.size > 0 ? lettersFromIndexes([...givenSet]) : "Not answered"}
            </p>
          </div>
        </aside>
      </div>
    </article>
  );
}

function lettersFromIndexes(indexes: number[]) {
  return [...indexes]
    .sort((a, b) => a - b)
    .map((i) => String.fromCharCode(65 + i))
    .join(", ");
}

function StatusBadge({ status }: { status: "correct" | "incorrect" | "skipped" }) {
  if (status === "correct") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-success/35 bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
        <Check className="h-3.5 w-3.5" aria-hidden />
        Correct
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">
        <CircleHelp className="h-3.5 w-3.5" aria-hidden />
        Skipped
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-destructive/35 bg-destructive/15 px-2.5 py-1 text-xs font-semibold text-destructive">
      <X className="h-3.5 w-3.5" aria-hidden />
      Incorrect
    </span>
  );
}

function reviewStatus(item: ReviewItem): "correct" | "incorrect" | "skipped" {
  const given = [...(item.givenIndexes ?? [])].sort((a, b) => a - b);
  if (given.length === 0) return "skipped";
  const correct = [...(item.correctIndexes ?? [item.correctIndex])].sort((a, b) => a - b);
  if (given.length !== correct.length) return "incorrect";
  return given.every((value, i) => value === correct[i]) ? "correct" : "incorrect";
}

function optionTone(
  isCorrect: boolean,
  isGiven: boolean,
): "correct" | "wrong" | "missed" | "neutral" {
  if (isCorrect && isGiven) return "correct";
  if (!isCorrect && isGiven) return "wrong";
  if (isCorrect && !isGiven) return "missed";
  return "neutral";
}
