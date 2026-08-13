import { AdminNav } from "@/components/AdminNav";
import { QuestionBankNav } from "@/components/admin/QuestionBankNav";
import { BlueprintEditor } from "@/components/admin/pool/BlueprintEditor";
import { QuestionBankPageHeader } from "@/components/admin/pool/QuestionBankUi";
import { Link, createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/blueprints/$blueprintId")({
  beforeLoad: ({ params }) => {
    if (params.blueprintId === "new") {
      throw redirect({ to: "/admin/blueprints/new" });
    }
  },
  head: () => ({
    meta: [
      { title: "Edit blueprint — Assessa Admin" },
      { name: "description", content: "Configure blueprint rules and weightage." },
    ],
  }),
  component: AdminBlueprintEditPage,
});

function AdminBlueprintEditPage() {
  const { blueprintId } = Route.useParams();
  return (
    <div>
      <AdminNav />
      <QuestionBankNav />
      <div className="mb-2">
        <Link to="/admin/blueprints" className="text-sm text-muted-foreground hover:underline">
          ← Blueprints
        </Link>
      </div>
      <QuestionBankPageHeader
        title="Edit blueprint"
        summary="Update topic rules and difficulty mix. Saving replaces all rules for this blueprint version."
        help={{
          label: "Editing tip",
          body: "Bump the version if this is a new mix you want to keep distinct from earlier generated exams.",
        }}
      />
      <BlueprintEditor mode="edit" blueprintId={blueprintId} />
    </div>
  );
}
