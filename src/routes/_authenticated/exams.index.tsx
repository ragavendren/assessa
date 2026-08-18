import { AssessaIcon } from "@/components/icons";
import { LeaderboardChip, LeaderboardHero } from "@/components/leaderboard/BoardStage";
import { ListToolbar, listViewClass, useListViewMode } from "@/components/ListToolbar";
import { EmptyState, Meter, PageLoader, ScorePill } from "@/components/platform";
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
      { title: "Assessments — Assessa" },
      {
        name: "description",
        content:
          "Available, upcoming, in-progress and completed assessments with attempts remaining and best scores.",
      },
      { property: "og:title", content: "Assessments — Assessa" },
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

  if (isPending || !data) return <PageLoader label="Loading assessments…" />;

  const ready = counts.available + counts.in_progress;

  return (
    <div className="space-y-6">
      <LeaderboardHero
        kicker="My assessments"
        title="Assessments"
        subtitle="Start, resume, or review every paper assigned to you — timed rules, attempts and best scores in one place."
        chips={
          <>
            <LeaderboardChip
              icon={<AssessaIcon name="play" className="h-3.5 w-3.5" />}
              label="Ready now"
              value={ready}
            />
            <LeaderboardChip
              icon={<AssessaIcon name="timer" className="h-3.5 w-3.5" />}
              label="In progress"
              value={counts.in_progress}
            />
            <LeaderboardChip
              icon={<AssessaIcon name="trophy" className="h-3.5 w-3.5" />}
              label="Completed"
              value={counts.completed}
            />
            <LeaderboardChip
              icon={<AssessaIcon name="list" className="h-3.5 w-3.5" />}
              label="All papers"
              value={counts.all}
            />
          </>
        }
      />

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
                  <td className="p-3">
                    <StatusPill status={exam.status} />
                  </td>
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
  const attemptPct =
    exam.maxAttempts > 0 ? Math.min(100, (exam.attemptsUsed / exam.maxAttempts) * 100) : 0;
  const live = exam.status === "available" || exam.status === "in_progress";
  const schedule =
    exam.status === "upcoming"
      ? `Opens ${formatDate(exam.startsAt)}`
      : exam.endsAt
        ? `Closes ${formatDate(exam.endsAt)}`
        : null;

  return (
    <article
      className={cn(
        "flex flex-col",
        live ? "surface-metal" : "surface-paper",
        exam.status === "in_progress" && "ring-1 ring-accent/40",
        dense ? "p-5" : "p-6",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-hairline text-muted-foreground">{exam.topic}</p>
          <h3 className={cn("mt-1 font-display", dense ? "text-xl" : "text-2xl")}>{exam.title}</h3>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusPill status={exam.status} />
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold">
            {MODE_LABELS[exam.mode as ExamMode] ?? exam.mode}
          </span>
        </div>
      </div>

      {exam.description ? (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{exam.description}</p>
      ) : null}

      <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-md bg-background/60 px-2.5 py-2">
          <dt className="text-muted-foreground">Questions</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{exam.questionCount}</dd>
        </div>
        <div className="rounded-md bg-background/60 px-2.5 py-2">
          <dt className="text-muted-foreground">Duration</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{exam.duration} min</dd>
        </div>
        <div className="rounded-md bg-background/60 px-2.5 py-2">
          <dt className="text-muted-foreground">Pass mark</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{exam.passMark}%</dd>
        </div>
      </dl>

      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Attempts {exam.attemptsUsed}/{exam.maxAttempts}
          </span>
          {exam.bestScore != null ? (
            <ScorePill score={exam.bestScore} passed={exam.bestPassed} />
          ) : null}
        </div>
        <Meter value={attemptPct} tone={exam.attemptsLeft > 0 ? "accent" : "muted"} />
      </div>

      {schedule ? <p className="mt-3 text-xs text-muted-foreground">{schedule}</p> : null}

      <div className="mt-5">
        <ExamActions exam={exam} />
      </div>
    </article>
  );
}

function StatusPill({ status }: { status: ExamItem["status"] }) {
  const tone =
    status === "available"
      ? "bg-success/12 text-success"
      : status === "in_progress"
        ? "bg-amber-500/15 text-amber-800"
        : status === "completed"
          ? "bg-primary/10 text-primary"
          : status === "upcoming"
            ? "bg-sky-500/12 text-sky-800"
            : "bg-muted text-muted-foreground";
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize", tone)}>
      {status.replace("_", " ")}
    </span>
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
