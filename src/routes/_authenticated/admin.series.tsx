import { AdminNav } from "@/components/AdminNav";
import { FieldLabel, Panel, QuestionBankPageHeader } from "@/components/admin/pool/QuestionBankUi";
import { AdminEmpty } from "@/components/admin/AdminPageUi";
import { PageLoader } from "@/components/platform";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import {
  deleteAssessmentSeries,
  listAssessmentSeries,
  listBlueprints,
  listCourses,
  listQuestionPools,
  upsertAssessmentSeries,
} from "@/lib/pool.functions";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/admin/series")({
  validateSearch: z.object({
    seriesId: z.string().uuid().optional(),
    create: z.coerce.boolean().optional(),
  }),
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

type ReusePolicy =
  | "allow_reuse"
  | "no_reuse_course"
  | "no_reuse_series"
  | "until_pool_exhausted"
  | "no_reuse_last_n";

const REUSE_HELP: Record<ReusePolicy, string> = {
  until_pool_exhausted: "Prefer unused pool questions within the course until inventory runs out.",
  allow_reuse: "Questions may appear again even if used on earlier assessments.",
  no_reuse_course: "Never reuse a pool question already used on any exam in this course.",
  no_reuse_series: "Never reuse within this series only.",
  no_reuse_last_n: "Skip questions used on the last N assessments for this pool.",
};

function blankForm() {
  return {
    courseId: "",
    name: "",
    poolId: "",
    blueprintId: "",
    reusePolicy: "until_pool_exhausted" as ReusePolicy,
    reuseLastN: 5,
  };
}

function SeriesFormFields({
  form,
  setForm,
  courses,
  pools,
  blueprints,
  idPrefix,
}: {
  form: ReturnType<typeof blankForm>;
  setForm: Dispatch<SetStateAction<ReturnType<typeof blankForm>>>;
  courses: Array<{ id: string; name: string }>;
  pools: Array<{ id: string; name: string }>;
  blueprints: Array<{ id: string; name: string }>;
  idPrefix: string;
}) {
  return (
    <>
      <div>
        <FieldLabel htmlFor={`${idPrefix}-course`}>Course *</FieldLabel>
        <select
          id={`${idPrefix}-course`}
          className="field w-full"
          value={form.courseId}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              courseId: e.target.value,
              poolId: "",
              blueprintId: "",
            }))
          }
          required
        >
          <option value="">Select course…</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <FieldLabel htmlFor={`${idPrefix}-name`}>Series name *</FieldLabel>
        <input
          id={`${idPrefix}-name`}
          className="field w-full"
          placeholder="e.g. Week 1–4 cohort A"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          required
        />
      </div>
      <div>
        <FieldLabel
          htmlFor={`${idPrefix}-pool`}
          help={{
            label: "Pool",
            body: "Only pools for the selected course are listed.",
          }}
        >
          Question pool *
        </FieldLabel>
        <select
          id={`${idPrefix}-pool`}
          className="field w-full"
          value={form.poolId}
          onChange={(e) => setForm((prev) => ({ ...prev, poolId: e.target.value }))}
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
        <FieldLabel htmlFor={`${idPrefix}-blueprint`}>Blueprint *</FieldLabel>
        <select
          id={`${idPrefix}-blueprint`}
          className="field w-full"
          value={form.blueprintId}
          onChange={(e) => setForm((prev) => ({ ...prev, blueprintId: e.target.value }))}
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
          htmlFor={`${idPrefix}-reuse`}
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
          id={`${idPrefix}-reuse`}
          className="field w-full"
          value={form.reusePolicy}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              reusePolicy: e.target.value as ReusePolicy,
            }))
          }
        >
          <option value="until_pool_exhausted">Until pool exhausted</option>
          <option value="allow_reuse">Allow reuse</option>
          <option value="no_reuse_course">No reuse in course</option>
          <option value="no_reuse_series">No reuse in series</option>
          <option value="no_reuse_last_n">No reuse last N</option>
        </select>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          {REUSE_HELP[form.reusePolicy]}
        </p>
      </div>
      {form.reusePolicy === "no_reuse_last_n" ? (
        <div>
          <FieldLabel htmlFor={`${idPrefix}-reuse-n`}>Last N assessments</FieldLabel>
          <input
            id={`${idPrefix}-reuse-n`}
            type="number"
            min={1}
            max={50}
            className="field w-full"
            value={form.reuseLastN}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                reuseLastN: Number(e.target.value) || 5,
              }))
            }
          />
        </div>
      ) : null}
    </>
  );
}

function AdminSeriesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: Route.fullPath });
  const confirm = useConfirm();
  const { seriesId: selectedId, create: createFromSearch } = Route.useSearch();
  const fetchSeries = useServerFn(listAssessmentSeries);
  const fetchCourses = useServerFn(listCourses);
  const fetchPools = useServerFn(listQuestionPools);
  const fetchBlueprints = useServerFn(listBlueprints);
  const saveSeries = useServerFn(upsertAssessmentSeries);
  const removeSeries = useServerFn(deleteAssessmentSeries);

  const [form, setForm] = useState(blankForm);
  const [createForm, setCreateForm] = useState(blankForm);
  const [createOpen, setCreateOpen] = useState(Boolean(createFromSearch));

  const { data: coursesData } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: () => fetchCourses(),
  });
  const { data: poolsData } = useQuery({
    queryKey: ["admin-pools"],
    queryFn: () => fetchPools({ data: {} }),
  });
  const { data: blueprintsData } = useQuery({
    queryKey: ["admin-blueprints"],
    queryFn: () => fetchBlueprints({ data: {} }),
  });
  const { data, isPending } = useQuery({
    queryKey: ["admin-series"],
    queryFn: () => fetchSeries({ data: {} }),
  });

  const seriesList = data?.series ?? [];
  const selectedSeries = useMemo(
    () => (selectedId ? (seriesList.find((item) => item.id === selectedId) ?? null) : null),
    [selectedId, seriesList],
  );

  const courses = coursesData?.courses ?? [];

  const prerequisitesReady =
    courses.length > 0 &&
    (poolsData?.pools.length ?? 0) > 0 &&
    (blueprintsData?.blueprints.length ?? 0) > 0;

  useEffect(() => {
    if (createFromSearch) {
      setCreateOpen(true);
      void navigate({
        search: (prev) => ({ ...prev, create: undefined }),
        replace: true,
      });
    }
  }, [createFromSearch, navigate]);

  useEffect(() => {
    if (!data) return;
    if (selectedId && seriesList.some((item) => item.id === selectedId)) return;
    if (seriesList.length === 0) return;
    void navigate({
      search: (prev) => ({ ...prev, seriesId: seriesList[0]?.id }),
      replace: true,
    });
  }, [data, navigate, selectedId, seriesList]);

  useEffect(() => {
    if (!selectedSeries) return;
    setForm({
      courseId: selectedSeries.course_id,
      name: selectedSeries.name,
      poolId: selectedSeries.question_pool_id,
      blueprintId: selectedSeries.blueprint_id,
      reusePolicy: selectedSeries.reuse_policy as ReusePolicy,
      reuseLastN: selectedSeries.reuse_last_n ?? 5,
    });
  }, [selectedSeries]);

  function selectSeries(seriesId: string) {
    void navigate({
      search: (prev) => ({ ...prev, seriesId, create: undefined }),
      replace: true,
    });
  }

  function openCreate() {
    setCreateForm(blankForm());
    setCreateOpen(true);
  }

  function closeCreate() {
    setCreateOpen(false);
    setCreateForm(blankForm());
  }

  const saveMutation = useMutation({
    mutationFn: (args: { creating: boolean; values: ReturnType<typeof blankForm> }) =>
      saveSeries({
        data: {
          id: args.creating ? undefined : selectedSeries?.id,
          courseId: args.values.courseId,
          name: args.values.name,
          questionPoolId: args.values.poolId,
          blueprintId: args.values.blueprintId,
          reusePolicy: args.values.reusePolicy,
          reuseLastN: args.values.reuseLastN,
        },
      }),
    onSuccess: (row, vars) => {
      toast.success(vars.creating ? "Series created" : "Series updated");
      queryClient.invalidateQueries({ queryKey: ["admin-series"] });
      if (vars.creating) closeCreate();
      selectSeries(row.id);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not save series"),
  });

  const editPools = useMemo(
    () => (poolsData?.pools ?? []).filter((p) => !form.courseId || p.course_id === form.courseId),
    [poolsData, form.courseId],
  );
  const editBlueprints = useMemo(
    () =>
      (blueprintsData?.blueprints ?? []).filter(
        (b) => !form.courseId || b.course_id === form.courseId,
      ),
    [blueprintsData, form.courseId],
  );
  const createPools = useMemo(
    () =>
      (poolsData?.pools ?? []).filter(
        (p) => !createForm.courseId || p.course_id === createForm.courseId,
      ),
    [poolsData, createForm.courseId],
  );
  const createBlueprints = useMemo(
    () =>
      (blueprintsData?.blueprints ?? []).filter(
        (b) => !createForm.courseId || b.course_id === createForm.courseId,
      ),
    [blueprintsData, createForm.courseId],
  );

  return (
    <div>
      <AdminNav />
      <QuestionBankPageHeader
        title="Series"
        back={{ to: "/admin/exams", label: "Assessments" }}
        help={{
          label: "Series",
          body: "Optional track for related papers. Most assessments only need a course, pool, and optional blueprint.",
        }}
        action={
          <div className="flex flex-wrap gap-2">
            {prerequisitesReady ? (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" /> New series
              </button>
            ) : null}
            <Link
              to="/admin/exams/new"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3.5 py-2.5 text-sm font-medium hover:bg-secondary"
            >
              New assessment <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        }
      />
      {isPending || !data ? (
        <PageLoader />
      ) : !prerequisitesReady && seriesList.length === 0 ? (
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
        <div className="grid gap-3 lg:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)] lg:items-start">
          <Panel title="Your series" description={`${seriesList.length} series`}>
            {seriesList.length === 0 ? (
              <div>
                <AdminEmpty
                  title="No series yet"
                  body="Optional. Add a series when related assessments should share pool, blueprint, and reuse defaults."
                />
                {prerequisitesReady ? (
                  <button
                    type="button"
                    onClick={openCreate}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <Plus className="h-4 w-4" /> New series
                  </button>
                ) : null}
              </div>
            ) : (
              <ul className="max-h-[min(70vh,36rem)] divide-y divide-border overflow-y-auto rounded-md border border-border lg:max-h-[calc(100vh-14rem)]">
                {seriesList.map((s) => {
                  const selected = s.id === selectedSeries?.id;
                  return (
                    <li key={s.id}>
                      <div
                        className={cn(
                          "flex items-start gap-1.5 px-2.5 py-2 text-sm transition-colors",
                          selected ? "bg-primary/5" : "hover:bg-secondary/60",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => selectSeries(s.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate font-medium">{s.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {(s as { courses?: { name?: string } | null }).courses?.name} ·{" "}
                            {s.reuse_policy.replaceAll("_", " ")}
                          </p>
                        </button>
                        <button
                          type="button"
                          className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md p-1.5 text-xs text-destructive hover:bg-destructive/10"
                          aria-label={`Delete ${s.name}`}
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
                                if (selectedId === s.id) {
                                  const next = seriesList.find((item) => item.id !== s.id);
                                  void navigate({
                                    search: (prev) => ({
                                      ...prev,
                                      seriesId: next?.id,
                                    }),
                                    replace: true,
                                  });
                                }
                                queryClient.invalidateQueries({ queryKey: ["admin-series"] });
                              } catch (error: unknown) {
                                toast.error(
                                  error instanceof Error
                                    ? error.message
                                    : "Could not delete series",
                                );
                              }
                            })();
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {selectedSeries ? (
            <Panel
              title="Edit series"
              description="Update pool, blueprint, or reuse policy for this track."
              help={{
                label: "Reuse policy",
                body: REUSE_HELP[form.reusePolicy],
              }}
            >
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!form.courseId || !form.poolId || !form.blueprintId) {
                    toast.error("Course, pool, and blueprint are required");
                    return;
                  }
                  saveMutation.mutate({ creating: false, values: form });
                }}
              >
                <SeriesFormFields
                  form={form}
                  setForm={setForm}
                  courses={courses}
                  pools={editPools}
                  blueprints={editBlueprints}
                  idPrefix="series-edit"
                />
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {saveMutation.isPending ? "Saving…" : "Save changes"}
                </button>
              </form>
            </Panel>
          ) : (
            <Panel title="Select a series" description="Optional track for related assessments.">
              <AdminEmpty
                title="Nothing selected"
                body="Create a series when you need shared pool/blueprint defaults and reuse control."
              />
              {prerequisitesReady ? (
                <button
                  type="button"
                  onClick={openCreate}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" /> New series
                </button>
              ) : null}
            </Panel>
          )}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={closeCreate}
        title="New series"
        description="Defaults can be overridden per assessment when generating."
        size="lg"
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!createForm.courseId || !createForm.poolId || !createForm.blueprintId) {
              toast.error("Course, pool, and blueprint are required");
              return;
            }
            saveMutation.mutate({ creating: true, values: createForm });
          }}
        >
          <SeriesFormFields
            form={createForm}
            setForm={setCreateForm}
            courses={courses}
            pools={createPools}
            blueprints={createBlueprints}
            idPrefix="series-create"
          />
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeCreate}
              className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" /> {saveMutation.isPending ? "Creating…" : "Create series"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
