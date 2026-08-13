import { AdminNav } from "@/components/AdminNav";
import { QuestionBankNav } from "@/components/admin/QuestionBankNav";
import { HelpTip, Panel, QuestionBankPageHeader } from "@/components/admin/pool/QuestionBankUi";
import { EmptyState, PageLoader } from "@/components/platform";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { downloadPoolQuestionCsvTemplate, parsePoolQuestionsCsv } from "@/lib/pool-questions-csv";
import {
  clearPoolQuestions,
  deletePoolQuestion,
  importPoolQuestionsCsv,
  listPoolQuestions,
  listQuestionPools,
} from "@/lib/pool.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download, Eraser, Trash2, Upload } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/pools/$poolId")({
  head: () => ({
    meta: [
      { title: "Pool questions — Assessa Admin" },
      { name: "description", content: "Import and manage questions in a pool bank." },
    ],
  }),
  component: AdminPoolDetailPage,
});

function AdminPoolDetailPage() {
  const { poolId } = Route.useParams();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const fetchQuestions = useServerFn(listPoolQuestions);
  const fetchPools = useServerFn(listQuestionPools);
  const importCsv = useServerFn(importPoolQuestionsCsv);
  const removeQuestion = useServerFn(deletePoolQuestion);
  const clearQuestions = useServerFn(clearPoolQuestions);

  const { data: poolsData } = useQuery({
    queryKey: ["admin-pools"],
    queryFn: () => fetchPools({ data: {} }),
  });
  const pool = (poolsData?.pools ?? []).find((p) => p.id === poolId);

  const { data, isPending } = useQuery({
    queryKey: ["admin-pool-questions", poolId],
    queryFn: () => fetchQuestions({ data: { poolId } }),
  });

  const importMutation = useMutation({
    mutationFn: (csvText: string) => importCsv({ data: { poolId, csvText } }),
    onSuccess: (result) => {
      if (result.imported > 0) {
        toast.success(`Imported ${result.imported} question(s)`);
      } else {
        toast.error(result.errors[0] ?? "No questions imported");
      }
      if (result.imported > 0 && result.errors.length) {
        toast.message(
          `${result.errors.length} row(s) skipped: ${result.errors.slice(0, 2).join("; ")}`,
        );
      }
      queryClient.invalidateQueries({ queryKey: ["admin-pool-questions", poolId] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Import failed. Check the CSV format."),
  });

  return (
    <div>
      <AdminNav />
      <QuestionBankNav />
      <div className="mb-2">
        <Link to="/admin/pools" className="text-sm text-muted-foreground hover:underline">
          ← Question pools
        </Link>
      </div>
      <QuestionBankPageHeader
        title={pool?.name ?? "Pool questions"}
        summary="Import bank questions with topic and difficulty so blueprints can select a balanced paper. Keep the header row from the pool template."
        help={{
          label: "CSV tips",
          body: (
            <span>
              Correct answers: A–F or 1–6. Difficulty: easy, medium, or hard. Topic names should
              match blueprint rules. Assessment CSV upload on New assessment is a different flow.
            </span>
          ),
        }}
      />

      <Panel
        title="Import questions"
        description="Download the template, fill rows in Excel or Sheets, then import the CSV."
        help={{
          label: "What gets imported",
          body: "Prompt, options, answers, topic, subtopic, difficulty, skill, tags, explanation, and marks.",
        }}
        className="mb-6"
      >
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadPoolQuestionCsvTemplate()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-secondary"
          >
            <Download className="h-4 w-4" /> Download CSV template
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={importMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />{" "}
            {importMutation.isPending ? "Importing…" : "Import questions CSV"}
          </button>
          {(data?.questions.length ?? 0) > 0 ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
              onClick={() => {
                void (async () => {
                  const ok = await confirm({
                    title: "Clear all pool questions?",
                    description:
                      "This permanently removes every question in this pool. Existing exam clones are kept.",
                    confirmLabel: "Clear all",
                    tone: "destructive",
                  });
                  if (!ok) return;
                  try {
                    const result = await clearQuestions({ data: { poolId } });
                    toast.success(`Cleared ${result.deleted} question(s)`);
                    queryClient.invalidateQueries({ queryKey: ["admin-pool-questions", poolId] });
                  } catch (error: unknown) {
                    toast.error(error instanceof Error ? error.message : "Could not clear pool");
                  }
                })();
              }}
            >
              <Eraser className="h-4 w-4" /> Clear all
            </button>
          ) : null}
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            Need help?
            <HelpTip label="Import help">
              Keep the header row. Empty option columns are fine. Multi-select answers can be A|B.
            </HelpTip>
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void file.text().then((text) => {
                const { questions, errors } = parsePoolQuestionsCsv(text);
                if (questions.length === 0) {
                  toast.error(
                    errors.slice(0, 3).join(" · ") ||
                      "No valid rows. Keep the header row from the pool template.",
                  );
                  return;
                }
                if (errors.length) {
                  toast.message(`${errors.length} row(s) will be skipped`);
                }
                importMutation.mutate(text);
              });
              e.target.value = "";
            }}
          />
        </div>
      </Panel>

      {isPending || !data ? (
        <PageLoader />
      ) : data.questions.length === 0 ? (
        <Panel
          title="Pool inventory"
          description="Nothing imported yet — start with the CSV template above."
        >
          <EmptyState
            icon="❓"
            title="No questions in this pool yet"
            body="Use Download CSV template above, fill your questions, then click Import questions CSV."
          />
        </Panel>
      ) : (
        <Panel
          title="Pool inventory"
          description={`${data.questions.length} question(s) available for blueprint selection.`}
          help={{
            label: "Topic matching",
            body: "Blueprint rules match on Topic (and optional Subtopic). Keep naming consistent with your blueprints.",
          }}
        >
          <div className="-mx-1 overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border bg-secondary/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Prompt</th>
                  <th className="px-4 py-2.5">Topic</th>
                  <th className="px-4 py-2.5">Difficulty</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.questions.map((q) => (
                  <tr key={q.id} className="hover:bg-secondary/20">
                    <td className="max-w-md truncate px-4 py-2.5">{q.prompt}</td>
                    <td className="px-4 py-2.5">{q.topic}</td>
                    <td className="px-4 py-2.5 capitalize">{q.difficulty}</td>
                    <td className="px-4 py-2.5">{q.status}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        className="text-destructive hover:underline"
                        aria-label="Delete question"
                        onClick={() => {
                          void (async () => {
                            const ok = await confirm({
                              title: "Delete pool question?",
                              description:
                                "This removes the bank item. Existing exam clones are kept.",
                              confirmLabel: "Delete",
                              tone: "destructive",
                            });
                            if (!ok) return;
                            try {
                              await removeQuestion({ data: { id: q.id } });
                              toast.success("Deleted");
                              queryClient.invalidateQueries({
                                queryKey: ["admin-pool-questions", poolId],
                              });
                            } catch (error: unknown) {
                              toast.error(
                                error instanceof Error ? error.message : "Could not delete",
                              );
                            }
                          })();
                        }}
                      >
                        <Trash2 className="inline h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
