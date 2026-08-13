import { AdminNav } from "@/components/AdminNav";
import { QuestionBankNav } from "@/components/admin/QuestionBankNav";
import {
  Panel,
  QUESTION_BANK_STEPS,
  QuestionBankPageHeader,
  QuestionBankWorkflow,
} from "@/components/admin/pool/QuestionBankUi";
import { EmptyState, PageLoader } from "@/components/platform";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  deleteBlueprint,
  listBlueprints,
  listCourses,
  setDefaultBlueprint,
} from "@/lib/pool.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/blueprints/")({
  head: () => ({
    meta: [
      { title: "Blueprints — Assessa Admin" },
      {
        name: "description",
        content: "Course blueprints define topic weightage and difficulty mix.",
      },
    ],
  }),
  component: AdminBlueprintsPage,
});

function AdminBlueprintsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const fetchBlueprints = useServerFn(listBlueprints);
  const fetchCourses = useServerFn(listCourses);
  const removeBlueprint = useServerFn(deleteBlueprint);
  const markDefault = useServerFn(setDefaultBlueprint);

  const { data: coursesData } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: () => fetchCourses(),
  });
  const { data, isPending } = useQuery({
    queryKey: ["admin-blueprints"],
    queryFn: () => fetchBlueprints({ data: {} }),
  });

  const courseCount = coursesData?.courses.length ?? 0;

  return (
    <div>
      <AdminNav />
      <QuestionBankNav />
      <QuestionBankPageHeader
        title="Blueprints"
        summary="Blueprints define how many questions come from each topic and the easy/medium/hard mix. Topic weightage must total 100%, and each rule’s difficulty mix must also total 100%."
        help={{
          label: "Blueprint rules",
          body: (
            <span>
              Example: Lambda 25%, DynamoDB 20%, … summing to 100%. On generate, Assessa allocates
              exact integer counts with largest-remainder rounding.
            </span>
          ),
        }}
        action={
          <Link
            to="/admin/blueprints/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New blueprint
          </Link>
        }
      />
      <QuestionBankWorkflow steps={[...QUESTION_BANK_STEPS]} current={2} />

      {isPending || !data ? (
        <PageLoader />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.25fr)]">
          <Panel
            title="Checklist before you build"
            description="Blueprints need a course and work best once pools have tagged topics."
            help={{
              label: "Why topics matter",
              body: "Pool questions should use the same topic names as blueprint rules so generation can find enough inventory.",
            }}
          >
            <ul className="space-y-3 text-sm">
              <li className="rounded-md border border-border bg-secondary/30 px-3 py-2">
                <p className="font-medium">1. Course exists</p>
                <p className="text-xs text-muted-foreground">
                  {courseCount > 0 ? `${courseCount} course(s) ready` : "Create a course first"}
                </p>
              </li>
              <li className="rounded-md border border-border bg-secondary/30 px-3 py-2">
                <p className="font-medium">2. Weightage = 100%</p>
                <p className="text-xs text-muted-foreground">
                  Across all topic rules in the blueprint
                </p>
              </li>
              <li className="rounded-md border border-border bg-secondary/30 px-3 py-2">
                <p className="font-medium">3. Difficulty mix = 100%</p>
                <p className="text-xs text-muted-foreground">Easy + medium + hard per topic rule</p>
              </li>
            </ul>
            {courseCount === 0 ? (
              <Link
                to="/admin/courses"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Create a course <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link
                to="/admin/blueprints/new"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Open blueprint editor <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </Panel>

          <Panel
            title="Your blueprints"
            description={`${data.blueprints.length} blueprint${data.blueprints.length === 1 ? "" : "s"}`}
            action={
              data.blueprints.length > 0 ? (
                <Link
                  to="/admin/series"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Optional: series <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : null
            }
          >
            {data.blueprints.length === 0 ? (
              <div>
                <EmptyState
                  icon="📐"
                  title="No blueprints yet"
                  body={
                    courseCount === 0
                      ? "Create a course first, then add a blueprint with topic weightage."
                      : "Create a blueprint with topic weightage rules."
                  }
                />
                <div className="mt-4">
                  {courseCount === 0 ? (
                    <Link
                      to="/admin/courses"
                      className="inline-flex rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Create a course
                    </Link>
                  ) : (
                    <Link
                      to="/admin/blueprints/new"
                      className="inline-flex rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      New blueprint
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {data.blueprints.map((bp) => (
                  <li
                    key={bp.id}
                    className="flex items-center justify-between gap-3 px-3 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <Link
                        to="/admin/blueprints/$blueprintId"
                        params={{ blueprintId: bp.id }}
                        className="inline-flex items-center gap-1.5 font-medium hover:underline"
                      >
                        {bp.name}
                        {bp.is_default ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            <Star className="h-3 w-3" /> Default
                          </span>
                        ) : null}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {(bp as { courses?: { name?: string } | null }).courses?.name ?? "Course"} ·
                        v{bp.version} · default {bp.default_total_questions} Q · {bp.status}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                        onClick={() => {
                          void (async () => {
                            try {
                              await markDefault({
                                data: { id: bp.id, isDefault: !bp.is_default },
                              });
                              toast.success(
                                bp.is_default ? "Default cleared" : "Set as default blueprint",
                              );
                              queryClient.invalidateQueries({ queryKey: ["admin-blueprints"] });
                            } catch (error: unknown) {
                              toast.error(
                                error instanceof Error ? error.message : "Could not update default",
                              );
                            }
                          })();
                        }}
                      >
                        <Star className="h-3.5 w-3.5" />{" "}
                        {bp.is_default ? "Unset default" : "Make default"}
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                        onClick={() => {
                          void (async () => {
                            const ok = await confirm({
                              title: "Delete blueprint?",
                              description: `Delete “${bp.name}”? Series that reference it may block deletion.`,
                              confirmLabel: "Delete",
                              tone: "destructive",
                            });
                            if (!ok) return;
                            try {
                              await removeBlueprint({ data: { id: bp.id } });
                              toast.success("Blueprint deleted");
                              queryClient.invalidateQueries({ queryKey: ["admin-blueprints"] });
                            } catch (error: unknown) {
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : "Could not delete blueprint",
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
