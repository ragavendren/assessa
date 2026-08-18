import { AdminNav } from "@/components/AdminNav";
import {
  AdminAccessDenied,
  AdminEmpty,
  AdminPageHeader,
  AdminPanel,
  ResultCount,
  StatusPill,
} from "@/components/admin/AdminPageUi";
import { OverviewNav } from "@/components/admin/OverviewNav";
import { ListToolbar, listViewClass, useListViewMode } from "@/components/ListToolbar";
import { EmptyState, MasteryBar, PageLoader, StatTile } from "@/components/platform";
import { UserAvatar } from "@/components/UserAvatar";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { DateTimeField } from "@/components/ui/date-time-field";
import { getTeamInsight } from "@/lib/ai.functions";
import {
  deleteExam,
  getAdminOverview,
  setExamPublished,
  updateExamSettings,
  wipePlatformData,
} from "@/lib/admin.functions";
import { MODE_LABELS, type ExamMode } from "@/lib/gamification";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Link2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin overview — Assessa" },
      {
        name: "description",
        content:
          "Cohort analytics, participant performance, assessment configuration and AI training recommendations.",
      },
      { property: "og:title", content: "Admin overview — Assessa" },
      {
        property: "og:description",
        content: "Manage assessments and review cohort performance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
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

function AdminPage() {
  const fetchOverview = useServerFn(getAdminOverview);
  const insight = useServerFn(getTeamInsight);
  const saveSettings = useServerFn(updateExamSettings);
  const wipeData = useServerFn(wipePlatformData);
  const removeExam = useServerFn(deleteExam);
  const publishExam = useServerFn(setExamPublished);
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [wipeConfirm, setWipeConfirm] = useState("");
  const [examSearch, setExamSearch] = useState("");
  const [examFilter, setExamFilter] = useState<"all" | "published" | "draft">("all");
  const [examView, setExamView] = useListViewMode("admin-exams", "stack");

  const { data, isPending, error } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview(),
    retry: false,
  });
  const insightMutation = useMutation({ mutationFn: () => insight() });
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
      toast.success("Assessment settings saved");
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save settings"),
  });
  const wipeMutation = useMutation({
    mutationFn: () => wipeData({ data: { confirm: "WIPE DATA" as const } }),
    onSuccess: (result) => {
      setWipeConfirm("");
      toast.success(
        `Wiped ${result.deletedExams} assessment(s) and ${result.deletedUsers} user(s). Kept ${result.preservedUsers} admin account(s).`,
      );
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Wipe failed"),
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
      toast.success(variables.active ? "Assessment published" : "Assessment unpublished");
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not update publish state"),
  });

  async function copyLink(examId: string) {
    const url = `${window.location.origin}/take/${examId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied (no login required)");
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
        <OverviewNav />
        <PageLoader />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div>
        <AdminNav />
        <OverviewNav />
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
      <OverviewNav />
      <div className="space-y-5">
        <AdminPageHeader
          eyebrow="Overview"
          title="Overview"
          summary="Cohort health, live assessments, and the settings participants see when they sit a paper."
          help={{
            label: "What lives here",
            body: "Publish, schedule, and tune XP or leaderboards without opening the full editor. Use New assessment to author questions.",
          }}
          action={
            <Link
              to="/admin/exams/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              New assessment
            </Link>
          }
        />

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          <StatTile
            label="Participants"
            value={data.totals.participants}
            hint="Registered accounts on the platform"
          />
          <StatTile
            label="Assessments"
            value={data.totals.exams}
            hint={`${data.exams.filter((exam) => exam.active).length} published`}
          />
          <StatTile label="Attempts" value={data.totals.attempts} hint="Submitted attempts only" />
          <StatTile
            label="Avg score"
            value={data.totals.averageScore}
            suffix="%"
            hint="Across submitted attempts"
          />
          <StatTile
            label="Pass rate"
            value={data.totals.passRate}
            suffix="%"
            hint="Share of submitted attempts that passed"
          />
        </div>

        <AdminPanel
          title="AI cohort insight"
          description="Summarise trends, weakest topics, and a training recommendation for this cohort."
          help={{
            label: "How this works",
            body: "Uses current mastery and attempt data. Generate again after new submissions for a fresh read.",
          }}
          action={
            <button
              type="button"
              onClick={() => insightMutation.mutate()}
              disabled={insightMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {insightMutation.isPending ? "Analysing…" : "Generate"}
            </button>
          }
        >
          {insightMutation.data?.text ? (
            <div className="rounded-md border border-border bg-secondary/20 px-4 py-3 text-sm leading-relaxed">
              {insightMutation.data.text
                .split("\n")
                .filter(Boolean)
                .map((line, index) => (
                  <p key={index} className={index > 0 ? "mt-2" : undefined}>
                    {line}
                  </p>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {insightMutation.data?.error ??
                "Generate a short briefing for trainers before the next session."}
            </p>
          )}
        </AdminPanel>

        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-hairline text-muted-foreground">Content</p>
              <h3 className="text-lg font-semibold">Assessments</h3>
            </div>
            <ResultCount shown={exams.length} total={data.exams.length} noun="assessments" />
          </div>
          <ListToolbar
            search={examSearch}
            onSearchChange={setExamSearch}
            searchPlaceholder="Search assessments…"
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
                  label: "Unpublished",
                  count: data.exams.filter((e) => !e.active).length,
                },
              ] as const
            }
            filter={examFilter}
            onFilterChange={setExamFilter}
            view={examView}
            onViewChange={setExamView}
          />
          <div className="space-y-4">
            {exams.length === 0 ? (
              <EmptyState
                icon="📋"
                title={data.exams.length === 0 ? "No assessments yet" : "No match"}
                body={
                  data.exams.length === 0
                    ? "Create one to get a shareable /take/… link participants can open without signing in."
                    : "Try a different search or filter."
                }
                action={
                  data.exams.length === 0 ? (
                    <Link
                      to="/admin/exams/new"
                      className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      <Plus className="h-4 w-4" />
                      New assessment
                    </Link>
                  ) : null
                }
              />
            ) : examView === "table" ? (
              <div className="surface-paper max-w-full overflow-hidden">
                <table className="w-full table-fixed text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="w-[40%] p-3 font-medium">Title</th>
                      <th className="hidden w-[16%] p-3 font-medium md:table-cell">Mode</th>
                      <th className="hidden w-[14%] p-3 font-medium lg:table-cell">Access</th>
                      <th className="w-[16%] p-3 font-medium">Status</th>
                      <th className="hidden w-[10%] p-3 font-medium sm:table-cell">Attempts</th>
                      <th className="w-[18%] p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {exams.map((exam) => (
                      <tr key={exam.id} className="hover:bg-secondary/30">
                        <td className="p-3">
                          <p className="truncate font-medium">{exam.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{exam.topic}</p>
                        </td>
                        <td className="hidden p-3 md:table-cell">
                          {MODE_LABELS[exam.mode as ExamMode] ?? exam.mode}
                        </td>
                        <td className="hidden p-3 lg:table-cell">
                          <StatusPill>{exam.access}</StatusPill>
                        </td>
                        <td className="p-3">
                          <StatusPill tone={exam.active ? "live" : "draft"}>
                            {exam.active ? "Published" : "Draft"}
                          </StatusPill>
                        </td>
                        <td className="hidden p-3 tabular-nums sm:table-cell">{exam.attempts}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1.5">
                            <Link
                              to="/admin/exams/$examId"
                              params={{ examId: exam.id }}
                              className={ghostBtn}
                            >
                              Edit
                            </Link>
                            <button
                              type="button"
                              className={ghostBtn}
                              onClick={() => void copyLink(exam.id)}
                            >
                              Link
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : examView === "grid" ? (
              <div className={listViewClass("grid")}>
                {exams.map((exam) => (
                  <article key={exam.id} className="surface-paper flex flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{exam.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {exam.topic} · {MODE_LABELS[exam.mode as ExamMode] ?? exam.mode}
                        </p>
                      </div>
                      <StatusPill tone={exam.active ? "live" : "draft"}>
                        {exam.active ? "Live" : "Draft"}
                      </StatusPill>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {exam.questionCount} Q · {exam.duration} min · {exam.attempts} attempts
                    </p>
                    <div className="mt-auto flex flex-wrap gap-2 pt-3">
                      <Link
                        to="/admin/exams/$examId"
                        params={{ examId: exam.id }}
                        className={ghostBtn}
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => void copyLink(exam.id)}
                        className={ghostBtn}
                      >
                        Copy link
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              exams.map((exam) => (
                <article key={exam.id} className="surface-paper p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{exam.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {exam.topic} · {MODE_LABELS[exam.mode as ExamMode] ?? exam.mode} ·{" "}
                        {exam.questionCount} questions · {exam.duration} min · pass {exam.passMark}%
                        · {exam.maxAttempts} attempt(s) allowed
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill>{exam.access}</StatusPill>
                      <StatusPill tone={exam.active ? "live" : "draft"}>
                        {exam.active ? "Published" : "Unpublished"}
                      </StatusPill>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {exam.attempts} attempts
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        to="/admin/exams/$examId"
                        params={{ examId: exam.id }}
                        className={ghostBtn}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => void copyLink(exam.id)}
                        className={ghostBtn}
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        Copy share link
                      </button>
                      <button
                        type="button"
                        disabled={publishMutation.isPending}
                        onClick={() =>
                          publishMutation.mutate({
                            examId: exam.id,
                            active: !exam.active,
                          })
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
                            description: `Delete “${exam.title}”? This removes questions and attempt history for this assessment.`,
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
                      label="Opens at"
                      hint="Leave empty to open immediately when published"
                      value={toLocalInput(exam.startsAt)}
                      disabled={settingsMutation.isPending}
                      onChange={(value) =>
                        patchExam(exam as ExamRow, {
                          startsAt: value ? new Date(value).toISOString() : null,
                        })
                      }
                    />
                    <DateTimeField
                      label="Closes at"
                      hint="Leave empty for no closing time"
                      value={toLocalInput(exam.endsAt)}
                      min={toLocalInput(exam.startsAt) || undefined}
                      disabled={settingsMutation.isPending}
                      onChange={(value) =>
                        patchExam(exam as ExamRow, {
                          endsAt: value ? new Date(value).toISOString() : null,
                        })
                      }
                    />
                  </div>

                  <div className="mt-4 rounded-lg border border-border bg-secondary/20 px-4 py-3">
                    <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      Participant experience
                    </p>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-xs">
                      {(
                        [
                          ["active", "Published"],
                          ["enableXp", "XP"],
                          ["enableBadges", "Badges"],
                          ["enableLeaderboard", "Leaderboard"],
                          ["showRank", "Show rank"],
                          ["showOthers", "Show others"],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key} className="inline-flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={Boolean(exam[key])}
                            disabled={settingsMutation.isPending}
                            onChange={(event) =>
                              patchExam(exam as ExamRow, { [key]: event.target.checked })
                            }
                          />
                          {label}
                        </label>
                      ))}
                      <label className="inline-flex items-center gap-1.5">
                        Names
                        <select
                          value={exam.nameDisplay}
                          disabled={settingsMutation.isPending}
                          onChange={(event) =>
                            patchExam(exam as ExamRow, { nameDisplay: event.target.value })
                          }
                          className="rounded-md border border-input bg-card px-2 py-1"
                        >
                          <option value="full_name">Full name</option>
                          <option value="first_initial">First + initial</option>
                          <option value="display_name">Display name</option>
                          <option value="anonymous">Anonymous</option>
                        </select>
                      </label>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start">
          <AdminPanel
            title="Participants"
            description="XP, completions and recent score movement across the cohort."
            action={
              <Link to="/admin/users" className="text-xs font-medium text-primary hover:underline">
                User management
              </Link>
            }
          >
            {data.participants.length === 0 ? (
              <AdminEmpty
                title="No participants yet"
                body="When people sign up they will appear here with XP and attempt stats."
              />
            ) : (
              <div className="max-w-full overflow-hidden">
                <table className="w-full table-fixed text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="w-[36%] p-3 font-medium">Name</th>
                      <th className="w-[12%] p-3 font-medium">XP</th>
                      <th className="w-[12%] p-3 font-medium">Done</th>
                      <th className="w-[14%] p-3 font-medium">Avg</th>
                      <th className="hidden w-[12%] p-3 font-medium sm:table-cell">Badges</th>
                      <th className="hidden w-[14%] p-3 font-medium md:table-cell">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.participants.map((person) => (
                      <tr key={person.id} className="hover:bg-secondary/30">
                        <td className="p-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <UserAvatar name={person.name} className="h-8 w-8 shrink-0" />
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{person.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {person.organization || "—"}
                                {person.department ? ` · ${person.department}` : ""}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="p-3 tabular-nums">{person.xp}</td>
                        <td className="p-3 tabular-nums">{person.completed}</td>
                        <td className="p-3 tabular-nums">{person.average}%</td>
                        <td className="hidden p-3 tabular-nums sm:table-cell">{person.badges}</td>
                        <td
                          className={cn(
                            "hidden p-3 tabular-nums md:table-cell",
                            person.improvement > 0 && "text-success",
                            person.improvement < 0 && "text-destructive",
                          )}
                        >
                          {person.improvement > 0 ? "+" : ""}
                          {person.improvement}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdminPanel>

          <AdminPanel
            title="Weakest topics"
            description="Lowest average mastery — a cue for the next training block."
            help={{
              label: "How this is scored",
              body: "Averaged from topic mastery after submitted attempts. Empty until participants complete papers.",
            }}
          >
            {data.weakestTopics.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-secondary/20 px-3 py-8 text-center text-sm text-muted-foreground">
                No mastery data yet.
              </p>
            ) : (
              <div className="space-y-4">
                {data.weakestTopics.map((topic) => (
                  <MasteryBar key={topic.key} label={topic.key} value={topic.average} />
                ))}
              </div>
            )}
          </AdminPanel>
        </section>

        <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <p className="text-hairline text-destructive">Danger zone</p>
          <h3 className="mt-0.5 text-lg font-semibold">Wipe platform data</h3>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Permanently delete all assessments, invitations, attempts, and every user except the
            seeded admin (<code className="text-xs">SEED_ADMIN_EMAIL</code>) and your current admin
            account. Baseline levels, badges and XP rules are kept.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block min-w-0 flex-1">
              <span className="text-hairline text-muted-foreground">
                Type <strong>WIPE DATA</strong> to confirm
              </span>
              <input
                value={wipeConfirm}
                onChange={(event) => setWipeConfirm(event.target.value)}
                className="field mt-1.5"
                placeholder="WIPE DATA"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <button
              type="button"
              disabled={wipeConfirm !== "WIPE DATA" || wipeMutation.isPending}
              onClick={() => {
                void (async () => {
                  const ok = await confirm({
                    title: "Wipe all platform data?",
                    description:
                      "This cannot be undone. Wipe all assessments and non-admin users now?",
                    confirmLabel: "Wipe all data",
                    tone: "destructive",
                  });
                  if (!ok) return;
                  wipeMutation.mutate();
                })();
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {wipeMutation.isPending ? "Wiping…" : "Wipe all data"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
