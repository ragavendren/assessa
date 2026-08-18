import { AdminNav } from "@/components/AdminNav";
import { BlueprintEditor } from "@/components/admin/pool/BlueprintEditor";
import { Panel, QuestionBankPageHeader } from "@/components/admin/pool/QuestionBankUi";
import { AdminEmpty, StatusPill } from "@/components/admin/AdminPageUi";
import { PageLoader } from "@/components/platform";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import {
  deleteBlueprint,
  listBlueprints,
  listCourses,
  setDefaultBlueprint,
} from "@/lib/pool.functions";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Plus, Star, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/admin/blueprints/")({
  validateSearch: z.object({
    blueprintId: z.string().uuid().optional(),
    create: z.coerce.boolean().optional(),
  }),
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
  const navigate = useNavigate({ from: Route.fullPath });
  const confirm = useConfirm();
  const { blueprintId: selectedId, create: createFromSearch } = Route.useSearch();
  const fetchBlueprints = useServerFn(listBlueprints);
  const fetchCourses = useServerFn(listCourses);
  const removeBlueprint = useServerFn(deleteBlueprint);
  const markDefault = useServerFn(setDefaultBlueprint);

  const [createOpen, setCreateOpen] = useState(Boolean(createFromSearch));

  const { data: coursesData } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: () => fetchCourses(),
  });
  const { data, isPending } = useQuery({
    queryKey: ["admin-blueprints"],
    queryFn: () => fetchBlueprints({ data: {} }),
  });

  const courseCount = coursesData?.courses.length ?? 0;
  const blueprints = data?.blueprints ?? [];

  const selectedBlueprint = useMemo(
    () => (selectedId ? (blueprints.find((bp) => bp.id === selectedId) ?? null) : null),
    [blueprints, selectedId],
  );

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
    if (selectedId && blueprints.some((bp) => bp.id === selectedId)) return;
    if (blueprints.length === 0) return;
    void navigate({
      search: (prev) => ({ ...prev, blueprintId: blueprints[0]?.id }),
      replace: true,
    });
  }, [blueprints, data, navigate, selectedId]);

  function selectBlueprint(blueprintId: string) {
    void navigate({
      search: (prev) => ({ ...prev, blueprintId, create: undefined }),
      replace: true,
    });
  }

  function openCreate() {
    setCreateOpen(true);
  }

  function closeCreate() {
    setCreateOpen(false);
  }

  return (
    <div>
      <AdminNav />
      <QuestionBankPageHeader
        title="Blueprints"
        help={{
          label: "Blueprints",
          body: "Optional topic weightage (must total 100%) and Easy/Medium/Hard mix per rule. On a new paper, Random selection picks a blueprint for you.",
        }}
        action={
          courseCount > 0 ? (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> New blueprint
            </button>
          ) : null
        }
      />
      {isPending || !data ? (
        <PageLoader />
      ) : courseCount === 0 ? (
        <Panel title="Course required" description="Blueprints belong to a course.">
          <AdminEmpty
            title="Create a course first"
            body="Add a course, then return here to define topic weightage rules."
          />
          <Link
            to="/admin/courses"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to courses <ArrowRight className="h-4 w-4" />
          </Link>
        </Panel>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)] lg:items-start">
          <Panel
            title="Your blueprints"
            description={`${blueprints.length} blueprint${blueprints.length === 1 ? "" : "s"}`}
          >
            {blueprints.length === 0 ? (
              <div>
                <AdminEmpty
                  title="No blueprints yet"
                  body="Create a blueprint with topic weightage rules."
                />
                <button
                  type="button"
                  onClick={openCreate}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" /> New blueprint
                </button>
              </div>
            ) : (
              <ul className="max-h-[min(70vh,36rem)] divide-y divide-border overflow-y-auto rounded-md border border-border lg:max-h-[calc(100vh-14rem)]">
                {blueprints.map((bp) => {
                  const selected = bp.id === selectedBlueprint?.id;
                  return (
                    <li key={bp.id}>
                      <div
                        className={cn(
                          "flex items-start gap-1.5 px-2.5 py-2 text-sm transition-colors",
                          selected ? "bg-primary/5" : "hover:bg-secondary/60",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => selectBlueprint(bp.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate font-medium">{bp.name}</p>
                            {bp.is_default ? (
                              <StatusPill tone="live">
                                <Star className="h-3 w-3" /> Default
                              </StatusPill>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {(bp as { courses?: { name?: string } | null }).courses?.name ??
                              "Course"}{" "}
                            · v{bp.version} · {bp.default_total_questions} Q
                          </p>
                        </button>
                        <div className="flex shrink-0 flex-col items-end gap-0.5">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md p-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                            title={bp.is_default ? "Unset default" : "Make default"}
                            onClick={() => {
                              void (async () => {
                                try {
                                  await markDefault({
                                    data: { id: bp.id, isDefault: !bp.is_default },
                                  });
                                  toast.success(
                                    bp.is_default ? "Default cleared" : "Set as default blueprint",
                                  );
                                  queryClient.invalidateQueries({
                                    queryKey: ["admin-blueprints"],
                                  });
                                } catch (error: unknown) {
                                  toast.error(
                                    error instanceof Error
                                      ? error.message
                                      : "Could not update default",
                                  );
                                }
                              })();
                            }}
                          >
                            <Star className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md p-1.5 text-xs text-destructive hover:bg-destructive/10"
                            aria-label={`Delete ${bp.name}`}
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
                                  if (selectedId === bp.id) {
                                    const next = blueprints.find((item) => item.id !== bp.id);
                                    void navigate({
                                      search: (prev) => ({
                                        ...prev,
                                        blueprintId: next?.id,
                                      }),
                                      replace: true,
                                    });
                                  }
                                  queryClient.invalidateQueries({
                                    queryKey: ["admin-blueprints"],
                                  });
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
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {selectedBlueprint ? (
            <div className="min-h-[calc(100vh-13rem)] min-w-0 rounded-[var(--radius-md)] border border-border bg-card p-3 sm:p-4 lg:min-h-[calc(100vh-11.5rem)]">
              <div className="mb-4">
                <h2 className="text-base font-semibold tracking-tight">{selectedBlueprint.name}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Update topic rules and difficulty mix. Saving replaces all rules for this version.
                </p>
              </div>
              <BlueprintEditor
                key={selectedBlueprint.id}
                mode="edit"
                blueprintId={selectedBlueprint.id}
                onSaved={(id) => selectBlueprint(id)}
              />
            </div>
          ) : (
            <Panel
              title="Select a blueprint"
              description="Choose a blueprint from the list, or create one."
            >
              <AdminEmpty
                title="Nothing selected"
                body="Create a blueprint to define topic weightage and difficulty mix."
              />
              <button
                type="button"
                onClick={openCreate}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" /> New blueprint
              </button>
            </Panel>
          )}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={closeCreate}
        title="New blueprint"
        description="Define topic weightage and difficulty mix. Weightages must total 100%."
        size="xl"
      >
        <BlueprintEditor
          key="create-modal"
          mode="create"
          onCancel={closeCreate}
          onSaved={(id) => {
            closeCreate();
            selectBlueprint(id);
          }}
        />
      </Modal>
    </div>
  );
}
