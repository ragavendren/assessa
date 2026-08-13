import { AdminNav } from "@/components/AdminNav";
import { QuestionBankNav } from "@/components/admin/QuestionBankNav";
import {
  FieldLabel,
  Panel,
  QuestionBankPageHeader,
} from "@/components/admin/pool/QuestionBankUi";
import { AdminEmpty, StatusPill } from "@/components/admin/AdminPageUi";
import { PageLoader } from "@/components/platform";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  deleteQuestionPool,
  listCourses,
  listQuestionPools,
  upsertQuestionPool,
} from "@/lib/pool.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Plus, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/pools/")({
  head: () => ({
    meta: [
      { title: "Question pools — Assessa Admin" },
      { name: "description", content: "Manage reusable question banks per course." },
    ],
  }),
  component: AdminPoolsPage,
});

function AdminPoolsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const fetchPools = useServerFn(listQuestionPools);
  const fetchCourses = useServerFn(listCourses);
  const savePool = useServerFn(upsertQuestionPool);
  const removePool = useServerFn(deleteQuestionPool);

  const [courseId, setCourseId] = useState("");
  const [name, setName] = useState("");

  const { data: coursesData } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: () => fetchCourses(),
  });
  const { data, isPending } = useQuery({
    queryKey: ["admin-pools"],
    queryFn: () => fetchPools({ data: {} }),
  });

  const courses = coursesData?.courses ?? [];

  const mutation = useMutation({
    mutationFn: () => savePool({ data: { courseId, name } }),
    onSuccess: (pool) => {
      toast.success("Pool created — opening import page");
      setName("");
      queryClient.invalidateQueries({ queryKey: ["admin-pools"] });
      void navigate({ to: "/admin/pools/$poolId", params: { poolId: pool.id } });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save pool"),
  });

  return (
    <div>
      <AdminNav />
      <QuestionBankNav />
      <QuestionBankPageHeader
        title="Question pools"
        summary="Pools store the reusable bank. On generate, selected items are cloned into the assessment’s questions — participant scoring stays unchanged."
        help={{
          label: "How pools work",
          body: (
            <span>
              Open a pool to download the CSV template and import questions with topic, difficulty,
              and tags. Assessment CSV upload on New assessment is a separate path.
            </span>
          ),
        }}
      />
      {isPending || !data ? (
        <PageLoader />
      ) : courses.length === 0 ? (
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
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
          <Panel
            title="Create pool"
            description="After create, you land on the import page automatically."
            help={{
              label: "Import next",
              body: "Use Open & import on an existing pool anytime to manage bank questions.",
            }}
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
                />
              </div>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 sm:w-auto"
              >
                <Plus className="h-4 w-4" /> Create & import
              </button>
            </form>
          </Panel>

          <Panel
            title="Your pools"
            description={`${data.pools.length} pool${data.pools.length === 1 ? "" : "s"}`}
            action={
              data.pools.length > 0 ? (
                <Link
                  to="/admin/blueprints"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Next: blueprints <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : null
            }
          >
            {data.pools.length === 0 ? (
              <AdminEmpty
                title="No pools yet"
                body="Create a pool on the left, then import questions with the CSV template."
              />
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
                {data.pools.map((pool) => (
                  <li
                    key={pool.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{pool.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {(pool as { courses?: { name?: string } | null }).courses?.name ?? "Course"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone={pool.status === "active" ? "live" : "draft"}>
                        {pool.status}
                      </StatusPill>
                      <Link
                        to="/admin/pools/$poolId"
                        params={{ poolId: pool.id }}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        <Upload className="h-3.5 w-3.5" /> Open & import
                      </Link>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                        onClick={() => {
                          void (async () => {
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
                              queryClient.invalidateQueries({ queryKey: ["admin-pools"] });
                            } catch (error: unknown) {
                              toast.error(
                                error instanceof Error ? error.message : "Could not delete pool",
                              );
                            }
                          })();
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
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
