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
import { EmptyState, Meter, PageLoader, StatTile } from "@/components/platform";
import { getAdminAssessmentPerformance } from "@/lib/admin.functions";
import { formatAttemptCount, MODE_LABELS, type ExamMode } from "@/lib/gamification";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

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
    <div className="space-y-8">
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
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
          <section className={cn(view === "grid" ? listViewClass("grid") : "space-y-3")}>
            {view === "table" ? (
              <div className="surface-paper max-w-full overflow-hidden">
                <table className="w-full table-fixed text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="w-[48%] p-3 font-medium">Assessment</th>
                      <th className="w-[26%] p-3 font-medium">Completion</th>
                      <th className="w-[26%] p-3 font-medium">Pass</th>
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
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
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

          <section className="min-w-0 max-w-full surface-paper p-5 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6.5rem)] lg:overflow-y-auto">
            {!selected ? (
              <AdminEmpty
                title="Select an assessment"
                body="Pick a paper to open its leaderboard."
              />
            ) : (
              <div className="space-y-5">
                <div>
                  <p className="text-hairline text-muted-foreground">Leaderboard</p>
                  <h3 className="mt-1 font-display text-2xl">{selected.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    Best submitted score per opted participant · avg best{" "}
                    {selected.averageBestScore}%
                    {selected.inProgress ? ` · ${selected.inProgress} in progress` : ""}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <StatTile label="Opted in" value={selected.opted} />
                  <StatTile
                    label="Completed"
                    value={selected.completed}
                    suffix={` · ${selected.completionRate}%`}
                  />
                  <StatTile label="Passed" value={selected.passRate} suffix="%" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Completion</span>
                    <span className="tabular-nums">{selected.completionRate}%</span>
                  </div>
                  <Meter
                    value={selected.completionRate}
                    tone={selected.completionRate >= 70 ? "success" : "accent"}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Pass rate</span>
                    <span className="tabular-nums">{selected.passRate}%</span>
                  </div>
                  <Meter
                    value={selected.passRate}
                    tone={selected.passRate >= selected.passMark ? "success" : "accent"}
                  />
                </div>

                {selected.leaderboard.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
                    No submitted attempts yet.
                  </p>
                ) : (
                  <div className="max-w-full overflow-hidden">
                    <table className="w-full table-fixed text-sm">
                      <thead className="text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="w-10 p-2 font-medium">#</th>
                          <th className="p-2 font-medium">Participant</th>
                          <th className="w-16 p-2 font-medium">Score</th>
                          <th className="w-[5.5rem] p-2 font-medium">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {selected.leaderboard.map((row) => (
                          <tr key={row.userId} className={cn(row.rank <= 3 && "bg-secondary/20")}>
                            <td className="p-2">
                              <RankMark rank={row.rank} />
                            </td>
                            <td className="min-w-0 p-2">
                              <p className="truncate font-medium">{row.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {formatAttemptCount(row.attempts ?? 0)}
                                {row.organization || row.email
                                  ? ` · ${row.organization || row.email}`
                                  : ""}
                                {row.optedOut ? " · opted out" : ""}
                              </p>
                            </td>
                            <td className="p-2 tabular-nums">{row.score}%</td>
                            <td className="p-2">
                              <StatusPill tone={row.passed ? "success" : "danger"}>
                                {row.passed ? "Pass" : "Fail"}
                              </StatusPill>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
