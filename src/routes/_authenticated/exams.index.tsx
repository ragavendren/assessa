import { EmptyState, PageLoader, ScorePill, SectionHeading } from "@/components/platform";
import { MODE_LABELS, formatDate, type ExamMode } from "@/lib/gamification";
import { listMyExams } from "@/lib/platform.functions";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/exams/")({
  head: () => ({
    meta: [
      { title: "My Exams — Assessa" },
      {
        name: "description",
        content:
          "Available, upcoming, in-progress and completed assessments with attempts remaining and best scores.",
      },
      { property: "og:title", content: "My Exams — Assessa" },
      {
        property: "og:description",
        content: "Every assessment assigned to you, with attempts and results.",
      },
    ],
  }),
  component: MyExams,
});

const FILTERS = ["all", "available", "upcoming", "in_progress", "completed"] as const;
const FILTER_LABELS: Record<(typeof FILTERS)[number], string> = {
  all: "All",
  available: "Available",
  upcoming: "Upcoming",
  in_progress: "In progress",
  completed: "Completed",
};

function MyExams() {
  const fetchExams = useServerFn(listMyExams);
  const { data, isPending } = useQuery({ queryKey: ["my-exams"], queryFn: () => fetchExams() });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");

  if (isPending || !data) return <PageLoader />;

  const visible = data.filter((exam) => (filter === "all" ? true : exam.status === filter));

  return (
    <div>
      <SectionHeading eyebrow="Assessments" title="My exams" />

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((value) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={
              "rounded-full px-3.5 py-1.5 text-sm transition-colors " +
              (filter === value
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground hover:text-foreground")
            }
          >
            {FILTER_LABELS[value]}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon="🗂"
          title="Nothing here yet"
          body="Assessments you can take — public or invited — will show up in this list."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((exam) => (
            <article key={exam.id} className="surface-paper flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-hairline text-muted-foreground">{exam.topic}</p>
                  <h3 className="mt-1 font-display text-xl">{exam.title}</h3>
                </div>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">
                  {MODE_LABELS[exam.mode as ExamMode] ?? exam.mode}
                </span>
              </div>

              {exam.description ? (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {exam.description}
                </p>
              ) : null}

              <dl className="mt-4 grid grid-cols-3 gap-3 text-xs">
                <div>
                  <dt className="text-muted-foreground">Questions</dt>
                  <dd className="mt-0.5 font-semibold">{exam.questionCount}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Duration</dt>
                  <dd className="mt-0.5 font-semibold">{exam.duration} min</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Pass mark</dt>
                  <dd className="mt-0.5 font-semibold">{exam.passMark}%</dd>
                </div>
              </dl>

              <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                <span>
                  Attempts {exam.attemptsUsed}/{exam.maxAttempts}
                </span>
                {exam.bestScore != null ? (
                  <ScorePill score={exam.bestScore} passed={exam.bestPassed} />
                ) : null}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                {exam.status === "upcoming" ? (
                  <span className="text-sm text-muted-foreground">
                    Opens {formatDate(exam.startsAt)}
                  </span>
                ) : exam.status === "in_progress" ? (
                  <Link
                    to="/attempt/$attemptId"
                    params={{ attemptId: exam.inProgressId ?? "" }}
                    className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90"
                  >
                    Resume attempt
                  </Link>
                ) : exam.attemptsLeft > 0 ? (
                  <Link
                    to="/exams/$examId"
                    params={{ examId: exam.id }}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    {exam.attemptsUsed > 0 ? "Retake" : "Start assessment"}
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground">No attempts remaining</span>
                )}

                {exam.lastAttemptId ? (
                  <Link
                    to="/results/$attemptId"
                    params={{ attemptId: exam.lastAttemptId }}
                    className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-secondary"
                  >
                    View result
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
