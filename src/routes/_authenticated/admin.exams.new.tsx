import { AdminNav } from "@/components/AdminNav";
import { ExamEditor } from "@/components/admin/ExamEditor";
import { AdminPageHeader } from "@/components/admin/AdminPageUi";
import { OverviewNav } from "@/components/admin/OverviewNav";
import { PageLoader } from "@/components/platform";
import { createExam, listExamCategories } from "@/lib/admin.functions";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/admin/exams/new")({
  head: () => ({
    meta: [
      { title: "New assessment — Assessa" },
      {
        name: "description",
        content:
          "Create a course assessment: set category, mode, duration, pass mark, availability window, and questions.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: NewExamPage,
});

function NewExamPage() {
  const navigate = useNavigate();
  const submit = useServerFn(createExam);
  const fetchCategories = useServerFn(listExamCategories);

  const { data, isPending } = useQuery({
    queryKey: ["exam-categories"],
    queryFn: () => fetchCategories(),
    retry: false,
  });

  return (
    <div>
      <AdminNav />
      <OverviewNav />
      <AdminPageHeader
        eyebrow="Overview"
        title="New assessment"
        summary="Set the paper, access, schedule, and questions. A shareable /take/… link is copied when you publish."
        help={{
          label: "Authoring path",
          body: "Upload a CSV or generate from a question pool and blueprint. Preview matches what participants see on results.",
        }}
      />
      {isPending ? (
        <PageLoader label="Loading editor…" />
      ) : (
        <ExamEditor
          mode="create"
          categories={data?.categories ?? []}
          onSubmit={async (payload) => submit({ data: payload })}
          onSuccess={(examId) => {
            void navigator.clipboard.writeText(`${window.location.origin}/take/${examId}`);
            navigate({ to: "/admin" });
          }}
        />
      )}
    </div>
  );
}
