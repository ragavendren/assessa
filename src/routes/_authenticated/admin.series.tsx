import { AdminNav } from "@/components/AdminNav";
import { QuestionBankNav } from "@/components/admin/QuestionBankNav";
import {
  FieldLabel,
  Panel,
  QuestionBankPageHeader,
} from "@/components/admin/pool/QuestionBankUi";
import { AdminEmpty } from "@/components/admin/AdminPageUi";
import { PageLoader } from "@/components/platform";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  deleteAssessmentSeries,
  listAssessmentSeries,
  listBlueprints,
  listCourses,
  listQuestionPools,
  upsertAssessmentSeries,
} from "@/lib/pool.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/series")({
  head: () => ({
    meta: [
      { title: "Assessment series — Assessa Admin" },
      {
        name: "description",
        content: "Series bind a course, pool, blueprint, and reuse policy for related exams.",
      },
    ],
  }),
  component: AdminSeriesPage,
});

const REUSE_HELP: Record<string, string> = {
  until_pool_exhausted: "Prefer unused pool questions within the course until inventory runs out.",
  allow_reuse: "Questions may appear again even if used on earlier assessments.",
  no_reuse_course: "Never reuse a pool question already used on any exam in this course.",
  no_reuse_series: "Never reuse within this series only.",
  no_reuse_last_n: "Skip questions used on the last N assessments for this pool.",
};

function AdminSeriesPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const fetchSeries = useServerFn(listAssessmentSeries);
  const fetchCourses = useServerFn(listCourses);
  const fetchPools = useServerFn(listQuestionPools);
  const fetchBlueprints = useServerFn(listBlueprints);
  const saveSeries = useServerFn(upsertAssessmentSeries);
  const removeSeries = useServerFn(deleteAssessmentSeries);

  const [courseId, setCourseId] = useState("");
  const [name, setName] = useState("");
  const [poolId, setPoolId] = useState("");
  const [blueprintId, setBlueprintId] = useState("");
  const [reusePolicy, setReusePolicy] = useState<
    | "allow_reuse"
    | "no_reuse_course"
    | "no_reuse_series"
    | "until_pool_exhausted"
    | "no_reuse_last_n"
  >("until_pool_exhausted");

  const { data: coursesData } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: () => fetchCourses(),
  });
  const { data: poolsData } = useQuery({
    queryKey: ["admin-pools", courseId],
    queryFn: () => fetchPools({ data: { courseId: courseId || undefined } }),
  });
  const { data: blueprintsData } = useQuery({
    queryKey: ["admin-blueprints", courseId],
    queryFn: () => fetchBlueprints({ data: { courseId: courseId || undefined } }),
  });
  const { data, isPending } = useQuery({
    queryKey: ["admin-series"],
    queryFn: () => fetchSeries({ data: {} }),
  });

  const pools = useMemo(
    () => (poolsData?.pools ?? []).filter((p) => !courseId || p.course_id === courseId),
    [poolsData, courseId],
  );
  const blueprints = useMemo(
    () => (blueprintsData?.blueprints ?? []).filter((b) => !courseId || b.course_id === courseId),
    [blueprintsData, courseId],
  );

  const mutation = useMutation({
    mutationFn: () =>
      saveSeries({
        data: {
          courseId,
          name,
          questionPoolId: poolId,
          blueprintId,
          reusePolicy,
        },
      }),
    onSuccess: () => {
      toast.success("Series saved");
      setName("");
      queryClient.invalidateQueries({ queryKey: ["admin-series"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not save series"),
  });

  const ready = (coursesData?.courses.length ?? 0) > 0 && pools.length > 0 && blueprints.length > 0;

  return (
    <div>
      <AdminNav />
      <QuestionBankNav />
      <QuestionBankPageHeader
        title="Assessment series"
        summary="Optional. A series ties a course, pool, blueprint, and reuse policy so related assessments share consistent generation rules."
        help={{
          label: "When to use series",
          body: (
            <span>
              Useful for weekly quizzes or cohort runs where you want controlled reuse. You can
              still generate assessments without a series by picking pool/blueprint on the exam
              directly.
            </span>
          ),
        }}
        action={
          <Link
            to="/admin/exams/new"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3.5 py-2.5 text-sm font-medium hover:bg-secondary"
          >
            New assessment <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />
      {isPending || !data ? (
        <PageLoader />
      ) : !ready ? (
        <Panel
          title="Prerequisites"
          description="Series need a course, at least one pool, and a blueprint."
        >
          <AdminEmpty
            title="Finish the earlier steps first"
            body="Create a course, import pool questions, and save a blueprint before adding a series."
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/admin/courses"
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
            >
              Courses
            </Link>
            <Link
              to="/admin/pools"
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
            >
              Pools
            </Link>
            <Link
              to="/admin/blueprints"
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
            >
              Blueprints
            </Link>
          </div>
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
          <Panel
            title="Add series"
            description="Defaults can be overridden per assessment when generating."
            help={{
              label: "Reuse policy",
              body: REUSE_HELP[reusePolicy],
            }}
          >
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!courseId || !poolId || !blueprintId) {
                  toast.error("Course, pool, and blueprint are required");
                  return;
                }
                mutation.mutate();
              }}
            >
              <div>
                <FieldLabel htmlFor="series-course">Course *</FieldLabel>
                <select
                  id="series-course"
                  className="field w-full"
                  value={courseId}
                  onChange={(e) => {
                    setCourseId(e.target.value);
                    setPoolId("");
                    setBlueprintId("");
                  }}
                  required
                >
                  <option value="">Select course…</option>
                  {(coursesData?.courses ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel htmlFor="series-name">Series name *</FieldLabel>
                <input
                  id="series-name"
                  className="field w-full"
                  placeholder="e.g. Week 1–4 cohort A"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <FieldLabel
                  htmlFor="series-pool"
                  help={{
                    label: "Pool",
                    body: "Only pools for the selected course are listed.",
                  }}
                >
                  Question pool *
                </FieldLabel>
                <select
                  id="series-pool"
                  className="field w-full"
                  value={poolId}
                  onChange={(e) => setPoolId(e.target.value)}
                  required
                >
                  <option value="">Select pool…</option>
                  {pools.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel htmlFor="series-blueprint">Blueprint *</FieldLabel>
                <select
                  id="series-blueprint"
                  className="field w-full"
                  value={blueprintId}
                  onChange={(e) => setBlueprintId(e.target.value)}
                  required
                >
                  <option value="">Select blueprint…</option>
                  {blueprints.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel
                  htmlFor="series-reuse"
                  help={{
                    label: "Reuse policy",
                    body: (
                      <ul className="mt-1 list-disc space-y-1 pl-4">
                        {Object.entries(REUSE_HELP).map(([key, text]) => (
                          <li key={key}>{text}</li>
                        ))}
                      </ul>
                    ),
                  }}
                >
                  Reuse policy
                </FieldLabel>
                <select
                  id="series-reuse"
                  className="field w-full"
                  value={reusePolicy}
                  onChange={(e) => setReusePolicy(e.target.value as typeof reusePolicy)}
                >
                  <option value="until_pool_exhausted">Until pool exhausted</option>
                  <option value="allow_reuse">Allow reuse</option>
                  <option value="no_reuse_course">No reuse in course</option>
                  <option value="no_reuse_series">No reuse in series</option>
                  <option value="no_reuse_last_n">No reuse last N</option>
                </select>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  {REUSE_HELP[reusePolicy]}
                </p>
              </div>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 sm:w-auto"
              >
                <Plus className="h-4 w-4" /> Add series
              </button>
            </form>
          </Panel>

          <Panel title="Your series" description={`${data.series.length} series`}>
            {data.series.length === 0 ? (
              <AdminEmpty
                title="No series yet"
                body="Add a series when you want related assessments to share pool, blueprint, and reuse defaults."
              />
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
                {data.series.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 px-4 py-3.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(s as { courses?: { name?: string } | null }).courses?.name} ·{" "}
                        {s.reuse_policy.replaceAll("_", " ")}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                      onClick={() => {
                        void (async () => {
                          const ok = await confirm({
                            title: "Delete series?",
                            description: `Delete series “${s.name}”?`,
                            confirmLabel: "Delete",
                            tone: "destructive",
                          });
                          if (!ok) return;
                          try {
                            await removeSeries({ data: { id: s.id } });
                            toast.success("Series deleted");
                            queryClient.invalidateQueries({ queryKey: ["admin-series"] });
                          } catch (error: unknown) {
                            toast.error(
                              error instanceof Error ? error.message : "Could not delete series",
                            );
                          }
                        })();
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
