import { AdminNav } from "@/components/AdminNav";
import { AssessmentPerformanceBoard } from "@/components/admin/AssessmentPerformance";
import {
  AdminAccessDenied,
  AdminEmpty,
  AdminPageHeader,
  AdminPanel,
} from "@/components/admin/AdminPageUi";
import { MasteryBar, PageLoader, StatTile } from "@/components/platform";
import { UserAvatar } from "@/components/UserAvatar";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { getTeamInsight } from "@/lib/ai.functions";
import { getAdminOverview, wipePlatformData } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Trash2 } from "lucide-react";
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

function AdminPage() {
  const fetchOverview = useServerFn(getAdminOverview);
  const insight = useServerFn(getTeamInsight);
  const wipeData = useServerFn(wipePlatformData);
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [wipeConfirm, setWipeConfirm] = useState("");

  const { data, isPending, error } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview(),
    retry: false,
  });
  const insightMutation = useMutation({ mutationFn: () => insight() });
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

  return (
    <div>
      <AdminNav />
      <div className="space-y-5">
        <AdminPageHeader
          title="Overview"
          help={{
            label: "Overview",
            body: "Cohort stats and paper performance. Manage papers under Assessments. Play uses the same course pools, not exam clones.",
          }}
          action={
            <Link
              to="/admin/exams"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-secondary"
            >
              Assessments
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
          title="AI insight"
          help={{
            label: "AI insight",
            body: "Uses current mastery and attempts. Generate again after new submissions.",
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

        <AssessmentPerformanceBoard />

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
