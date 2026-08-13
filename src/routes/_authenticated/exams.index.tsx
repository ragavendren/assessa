import { ListToolbar, listViewClass, useListViewMode } from "@/components/ListToolbar";
import { EmptyState, PageLoader, ScorePill, SectionHeading } from "@/components/platform";
import { MODE_LABELS, formatDate, type ExamMode } from "@/lib/gamification";
import { listMyExams } from "@/lib/platform.functions";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

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

const FILTERS = ["all", "available", "upcoming", "in_progress", "completed", "closed"] as const;
const FILTER_LABELS: Record<(typeof FILTERS)[number], string> = {
  all: "All",
  available: "Available",
  upcoming: "Upcoming",
  in_progress: "In progress",
  completed: "Completed",
  closed: "Closed",
};

type ExamItem = Awaited<ReturnType<typeof listMyExams>>[number];

function MyExams() {
  const fetchExams = useServerFn(listMyExams);
  const { data, isPending } = useQuery({
    queryKey: ["my-exams"],
    queryFn: () => fetchExams(),
  });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useListViewMode("my-exams", "grid");

  const counts = useMemo(() => {
    const base = {
      all: 0,
      available: 0,
      upcoming: 0,
      in_progress: 0,
      completed: 0,
      closed: 0,
    };
    for (const exam of data ?? []) {
      base.all += 1;
      base[exam.status] += 1;
    }
    return base;
  }, [data]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((exam) => {
      if (filter !== "all" && exam.status !== filter) return false;
      if (!q) return true;
      return (
        exam.title.toLowerCase().includes(q) ||
        exam.topic.toLowerCase().includes(q) ||
        (exam.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, filter, search]);

  if (isPending || !data) return <PageLoader />;

  return (
    <div>
      <SectionHeading eyebrow="Assessments" title="My exams" />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by title, topic…"
        filters={FILTERS.map((value) => ({
          value,
          label: FILTER_LABELS[value],
          count: counts[value],
        }))}
        filter={filter}
        onFilterChange={setFilter}
        view={view}
        onViewChange={setView}
      />

      {visible.length === 0 ? (
        <EmptyState
          icon="🗂"
          title="Nothing here yet"
          body="Assessments you can take — public or invited — will show up in this list."
        />
      ) : view === "table" ? (
        <div className="surface-paper overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Assessment</th>
                <th className="p-3 font-medium">Mode</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Attempts</th>
                <th className="p-3 font-medium">Best</th>
                <th className="p-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((exam) => (
                <tr key={exam.id} className="align-top">
                  <td className="p-3">
                    <p className="font-medium">{exam.title}</p>
                    <p className="text-xs text-muted-foreground">{exam.topic}</p>
                  </td>
                  <td className="p-3">{MODE_LABELS[exam.mode as ExamMode] ?? exam.mode}</td>
                  <td className="p-3 capitalize">{exam.status.replace("_", " ")}</td>
                  <td className="p-3 tabular-nums">
                    {exam.attemptsUsed}/{exam.maxAttempts}
                  </td>
                  <td className="p-3">
                    {exam.bestScore != null ? (
                      <ScorePill score={exam.bestScore} passed={exam.bestPassed} />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3">
                    <ExamActions exam={exam} compact />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={listViewClass(view)}>
          {visible.map((exam) => (
            <ExamCard key={exam.id} exam={exam} dense={view === "grid"} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExamCard({ exam, dense }: { exam: ExamItem; dense?: boolean }) {
  return (
    <article className={cn("surface-paper flex flex-col", dense ? "p-5" : "p-6")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-hairline text-muted-foreground">{exam.topic}</p>
          <h3 className={cn("mt-1 font-display", dense ? "text-xl" : "text-2xl")}>{exam.title}</h3>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">
          {MODE_LABELS[exam.mode as ExamMode] ?? exam.mode}
        </span>
      </div>

      {exam.description ? (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{exam.description}</p>
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

      <div className="mt-5">
        <ExamActions exam={exam} />
      </div>
    </article>
  );
}

function ExamActions({ exam, compact }: { exam: ExamItem; compact?: boolean }) {
  const btn = compact
    ? "rounded-md border border-input px-2.5 py-1 text-xs font-medium hover:bg-secondary"
    : "rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-secondary";
  const primary = compact
    ? "rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
    : "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90";
  const accent = compact
    ? "rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground hover:bg-accent/90"
    : "rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {exam.status === "upcoming" ? (
        <span className="text-sm text-muted-foreground">Opens {formatDate(exam.startsAt)}</span>
      ) : exam.status === "closed" ? (
        <span className="text-sm text-muted-foreground">
          Closed{exam.endsAt ? ` ${formatDate(exam.endsAt)}` : ""}
        </span>
      ) : exam.status === "in_progress" ? (
        <Link
          to="/attempt/$attemptId"
          params={{ attemptId: exam.inProgressId ?? "" }}
          className={accent}
        >
          Resume
        </Link>
      ) : exam.attemptsLeft > 0 ? (
        <Link to="/exams/$examId" params={{ examId: exam.id }} className={primary}>
          {exam.attemptsUsed > 0 ? "Retake" : "Start"}
        </Link>
      ) : (
        <span className="text-sm text-muted-foreground">No attempts left</span>
      )}

      {exam.lastAttemptId ? (
        <Link to="/results/$attemptId" params={{ attemptId: exam.lastAttemptId }} className={btn}>
          Result
        </Link>
      ) : null}
    </div>
  );
}
