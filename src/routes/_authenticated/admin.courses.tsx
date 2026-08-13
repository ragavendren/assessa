import { AdminNav } from "@/components/AdminNav";
import { QuestionBankNav } from "@/components/admin/QuestionBankNav";
import {
  FieldLabel,
  Panel,
  QUESTION_BANK_STEPS,
  QuestionBankPageHeader,
  QuestionBankWorkflow,
} from "@/components/admin/pool/QuestionBankUi";
import { EmptyState, PageLoader } from "@/components/platform";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { deleteCourse, listCourses, upsertCourse } from "@/lib/pool.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/courses")({
  head: () => ({
    meta: [
      { title: "Courses — Assessa Admin" },
      { name: "description", content: "Manage courses that scope question pools and blueprints." },
    ],
  }),
  component: AdminCoursesPage,
});

function AdminCoursesPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const fetchCourses = useServerFn(listCourses);
  const saveCourse = useServerFn(upsertCourse);
  const removeCourse = useServerFn(deleteCourse);
  const [name, setName] = useState("");

  const { data, isPending } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: () => fetchCourses(),
  });

  const mutation = useMutation({
    mutationFn: () => saveCourse({ data: { name } }),
    onSuccess: () => {
      toast.success("Course saved");
      setName("");
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not save course"),
  });

  return (
    <div>
      <AdminNav />
      <QuestionBankNav />
      <QuestionBankPageHeader
        title="Courses"
        summary="A course is the top-level container for question pools, blueprints, and series. Assessment category/topic on exams stays separate for access and mastery."
        help={{
          label: "What is a course?",
          body: (
            <span>
              Create one course per subject or certification track (for example “AWS Associate”). You
              will attach pools and blueprints to it next.
            </span>
          ),
        }}
      />
      <QuestionBankWorkflow steps={[...QUESTION_BANK_STEPS]} current={0} />

      {isPending || !data ? (
        <PageLoader />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
          <Panel
            title="Add course"
            description="Name should be unique and recognisable to authors."
            help={{
              label: "Naming tip",
              body: "Use the programme or exam family name. Avoid version numbers here — put those on blueprints.",
            }}
          >
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim().length < 2) {
                  toast.error("Course name is required");
                  return;
                }
                mutation.mutate();
              }}
            >
              <div>
                <FieldLabel
                  htmlFor="course-name"
                  help={{
                    label: "Course name",
                    body: "Shown when configuring pools, blueprints, and pool-based assessments.",
                  }}
                >
                  Course name *
                </FieldLabel>
                <input
                  id="course-name"
                  className="field w-full"
                  placeholder="e.g. AWS Solutions Architect"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                />
              </div>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 sm:w-auto"
              >
                <Plus className="h-4 w-4" /> Add course
              </button>
            </form>
          </Panel>

          <Panel
            title="Your courses"
            description={`${data.courses.length} course${data.courses.length === 1 ? "" : "s"}`}
            action={
              data.courses.length > 0 ? (
                <Link
                  to="/admin/pools"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Next: pools <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : null
            }
          >
            {data.courses.length === 0 ? (
              <EmptyState
                icon="📚"
                title="No courses yet"
                body="Add your first course, then create a question pool for it."
              />
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {data.courses.map((course) => (
                  <li
                    key={course.id}
                    className="flex items-center justify-between gap-3 px-3 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{course.name}</p>
                      <p className="text-xs capitalize text-muted-foreground">{course.status}</p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                      onClick={() => {
                        void (async () => {
                          const ok = await confirm({
                            title: "Delete course?",
                            description: `Delete “${course.name}” and its pools, blueprints, and series?`,
                            confirmLabel: "Delete",
                            tone: "destructive",
                          });
                          if (!ok) return;
                          try {
                            await removeCourse({ data: { id: course.id } });
                            toast.success("Course deleted");
                            queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
                          } catch (error: unknown) {
                            toast.error(
                              error instanceof Error ? error.message : "Could not delete course",
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
