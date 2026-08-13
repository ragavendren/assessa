import { AdminNav } from "@/components/AdminNav";
import { QuestionBankNav } from "@/components/admin/QuestionBankNav";
import { FieldLabel, Panel } from "@/components/admin/pool/QuestionBankUi";
import { PoolWorkspace } from "@/components/admin/pool/PoolWorkspace";
import { AdminEmpty, StatusPill } from "@/components/admin/AdminPageUi";
import { PageLoader } from "@/components/platform";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import {
  deleteQuestionPool,
  listCourses,
  listQuestionPools,
  upsertQuestionPool,
} from "@/lib/pool.functions";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, PanelLeftClose, PanelLeftOpen, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/admin/pools/")({
  validateSearch: z.object({
    poolId: z.string().uuid().optional(),
  }),
  head: () => ({
    meta: [
      { title: "Question pools — Assessa Admin" },
      { name: "description", content: "Manage reusable question banks per course." },
    ],
  }),
  component: AdminPoolsPage,
});

type PoolRow = Awaited<ReturnType<typeof listQuestionPools>>["pools"][number];

function poolQuestionCount(pool: PoolRow) {
  return "questionCount" in pool && typeof pool.questionCount === "number"
    ? pool.questionCount
    : null;
}

function AdminPoolsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: Route.fullPath });
  const confirm = useConfirm();
  const { poolId: selectedPoolId } = Route.useSearch();
  const fetchPools = useServerFn(listQuestionPools);
  const fetchCourses = useServerFn(listCourses);
  const savePool = useServerFn(upsertQuestionPool);
  const removePool = useServerFn(deleteQuestionPool);

  const [courseId, setCourseId] = useState("");
  const [name, setName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  /** Docked = list becomes a dropdown; undocked = side list. */
  const [listDocked, setListDocked] = useState(false);

  const { data: coursesData } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: () => fetchCourses(),
  });
  const { data, isPending } = useQuery({
    queryKey: ["admin-pools"],
    queryFn: () => fetchPools({ data: {} }),
  });

  const courses = coursesData?.courses ?? [];
  const pools = data?.pools ?? [];

  const selectedPool = useMemo(
    () => pools.find((pool) => pool.id === selectedPoolId) ?? null,
    [pools, selectedPoolId],
  );

  useEffect(() => {
    if (!data || pools.length === 0) return;
    if (selectedPoolId && pools.some((pool) => pool.id === selectedPoolId)) return;
    void navigate({
      search: (prev) => ({ ...prev, poolId: pools[0]?.id }),
      replace: true,
    });
  }, [data, navigate, pools, selectedPoolId]);

  useEffect(() => {
    if (!selectedPool) setListDocked(false);
  }, [selectedPool]);

  function selectPool(poolId: string) {
    void navigate({
      search: (prev) => ({ ...prev, poolId }),
      replace: true,
    });
  }

  function closeCreate() {
    setCreateOpen(false);
    setName("");
  }

  async function handleDeletePool(pool: PoolRow) {
    const ok = await confirm({
      title: "Delete pool?",
      description: `Delete pool “${pool.name}” and all bank questions?`,
      confirmLabel: "Delete",
      tone: "destructive",
    });
    if (!ok) return;
    try {
      await removePool({ data: { id: pool.id } });
      toast.success("Pool deleted");
      if (selectedPoolId === pool.id) {
        const next = pools.find((item) => item.id !== pool.id);
        void navigate({
          search: (prev) => ({
            ...prev,
            poolId: next?.id,
          }),
          replace: true,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-pools"] });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not delete pool");
    }
  }

  const mutation = useMutation({
    mutationFn: () => savePool({ data: { courseId, name } }),
    onSuccess: (pool) => {
      toast.success("Pool created — import questions in the workspace");
      setName("");
      setCreateOpen(false);
      setListDocked(true);
      queryClient.invalidateQueries({ queryKey: ["admin-pools"] });
      selectPool(pool.id);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save pool"),
  });

  const docked = listDocked && Boolean(selectedPool);

  return (
    <div className="-mb-6 flex h-[calc(2*(100dvh-5.5rem))] min-h-[calc(2*(100dvh-5.5rem))] flex-col">
      <div className="shrink-0 [&_nav]:mb-2">
        <AdminNav />
        <QuestionBankNav />
        <div className="mb-2 flex w-full min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">Question pools</h2>
          </div>
          {courses.length > 0 ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> New pool
            </button>
          ) : null}
        </div>
      </div>
      {isPending || !data ? (
        <PageLoader />
      ) : courses.length === 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Panel title="Course required" description="Pools belong to a course.">
            <AdminEmpty
              title="Create a course first"
              body="Add a course, then return here to create pools and import questions."
            />
            <Link
              to="/admin/courses"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Go to courses <ArrowRight className="h-4 w-4" />
            </Link>
          </Panel>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          {docked ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-border bg-card px-3 py-1.5">
              <label className="sr-only" htmlFor="pool-dock-select">
                Active pool
              </label>
              <select
                id="pool-dock-select"
                className="field h-9 min-w-[12rem] flex-1 sm:max-w-sm"
                value={selectedPool?.id ?? ""}
                onChange={(e) => {
                  if (e.target.value) selectPool(e.target.value);
                }}
              >
                {pools.map((pool) => {
                  const count = poolQuestionCount(pool);
                  return (
                    <option key={pool.id} value={pool.id}>
                      {pool.name}
                      {count != null ? ` (${count} Q)` : ""}
                    </option>
                  );
                })}
              </select>
              {selectedPool ? (
                <StatusPill tone={selectedPool.status === "active" ? "live" : "draft"}>
                  {selectedPool.status}
                </StatusPill>
              ) : null}
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {pools.length} pool{pools.length === 1 ? "" : "s"} · docked
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                <Link
                  to="/admin/blueprints"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Next <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                {selectedPool ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                    onClick={() => void handleDeletePool(selectedPool)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setListDocked(false)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label="Undock pool list"
                  title="Show pool list beside questions"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                  <span className="hidden sm:inline">Undock list</span>
                </button>
              </div>
            </div>
          ) : null}

          <div
            className={cn(
              "grid min-h-0 flex-1 gap-2 overflow-hidden",
              docked
                ? "grid-cols-1"
                : "lg:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)] lg:items-stretch",
            )}
          >
            {!docked ? (
              <Panel
                className="flex min-h-0 flex-col overflow-hidden"
                title="Your pools"
                description={`${pools.length} pool${pools.length === 1 ? "" : "s"}`}
                action={
                  <div className="flex items-center gap-1.5">
                    {pools.length > 0 ? (
                      <Link
                        to="/admin/blueprints"
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        Next <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : null}
                    {selectedPool ? (
                      <button
                        type="button"
                        onClick={() => setListDocked(true)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                        aria-label="Dock pool list"
                        title="Dock list as dropdown — expand questions"
                      >
                        <PanelLeftClose className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                }
              >
                {pools.length === 0 ? (
                  <div>
                    <AdminEmpty
                      title="No pools yet"
                      body="Create a pool to start importing bank questions."
                    />
                    <button
                      type="button"
                      onClick={() => setCreateOpen(true)}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      <Plus className="h-4 w-4" /> New pool
                    </button>
                  </div>
                ) : (
                  <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto overscroll-contain rounded-md border border-border">
                    {pools.map((pool) => {
                      const selected = pool.id === selectedPool?.id;
                      const questionCount = poolQuestionCount(pool);
                      return (
                        <li key={pool.id}>
                          <div
                            className={cn(
                              "flex items-start gap-1.5 px-2.5 py-2 text-sm transition-colors",
                              selected ? "bg-primary/5" : "hover:bg-secondary/60",
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => selectPool(pool.id)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="truncate font-medium">{pool.name}</p>
                                <StatusPill tone={pool.status === "active" ? "live" : "draft"}>
                                  {pool.status}
                                </StatusPill>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {(pool as { courses?: { name?: string } | null }).courses?.name ??
                                  "Course"}
                                {questionCount != null ? ` · ${questionCount} Q` : null}
                              </p>
                            </button>
                            <button
                              type="button"
                              className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md p-1.5 text-xs text-destructive hover:bg-destructive/10"
                              aria-label={`Delete ${pool.name}`}
                              onClick={() => void handleDeletePool(pool)}
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
            ) : null}

            {selectedPool ? (
              <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--radius-md)] border border-border bg-card p-2.5 sm:p-3">
                <PoolWorkspace
                  poolId={selectedPool.id}
                  poolName={selectedPool.name}
                  expanded
                  listCollapsed={docked}
                />
              </div>
            ) : (
              <Panel
                title="Select a pool"
                description="Choose a pool from the list, or create one to import questions."
              >
                <AdminEmpty
                  title="Nothing selected"
                  body="Create a pool to open the import and inventory workspace."
                />
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" /> New pool
                </button>
              </Panel>
            )}
          </div>
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={closeCreate}
        title="Create pool"
        description="After create, the new pool opens in the workspace for CSV import."
        size="md"
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!courseId) {
              toast.error("Select a course");
              return;
            }
            mutation.mutate();
          }}
        >
          <div>
            <FieldLabel
              htmlFor="pool-course"
              help={{
                label: "Course",
                body: "Only blueprints and series for this course can use the pool.",
              }}
            >
              Course *
            </FieldLabel>
            <select
              id="pool-course"
              className="field w-full"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
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
            <FieldLabel htmlFor="pool-name">Pool name *</FieldLabel>
            <input
              id="pool-name"
              className="field w-full"
              placeholder="e.g. Associate practice bank"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
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
              disabled={mutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" /> {mutation.isPending ? "Creating…" : "Create pool"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
