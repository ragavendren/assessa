import { AdminNav } from "@/components/AdminNav";
import {
  AdminAccessDenied,
  AdminEmpty,
  AdminPageHeader,
  RankMark,
  ResultCount,
  StatusPill,
} from "@/components/admin/AdminPageUi";
import { ListToolbar, listViewClass, useListViewMode } from "@/components/ListToolbar";
import { PodiumMedal } from "@/components/PodiumMedal";
import { EmptyState, Meter, PageLoader, StatTile } from "@/components/platform";
import { getAdminAssessmentPerformance } from "@/lib/admin.functions";
import { formatDuration, initials, MODE_LABELS, type ExamMode } from "@/lib/gamification";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Clock3, Hash, Target, Users } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

type PerformanceAssessment = NonNullable<
  Awaited<ReturnType<typeof getAdminAssessmentPerformance>>
>["assessments"][number];

type LeaderRow = PerformanceAssessment["leaderboard"][number];

export const Route = createFileRoute("/_authenticated/admin/performance")({
  head: () => ({
    meta: [
      { title: "Assessment performance — Assessa" },
      {
        name: "description",
        content:
          "Track opted participants, completion rate, pass rate and leaderboards for every assessment.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPerformancePage,
});

function AdminPerformancePage() {
  const fetchPerformance = useServerFn(getAdminAssessmentPerformance);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "published" | "inactive">("all");
  const [view, setView] = useListViewMode("admin-performance", "stack");

  const { data, isPending, error } = useQuery({
    queryKey: ["admin-performance"],
    queryFn: () => fetchPerformance(),
    retry: false,
  });

  const assessments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.assessments ?? []).filter((exam) => {
      if (status === "published" && !exam.active) return false;
      if (status === "inactive" && exam.active) return false;
      if (!q) return true;
      return (
        exam.title.toLowerCase().includes(q) ||
        exam.topic.toLowerCase().includes(q) ||
        exam.mode.toLowerCase().includes(q)
      );
    });
  }, [data?.assessments, search, status]);

  const selected = useMemo(() => {
    if (!assessments.length) return null;
    return assessments.find((exam) => exam.id === selectedId) ?? assessments[0] ?? null;
  }, [assessments, selectedId]);

  if (isPending) {
    return (
      <div>
        <AdminNav />
        <PageLoader label="Loading performance…" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div>
        <AdminNav />
        <AdminAccessDenied />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <AdminNav />
      <AdminPageHeader
        eyebrow="Analytics"
        title="Assessment performance"
        summary="See who opted in, who finished, and the best submitted score per participant. Admin accounts are excluded from leaderboards."
        help={{
          label: "How rates are calculated",
          body: "Completion is unique finishers ÷ unique starters. Pass rate uses submitted attempts against the paper’s pass mark.",
        }}
        action={
          <ResultCount shown={assessments.length} total={data.assessments.length} noun="papers" />
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatTile
          label="Assessments"
          value={data.totals.assessments}
          hint="All papers on the platform"
        />
        <StatTile
          label="Opted-in seats"
          value={data.totals.opted}
          hint="Unique starts across exams"
        />
        <StatTile
          label="Completed seats"
          value={data.totals.completed}
          hint="Unique finishers across exams"
        />
        <StatTile
          label="Avg completion"
          value={data.totals.averageCompletion}
          suffix="%"
          hint="Mean completion rate per paper"
        />
        <StatTile
          label="Avg pass rate"
          value={data.totals.averagePassRate}
          suffix="%"
          hint="Mean pass rate per paper"
        />
      </div>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search assessments…"
        filters={
          [
            { value: "all" as const, label: "All", count: data.assessments.length },
            {
              value: "published" as const,
              label: "Published",
              count: data.assessments.filter((e) => e.active).length,
            },
            {
              value: "inactive" as const,
              label: "Inactive",
              count: data.assessments.filter((e) => !e.active).length,
            },
          ] as const
        }
        filter={status}
        onFilterChange={setStatus}
        view={view}
        onViewChange={setView}
      />

      {assessments.length === 0 ? (
        <EmptyState
          icon="📊"
          title={data.assessments.length === 0 ? "No assessments yet" : "No match"}
          body={
            data.assessments.length === 0
              ? "Create and publish a paper to start tracking completion and pass rates."
              : "Try a different search or status filter."
          }
        />
      ) : (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.28fr)] lg:items-start">
          <section className={cn(view === "grid" ? listViewClass("grid") : "space-y-3")}>
            {view === "table" ? (
              <div className="surface-paper max-w-full overflow-hidden">
                <table className="w-full table-fixed text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="w-[34%] p-3 font-medium">Assessment</th>
                      <th className="w-[18%] p-3 font-medium">Completion</th>
                      <th className="w-[16%] p-3 font-medium">Pass</th>
                      <th className="w-[16%] p-3 font-medium">Attempts</th>
                      <th className="w-[16%] p-3 font-medium">Timer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {assessments.map((exam) => (
                      <tr
                        key={exam.id}
                        className={cn(
                          "cursor-pointer hover:bg-secondary/40",
                          selected?.id === exam.id && "bg-primary/5",
                        )}
                        onClick={() => setSelectedId(exam.id)}
                      >
                        <td className="p-3">
                          <p className="truncate font-medium">{exam.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{exam.topic}</p>
                        </td>
                        <td className="p-3">
                          <p className="tabular-nums">{exam.completionRate}%</p>
                          <Meter
                            className="mt-1.5 w-full max-w-[6rem]"
                            value={exam.completionRate}
                            tone={exam.completionRate >= 70 ? "success" : "accent"}
                          />
                        </td>
                        <td className="p-3">
                          <p className="tabular-nums">{exam.passRate}%</p>
                          <Meter
                            className="mt-1.5 w-full max-w-[6rem]"
                            value={exam.passRate}
                            tone={exam.passRate >= exam.passMark ? "success" : "accent"}
                          />
                        </td>
                        <td className="p-3">
                          <p className="tabular-nums">{exam.submittedAttempts}</p>
                          <p className="text-[11px] text-muted-foreground">
                            max {exam.maxAttempts}
                          </p>
                        </td>
                        <td className="p-3">
                          <p className="tabular-nums">
                            {formatDuration(exam.averageDurationSeconds)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            limit {exam.durationMinutes}m
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              assessments.map((exam) => {
                const active = selected?.id === exam.id;
                return (
                  <button
                    key={exam.id}
                    type="button"
                    onClick={() => setSelectedId(exam.id)}
                    className={cn(
                      "w-full rounded-md border p-4 text-left transition-colors",
                      active
                        ? "border-primary/40 bg-primary/5"
                        : "border-border bg-card hover:bg-secondary/40",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{exam.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {exam.topic} · {MODE_LABELS[exam.mode as ExamMode] ?? exam.mode}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusPill tone={exam.active ? "live" : "draft"}>
                          {exam.active ? "Published" : "Inactive"}
                        </StatusPill>
                        <StatusPill>pass {exam.passMark}%</StatusPill>
                        <StatusPill>{exam.durationMinutes}m</StatusPill>
                        <StatusPill>
                          {exam.maxAttempts === 1 ? "1 attempt" : `${exam.maxAttempts} attempts`}
                        </StatusPill>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                      <div>
                        <p className="text-muted-foreground">Opted</p>
                        <p className="font-semibold tabular-nums">{exam.opted}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Done</p>
                        <p className="font-semibold tabular-nums">{exam.completionRate}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Pass</p>
                        <p className="font-semibold tabular-nums">{exam.passRate}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Attempts</p>
                        <p className="font-semibold tabular-nums">{exam.submittedAttempts}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Avg time</p>
                        <p className="font-semibold tabular-nums">
                          {formatDuration(exam.averageDurationSeconds)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      <Meter
                        value={exam.completionRate}
                        tone={exam.completionRate >= 70 ? "success" : "accent"}
                      />
                      <Meter
                        value={exam.passRate}
                        tone={exam.passRate >= exam.passMark ? "success" : "muted"}
                      />
                    </div>
                  </button>
                );
              })
            )}
          </section>

          <PerformanceLeaderboardPanel exam={selected} />
        </div>
      )}
    </div>
  );
}

function PerformanceLeaderboardPanel({ exam }: { exam: PerformanceAssessment | null }) {
  if (!exam) {
    return (
      <section className="min-w-0 max-w-full surface-paper p-5 lg:sticky lg:top-20">
        <AdminEmpty title="Select an assessment" body="Pick a paper to open its leaderboard." />
      </section>
    );
  }

  const topThree = exam.leaderboard.filter((row) => row.rank <= 3);
  const rest = exam.leaderboard.filter((row) => row.rank > 3);
  const podiumOrder = [2, 1, 3]
    .map((rank) => topThree.find((row) => row.rank === rank))
    .filter((row): row is LeaderRow => Boolean(row));

  return (
    <section className="min-w-0 max-w-full space-y-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6.5rem)] lg:overflow-y-auto lg:pr-1">
      {/* Assessment header */}
      <div className="surface-paper overflow-hidden">
        <div className="border-b border-border/70 bg-secondary/25 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Assessment board
              </p>
              <h3 className="mt-1 font-display text-2xl leading-tight">{exam.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {exam.topic} · {MODE_LABELS[exam.mode as ExamMode] ?? exam.mode}
                {exam.inProgress ? ` · ${exam.inProgress} in progress` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusPill tone={exam.active ? "live" : "draft"}>
                {exam.active ? "Published" : "Inactive"}
              </StatusPill>
              <StatusPill>pass {exam.passMark}%</StatusPill>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MetricChip
              icon={<Users className="h-3.5 w-3.5" />}
              label="Opted"
              value={String(exam.opted)}
            />
            <MetricChip
              icon={<Target className="h-3.5 w-3.5" />}
              label="Completed"
              value={`${exam.completed} · ${exam.completionRate}%`}
            />
            <MetricChip
              icon={<Hash className="h-3.5 w-3.5" />}
              label="Attempts"
              value={`${exam.submittedAttempts}`}
              hint={`max ${exam.maxAttempts}`}
            />
            <MetricChip
              icon={<Clock3 className="h-3.5 w-3.5" />}
              label="Avg time"
              value={formatDuration(exam.averageDurationSeconds)}
              hint={`limit ${exam.durationMinutes}m`}
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <RateBar
              label="Completion"
              value={exam.completionRate}
              tone={exam.completionRate >= 70 ? "success" : "accent"}
            />
            <RateBar
              label="Pass rate"
              value={exam.passRate}
              tone={exam.passRate >= exam.passMark ? "success" : "accent"}
              hint={`mark ${exam.passMark}% · avg best ${exam.averageBestScore}%`}
            />
          </div>
        </div>
      </div>

      {/* Leaderboard body */}
      <div className="surface-paper overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-3">
          <div>
            <p className="text-sm font-semibold">Leaderboard</p>
            <p className="text-xs text-muted-foreground">
              Best score per participant · fewer attempts rank higher
            </p>
          </div>
          <p className="text-xs tabular-nums text-muted-foreground">
            {exam.leaderboard.length} ranked
          </p>
        </div>

        {exam.leaderboard.length === 0 ? (
          <div className="px-5 py-10">
            <AdminEmpty
              title="No submitted attempts yet"
              body="Ranks appear once participants finish this paper."
            />
          </div>
        ) : (
          <div className="space-y-4 p-4 sm:p-5">
            {podiumOrder.length > 0 ? (
              <div className="rounded-[var(--radius-md)] border border-border/80 bg-[linear-gradient(165deg,#0f172a_0%,#1e293b_55%,#0f172a_100%)] p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-amber-200/70">
                    Podium
                  </p>
                  <p className="text-[11px] text-slate-400">Gold · Silver · Bronze</p>
                </div>
                <div className="grid items-end gap-3 sm:grid-cols-3">
                  {podiumOrder.map((row) => (
                    <PodiumLeaderCard key={row.userId} row={row} />
                  ))}
                </div>
              </div>
            ) : null}

            {rest.length > 0 ? (
              <ul className="space-y-2">
                <li className="hidden grid-cols-[2.5rem_minmax(0,1fr)_4.5rem_5rem_4.25rem_4.5rem] gap-2 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid">
                  <span>#</span>
                  <span>Participant</span>
                  <span className="text-right">Attempts</span>
                  <span className="text-right">Time</span>
                  <span className="text-right">Score</span>
                  <span className="text-right">Result</span>
                </li>
                {rest.map((row, index) => (
                  <LeaderboardRow key={row.userId} row={row} delayMs={index * 28} />
                ))}
              </ul>
            ) : null}

            {rest.length === 0 && topThree.length > 0 ? (
              <p className="text-center text-xs text-muted-foreground">
                Only the top {topThree.length} participant{topThree.length === 1 ? "" : "s"} so far.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

function MetricChip({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border/70 bg-background/70 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1 truncate text-sm font-semibold tabular-nums">{value}</p>
      {hint ? <p className="truncate text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function RateBar({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: "accent" | "success" | "muted";
  hint?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{value}%</span>
      </div>
      <Meter value={value} tone={tone} />
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function PodiumLeaderCard({ row }: { row: LeaderRow }) {
  const place = Math.min(row.rank, 3) as 1 | 2 | 3;
  const styles = {
    1: {
      order: "sm:order-2 sm:-translate-y-2",
      label: "Gold",
      glow: "shadow-[0_10px_28px_rgba(251,191,36,0.22)]",
    },
    2: {
      order: "sm:order-1",
      label: "Silver",
      glow: "shadow-[0_8px_22px_rgba(148,163,184,0.18)]",
    },
    3: {
      order: "sm:order-3",
      label: "Bronze",
      glow: "shadow-[0_8px_22px_rgba(234,88,12,0.18)]",
    },
  }[place];

  return (
    <article
      className={cn(
        "animate-medal-pop flex flex-col items-center rounded-lg border border-white/10 bg-white/5 px-2 py-3 text-center backdrop-blur-sm",
        styles.order,
        styles.glow,
      )}
    >
      <PodiumMedal place={place} size={place === 1 ? 72 : 60} />
      <div className="mt-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-white ring-1 ring-white/20">
        {initials(row.name)}
      </div>
      <p className="mt-2 max-w-[9.5rem] truncate text-sm font-semibold text-white">{row.name}</p>
      <p className="font-display text-2xl tabular-nums text-white">{row.score}%</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">{styles.label}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-1 text-[10px] text-slate-300">
        <span className="rounded-full border border-white/15 bg-white/8 px-2 py-0.5">
          {row.attempts ?? 0} att
        </span>
        <span className="rounded-full border border-white/15 bg-white/8 px-2 py-0.5">
          {formatDuration(row.durationSeconds)}
        </span>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5",
            row.passed
              ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-200"
              : "border-rose-400/30 bg-rose-400/15 text-rose-200",
          )}
        >
          {row.passed ? "Pass" : "Fail"}
        </span>
      </div>
    </article>
  );
}

function LeaderboardRow({ row, delayMs }: { row: LeaderRow; delayMs: number }) {
  return (
    <li
      className={cn(
        "animate-brand-rise rounded-[var(--radius-md)] border border-border/70 bg-card px-3 py-3 sm:grid sm:grid-cols-[2.5rem_minmax(0,1fr)_4.5rem_5rem_4.25rem_4.5rem] sm:items-center sm:gap-2 sm:px-2 sm:py-2.5",
      )}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="mb-2 flex items-center gap-3 sm:mb-0 sm:contents">
        <RankMark rank={row.rank} />
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold">
            {initials(row.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{row.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {row.organization || row.email || "—"}
              {row.optedOut ? " · opted out" : ""}
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground sm:hidden">
              <span>{row.attempts ?? 0} attempts</span>
              <span>·</span>
              <span>{formatDuration(row.durationSeconds)}</span>
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 sm:ml-0 sm:contents">
          <p className="hidden text-right text-sm tabular-nums text-muted-foreground sm:block">
            {row.attempts ?? 0}
          </p>
          <p className="hidden text-right text-sm tabular-nums text-muted-foreground sm:block">
            {formatDuration(row.durationSeconds)}
          </p>
          <p className="text-right font-display text-xl tabular-nums sm:text-lg">{row.score}%</p>
          <div className="flex justify-end">
            <StatusPill tone={row.passed ? "success" : "danger"}>
              {row.passed ? "Pass" : "Fail"}
            </StatusPill>
          </div>
        </div>
      </div>
    </li>
  );
}
