import { AdminNav } from "@/components/AdminNav";
import { QuestionBankNav } from "@/components/admin/QuestionBankNav";
import { BlueprintEditor } from "@/components/admin/pool/BlueprintEditor";
import { QuestionBankPageHeader } from "@/components/admin/pool/QuestionBankUi";
import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/blueprints/new")({
  head: () => ({
    meta: [
      { title: "New blueprint — Assessa Admin" },
      { name: "description", content: "Create a course blueprint with topic weightage rules." },
    ],
  }),
  component: AdminBlueprintNewPage,
});

function AdminBlueprintNewPage() {
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
        title="New blueprint"
        summary="Define topic weightage and difficulty mix. Weightages must total 100%, and each rule’s Easy/Medium/Hard mix must also total 100%."
        help={{
          label: "Before you start",
          body: "Have a course ready and preferably pool questions tagged with the same topic names you will use in rules.",
        }}
      />
      <BlueprintEditor mode="create" />
    </div>
  );
}
