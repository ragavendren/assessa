import { AdminNav } from "@/components/AdminNav";
import {
  AdminAccessDenied,
  AdminPageHeader,
  ResultCount,
  StatusPill,
} from "@/components/admin/AdminPageUi";
import { ListToolbar, useListViewMode } from "@/components/ListToolbar";
import { EmptyState, PageLoader } from "@/components/platform";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { DateTimeField } from "@/components/ui/date-time-field";
import {
  deleteExam,
  getAdminOverview,
  setExamPublished,
  updateExamSettings,
} from "@/lib/admin.functions";
import { MODE_LABELS, type ExamMode } from "@/lib/gamification";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/exams/")({
  head: () => ({
    meta: [
      { title: "Assessments — Assessa Admin" },
      { name: "description", content: "Create, publish, and schedule assessment papers." },
    ],
  }),
  component: AdminExamsPage,
});

type ExamRow = {
  id: string;
  title: string;
  topic: string;
  mode: string;
  access: string;
  active: boolean;
  passMark: number;
  questionCount: number;
  duration: number;
  maxAttempts: number;
  enableXp: boolean;
  enableBadges: boolean;
  enableLeaderboard: boolean;
  showRank: boolean;
  showOthers: boolean;
  nameDisplay: string;
  startsAt: string | null;
  endsAt: string | null;
  attempts: number;
};

const ghostBtn =
  "inline-flex items-center gap-1.5 rounded-md border border-input bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-60";

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function AdminExamsPage() {
  const fetchOverview = useServerFn(getAdminOverview);
  const saveSettings = useServerFn(updateExamSettings);
  const removeExam = useServerFn(deleteExam);
  const publishExam = useServerFn(setExamPublished);
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [examSearch, setExamSearch] = useState("");
  const [examFilter, setExamFilter] = useState<"all" | "published" | "draft">("all");
  const [examView, setExamView] = useListViewMode("admin-exams", "stack");

  const { data, isPending, error } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview(),
    retry: false,
  });
  const settingsMutation = useMutation({
    mutationFn: (exam: ExamRow) =>
      saveSettings({
        data: {
          examId: exam.id,
          enable_xp: exam.enableXp,
          enable_badges: exam.enableBadges,
          enable_leaderboard: exam.enableLeaderboard,
          show_rank: exam.showRank,
          show_others: exam.showOthers,
          leaderboard_name_display: exam.nameDisplay as
            "full_name" | "first_initial" | "display_name" | "anonymous",
          active: exam.active,
          starts_at: exam.startsAt,
          ends_at: exam.endsAt,
        },
      }),
    onSuccess: () => {
      toast.success("Saved");
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save"),
  });
  const deleteMutation = useMutation({
    mutationFn: (examId: string) => removeExam({ data: { examId } }),
    onSuccess: () => {
      toast.success("Assessment deleted");
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not delete assessment"),
  });
  const publishMutation = useMutation({
    mutationFn: (payload: { examId: string; active: boolean }) => publishExam({ data: payload }),
    onSuccess: (_, variables) => {
      toast.success(variables.active ? "Published" : "Unpublished");
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update"),
  });

  async function copyLink(examId: string) {
    const url = `${window.location.origin}/take/${examId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied");
    } catch {
      toast.info(url);
    }
  }

  function patchExam(exam: ExamRow, patch: Partial<ExamRow>) {
    settingsMutation.mutate({ ...exam, ...patch });
  }

  if (isPending) {
    return (
      <div>
        <AdminNav />
        <PageLoader />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div>
        <AdminNav />
        <AdminAccessDenied />
      </div>
    );
  }

  const exams = data.exams.filter((exam) => {
    if (examFilter === "published" && !exam.active) return false;
    if (examFilter === "draft" && exam.active) return false;
    const q = examSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      exam.title.toLowerCase().includes(q) ||
      exam.topic.toLowerCase().includes(q) ||
      exam.mode.toLowerCase().includes(q) ||
      exam.access.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <AdminNav />
      <AdminPageHeader
        title="Assessments"
        help={{
          label: "Assessments vs Play",
          body: "These are official papers. Play games use course pools separately and never clone a paper.",
        }}
        action={
          <Link
            to="/admin/exams/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New
          </Link>
        }
      />
      <ListToolbar
        search={examSearch}
        onSearchChange={setExamSearch}
        searchPlaceholder="Search papers…"
        filters={
          [
            { value: "all" as const, label: "All", count: data.exams.length },
            {
              value: "published" as const,
              label: "Published",
              count: data.exams.filter((e) => e.active).length,
            },
            {
              value: "draft" as const,
              label: "Draft",
              count: data.exams.filter((e) => !e.active).length,
            },
          ] as const
        }
        filter={examFilter}
        onFilterChange={setExamFilter}
        view={examView}
        onViewChange={setExamView}
      />
      <div className="mb-3">
        <ResultCount shown={exams.length} total={data.exams.length} noun="papers" />
      </div>
      {exams.length === 0 ? (
        <EmptyState
          icon="📋"
          title={data.exams.length === 0 ? "No assessments yet" : "No match"}
          body={
            data.exams.length === 0 ? "Create a paper to get a shareable /take/… link." : undefined
          }
          action={
            data.exams.length === 0 ? (
              <Link
                to="/admin/exams/new"
                className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
              >
                <Plus className="h-4 w-4" />
                New
              </Link>
            ) : null
          }
        />
      ) : (
        <div className="space-y-4">
          {exams.map((exam) => (
            <article key={exam.id} className="surface-paper p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{exam.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {exam.topic} · {MODE_LABELS[exam.mode as ExamMode] ?? exam.mode} ·{" "}
                    {exam.questionCount} Q · {exam.duration} min
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={exam.active ? "live" : "draft"}>
                    {exam.active ? "Published" : "Draft"}
                  </StatusPill>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {exam.attempts} attempts
                  </span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                <div className="flex flex-wrap gap-2">
                  <Link to="/admin/exams/$examId" params={{ examId: exam.id }} className={ghostBtn}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Link>
                  <button type="button" onClick={() => void copyLink(exam.id)} className={ghostBtn}>
                    <Link2 className="h-3.5 w-3.5" />
                    Link
                  </button>
                  <button
                    type="button"
                    disabled={publishMutation.isPending}
                    onClick={() =>
                      publishMutation.mutate({ examId: exam.id, active: !exam.active })
                    }
                    className={ghostBtn}
                  >
                    {exam.active ? "Unpublish" : "Publish"}
                  </button>
                </div>
                <button
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    void (async () => {
                      const ok = await confirm({
                        title: "Delete assessment?",
                        description: `Delete “${exam.title}”?`,
                        confirmLabel: "Delete",
                        tone: "destructive",
                      });
                      if (!ok) return;
                      deleteMutation.mutate(exam.id);
                    })();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <DateTimeField
                  label="Opens"
                  value={toLocalInput(exam.startsAt)}
                  disabled={settingsMutation.isPending}
                  onChange={(value) =>
                    patchExam(exam, { startsAt: value ? new Date(value).toISOString() : null })
                  }
                />
                <DateTimeField
                  label="Closes"
                  value={toLocalInput(exam.endsAt)}
                  min={toLocalInput(exam.startsAt) || undefined}
                  disabled={settingsMutation.isPending}
                  onChange={(value) =>
                    patchExam(exam, { endsAt: value ? new Date(value).toISOString() : null })
                  }
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
