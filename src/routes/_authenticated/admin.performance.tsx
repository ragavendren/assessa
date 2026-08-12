import { AdminNav } from "@/components/AdminNav";
import { ListToolbar, listViewClass, useListViewMode } from "@/components/ListToolbar";
import { PageLoader, SectionHeading, StatTile } from "@/components/platform";
import { getAdminAssessmentPerformance } from "@/lib/admin.functions";
import { MODE_LABELS, type ExamMode } from "@/lib/gamification";
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

  if (isPending) return <PageLoader label="Loading performance…" />;
  if (error || !data) {
    return (
      <div className="surface-paper p-8 text-center">
        <p className="font-display text-xl">Administrator access required</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AdminNav />
      <SectionHeading eyebrow="Analytics" title="Assessment performance" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Assessments" value={data.totals.assessments} />
        <StatTile
          label="Opted-in seats"
          value={data.totals.opted}
          hint="Unique starts across exams"
        />
        <StatTile label="Completed seats" value={data.totals.completed} />
        <StatTile label="Avg completion" value={data.totals.averageCompletion} suffix="%" />
        <StatTile label="Avg pass rate" value={data.totals.averagePassRate} suffix="%" />
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
        <div className="surface-paper p-6 text-sm text-muted-foreground">
          No assessments match your filters.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <section className={cn(view === "grid" ? listViewClass("grid") : "space-y-3")}>
            {view === "table" ? (
              <div className="surface-paper overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="p-3 font-medium">Assessment</th>
                      <th className="p-3 font-medium">Completion</th>
                      <th className="p-3 font-medium">Pass</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {assessments.map((exam) => (
                      <tr
                        key={exam.id}
                        className={cn(
                          "cursor-pointer hover:bg-secondary/40",
                          selected?.id === exam.id && "bg-secondary/50",
                        )}
                        onClick={() => setSelectedId(exam.id)}
                      >
                        <td className="p-3">
                          <p className="font-medium">{exam.title}</p>
                          <p className="text-xs text-muted-foreground">{exam.topic}</p>
                        </td>
                        <td className="p-3 tabular-nums">{exam.completionRate}%</td>
                        <td className="p-3 tabular-nums">{exam.passRate}%</td>
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
                        ? "border-accent bg-accent/10"
                        : "border-border bg-card hover:bg-secondary/40",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{exam.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {exam.topic} · {MODE_LABELS[exam.mode as ExamMode] ?? exam.mode}
                          {exam.active ? " · published" : " · inactive"}
                        </p>
                      </div>
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">
                        pass mark {exam.passMark}%
                      </span>
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
                  </button>
                );
              })
            )}
          </section>

          <section className="surface-paper p-5">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Select an assessment.</p>
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

                {selected.leaderboard.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No submitted attempts yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="p-2 font-medium">#</th>
                          <th className="p-2 font-medium">Participant</th>
                          <th className="p-2 font-medium">Score</th>
                          <th className="p-2 font-medium">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {selected.leaderboard.map((row) => (
                          <tr key={row.userId}>
                            <td className="p-2 tabular-nums text-muted-foreground">{row.rank}</td>
                            <td className="p-2">
                              <p className="font-medium">{row.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {row.organization || row.email}
                                {row.optedOut ? " · opted out of public boards" : ""}
                              </p>
                            </td>
                            <td className="p-2 font-display text-lg tabular-nums">{row.score}%</td>
                            <td className="p-2">
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                  row.passed
                                    ? "bg-success/12 text-success"
                                    : "bg-destructive/12 text-destructive",
                                )}
                              >
                                {row.passed ? "Passed" : "Not passed"}
                              </span>
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
