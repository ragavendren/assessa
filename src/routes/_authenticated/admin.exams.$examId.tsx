import { AdminNav } from "@/components/AdminNav";
import { ExamEditor, examToEditorValues } from "@/components/admin/ExamEditor";
import { AdminPageHeader } from "@/components/admin/AdminPageUi";
import { PageLoader } from "@/components/platform";
import { getExamForEdit, updateExam } from "@/lib/admin.functions";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/admin/exams/$examId")({
  beforeLoad: ({ params }) => {
    if (
      params.examId === "new" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.examId)
    ) {
      throw redirect({ to: "/admin/exams/new" });
    }
  },
  head: () => ({
    meta: [
      { title: "Edit assessment — Assessa" },
      {
        name: "description",
        content: "Edit assessment details, questions, and publish state.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: EditExamPage,
});

function EditExamPage() {
  const { examId } = Route.useParams();
  const navigate = useNavigate();
  const fetchExam = useServerFn(getExamForEdit);
  const saveExam = useServerFn(updateExam);

  const { data, isPending, error } = useQuery({
    queryKey: ["exam-edit", examId],
    queryFn: () => fetchExam({ data: { examId } }),
    retry: false,
  });

  return (
    <div>
      <AdminNav />
      <AdminPageHeader
        eyebrow="Content"
        title="Edit assessment"
        summary="Update details, questions, and publish state. Saving keeps existing attempt history."
        help={{
          label: "What you can change",
          body: "Access, schedule, and the question set can all be edited. Regenerating from a pool replaces cloned questions only.",
        }}
      />
      {isPending ? (
        <PageLoader label="Loading assessment…" />
      ) : error || !data ? (
        <div className="surface-paper p-8 text-center">
          <p className="font-display text-xl">Could not load this assessment</p>
          <p className="mt-2 text-sm text-muted-foreground">
            It may have been deleted, or you may not have access.
          </p>
        </div>
      ) : (
        <ExamEditor
          mode="edit"
          examId={examId}
          canRegenerate={data.exam.can_regenerate}
          initial={examToEditorValues(data.exam)}
          categories={data.categories}
          onSubmit={async (payload) =>
            saveExam({
              data: {
                examId,
                ...payload,
              },
            })
          }
          onSuccess={() => navigate({ to: "/admin" })}
        />
      )}
    </div>
  );
}
