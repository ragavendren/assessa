import { AdminNav } from "@/components/AdminNav";
import { PageLoader, SectionHeading, StatTile } from "@/components/platform";
import { getTeamInsight } from "@/lib/ai.functions";
import { cleanupSeedAssessments, getAdminOverview, updateExamSettings } from "@/lib/admin.functions";
import { MODE_LABELS, type ExamMode } from "@/lib/gamification";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Link2, Sparkles, Trash2 } from "lucide-react";
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
      { property: "og:description", content: "Manage assessments and review cohort performance." },
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
  const cleanupSeeds = useServerFn(cleanupSeedAssessments);
  const queryClient = useQueryClient();

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
            | "full_name"
            | "first_initial"
            | "display_name"
            | "anonymous",
          active: exam.active,
          starts_at: exam.startsAt,
          ends_at: exam.endsAt,
        },
      }),
    onSuccess: () => {
      toast.success("Assessment settings saved");
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not save settings"),
  });
  const cleanupMutation = useMutation({
    mutationFn: () => cleanupSeeds(),
    onSuccess: (result) => {
      toast.success(`Removed ${result.deleted} seeded assessment(s)`);
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not clean up assessments"),
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

  if (isPending) return <PageLoader />;
  if (error || !data) {
    return (
      <div className="surface-paper p-8 text-center">
        <p className="font-display text-xl">Administrator access required</p>
        <p className="mt-2 text-sm text-muted-foreground">
          This area is limited to platform administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <AdminNav />
      <SectionHeading eyebrow="Control panel" title="Admin overview" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Participants" value={data.totals.participants} />
        <StatTile label="Assessments" value={data.totals.exams} />
        <StatTile label="Attempts" value={data.totals.attempts} />
        <StatTile label="Avg score" value={data.totals.averageScore} suffix="%" />
        <StatTile label="Pass rate" value={data.totals.passRate} suffix="%" />
      </div>

      <section className="surface-paper p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-hairline text-muted-foreground">AI cohort insight</p>
          <button
            onClick={() => insightMutation.mutate()}
            disabled={insightMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {insightMutation.isPending ? "Analysing…" : "Generate"}
          </button>
        </div>
        {insightMutation.data?.text ? (
          <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
            {insightMutation.data.text
              .split("\n")
              .filter(Boolean)
              .map((line, index) => (
                <p key={index}>{line}</p>
              ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            {insightMutation.data?.error ??
              "Summarise cohort trends, weakest topics and a training recommendation."}
          </p>
        )}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SectionHeading eyebrow="Content" title="Assessments" />
          <button
            type="button"
            disabled={cleanupMutation.isPending}
            onClick={() => {
              if (window.confirm("Remove seeded demo assessments from this project?")) {
                cleanupMutation.mutate();
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {cleanupMutation.isPending ? "Cleaning…" : "Remove demo assessments"}
          </button>
        </div>
        <div className="space-y-4">
          {data.exams.length === 0 ? (
            <div className="surface-paper p-6 text-sm text-muted-foreground">
              No assessments yet. Create one to get a shareable `/take/...` link.
            </div>
          ) : null}
          {data.exams.map((exam) => (
            <article key={exam.id} className="surface-paper p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{exam.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {exam.topic} · {MODE_LABELS[exam.mode as ExamMode] ?? exam.mode} ·{" "}
                    {exam.questionCount} questions · {exam.duration} min · pass {exam.passMark}% ·{" "}
                    {exam.maxAttempts} attempt(s) allowed
                  </p>
                </div>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">
                  {exam.access}
                </span>
                <span className="text-xs text-muted-foreground">{exam.attempts} attempts</span>
                <button
                  onClick={() => void copyLink(exam.id)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-secondary"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Copy share link
                </button>
              </div>

              <div className="mt-4 grid gap-3 border-t border-border pt-4 text-xs sm:grid-cols-2">
                <label className="block">
                  <span className="text-muted-foreground">Opens at</span>
                  <input
                    type="datetime-local"
                    className="field mt-1"
                    value={toLocalInput(exam.startsAt)}
                    disabled={settingsMutation.isPending}
                    onChange={(event) =>
                      settingsMutation.mutate({
                        ...(exam as ExamRow),
                        startsAt: event.target.value
                          ? new Date(event.target.value).toISOString()
                          : null,
                      })
                    }
                  />
                </label>
                <label className="block">
                  <span className="text-muted-foreground">Closes at</span>
                  <input
                    type="datetime-local"
                    className="field mt-1"
                    value={toLocalInput(exam.endsAt)}
                    disabled={settingsMutation.isPending}
                    onChange={(event) =>
                      settingsMutation.mutate({
                        ...(exam as ExamRow),
                        endsAt: event.target.value
                          ? new Date(event.target.value).toISOString()
                          : null,
                      })
                    }
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-border pt-4 text-xs">
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
                        settingsMutation.mutate({
                          ...(exam as ExamRow),
                          [key]: event.target.checked,
                        })
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
                      settingsMutation.mutate({
                        ...(exam as ExamRow),
                        nameDisplay: event.target.value,
                      })
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
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div>
          <SectionHeading eyebrow="People" title="Participants" />
          <div className="surface-paper overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3 font-medium">Name</th>
                  <th className="p-3 font-medium">XP</th>
                  <th className="p-3 font-medium">Done</th>
                  <th className="p-3 font-medium">Avg</th>
                  <th className="p-3 font-medium">Badges</th>
                  <th className="p-3 font-medium">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.participants.map((person) => (
                  <tr key={person.id}>
                    <td className="p-3">
                      <p className="font-medium">{person.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {person.organization || "—"}
                        {person.department ? ` · ${person.department}` : ""}
                      </p>
                    </td>
                    <td className="p-3 tabular-nums">{person.xp}</td>
                    <td className="p-3 tabular-nums">{person.completed}</td>
                    <td className="p-3 tabular-nums">{person.average}%</td>
                    <td className="p-3 tabular-nums">{person.badges}</td>
                    <td className="p-3 tabular-nums">
                      {person.improvement > 0 ? "+" : ""}
                      {person.improvement}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <SectionHeading eyebrow="Insight" title="Weakest topics" />
          <div className="surface-paper space-y-3 p-5">
            {data.weakestTopics.length === 0 ? (
              <p className="text-sm text-muted-foreground">No mastery data yet.</p>
            ) : (
              data.weakestTopics.map((topic) => (
                <div key={topic.key} className="flex justify-between text-sm">
                  <span className="truncate">{topic.key}</span>
                  <span className="font-semibold tabular-nums">{topic.average}%</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
