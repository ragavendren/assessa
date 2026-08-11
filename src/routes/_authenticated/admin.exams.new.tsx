import { AdminNav } from "@/components/AdminNav";
import { ExamEditor } from "@/components/admin/ExamEditor";
import { PageLoader, SectionHeading } from "@/components/platform";
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
      <SectionHeading eyebrow="Content" title="New assessment" />
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
