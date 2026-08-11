import { AdminNav } from "@/components/AdminNav";
import { Meter, PageLoader, SectionHeading, StatTile } from "@/components/platform";
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

  const { data, isPending, error } = useQuery({
    queryKey: ["admin-performance"],
    queryFn: () => fetchPerformance(),
    retry: false,
  });

  const selected = useMemo(() => {
    if (!data?.assessments.length) return null;
    return data.assessments.find((exam) => exam.id === selectedId) ?? data.assessments[0] ?? null;
  }, [data?.assessments, selectedId]);

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

      {data.assessments.length === 0 ? (
        <div className="surface-paper p-6 text-sm text-muted-foreground">
          No assessments yet. Publish one to start tracking opted participants, completion and pass
          rates.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <section className="space-y-3">
            {data.assessments.map((exam) => {
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

                  <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <Metric label="Opted" value={String(exam.opted)} />
                    <Metric label="Completion" value={`${exam.completionRate}%`} />
                    <Metric label="Pass rate" value={`${exam.passRate}%`} />
                  </div>

                  <div className="mt-3 space-y-2">
                    <div>
                      <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                        <span>Completion</span>
                        <span>
                          {exam.completed}/{exam.opted || 0}
                        </span>
                      </div>
                      <Meter value={exam.completionRate} tone="accent" />
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                        <span>Passing</span>
                        <span>{exam.passRate}%</span>
                      </div>
                      <Meter value={exam.passRate} tone="success" />
                    </div>
                  </div>
                </button>
              );
            })}
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-display text-xl">{value}</p>
    </div>
  );
}
