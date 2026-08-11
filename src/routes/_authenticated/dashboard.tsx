import {
  EmptyState,
  LevelMeter,
  MasteryBar,
  PageLoader,
  ScorePill,
  SectionHeading,
  StatTile,
} from "@/components/platform";
import { getParticipantInsight } from "@/lib/ai.functions";
import { formatDate } from "@/lib/gamification";
import { getDashboard } from "@/lib/platform.functions";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Assessa" },
      {
        name: "description",
        content:
          "Your assessment dashboard: level, XP, recent results, topic mastery and upcoming exams.",
      },
      { property: "og:title", content: "Dashboard — Assessa" },
      {
        property: "og:description",
        content: "Track your level, XP, badges and assessment results in one place.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const fetchDashboard = useServerFn(getDashboard);
  const { data, isPending } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchDashboard(),
  });

  const insight = useServerFn(getParticipantInsight);
  const insightMutation = useMutation({ mutationFn: () => insight() });

  if (isPending || !data) return <PageLoader />;

  const passStreak = data.streaks.find((s) => s.type === "pass");
  const topMastery = [...data.mastery].sort((a, b) => b.mastery - a.mastery).slice(0, 5);
  const weakest = [...data.mastery].sort((a, b) => a.mastery - b.mastery).slice(0, 3);
  const trendMax = Math.max(100, ...data.trend.map((t) => t.score));

  return (
    <div className="space-y-10">
      <header>
        <p className="text-hairline text-muted-foreground">Welcome back</p>
        <h1 className="mt-1 font-display text-3xl">
          {data.profile.display_name || data.profile.full_name || "Participant"}
        </h1>
      </header>

      <div className="grid gap-4 md:grid-cols-[1.1fr_2fr]">
        <LevelMeter {...data.level} />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Average" value={data.stats.average} suffix="%" />
          <StatTile label="Completed" value={data.stats.completed} />
          <StatTile label="Pass rate" value={data.stats.passRate} suffix="%" />
          <StatTile
            label="Pass streak"
            value={passStreak?.current ?? 0}
            hint={`Longest ${passStreak?.longest ?? 0}`}
          />
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionHeading
            eyebrow="Next up"
            title="Available assessments"
            action={
              <Link to="/exams" className="text-sm text-accent underline-offset-4 hover:underline">
                View all
              </Link>
            }
          />
          {data.upcoming.length === 0 && data.availableCount === 0 ? (
            <EmptyState
              icon="🗂"
              title="No assessments assigned yet"
              body="Public assessments and invitations will appear here."
            />
          ) : (
            <div className="space-y-3">
              <div className="surface-paper p-4">
                <p className="text-hairline text-muted-foreground">Ready to take</p>
                <p className="mt-1 font-display text-2xl">
                  {data.availableCount} assessment{data.availableCount === 1 ? "" : "s"}
                </p>
                <Link
                  to="/exams"
                  className="mt-3 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Browse assessments
                </Link>
              </div>
              {data.upcoming.map((exam) => (
                <Link
                  key={exam.id}
                  to="/exams/$examId"
                  params={{ examId: exam.id }}
                  className="surface-paper block p-4 transition-colors hover:bg-secondary/40"
                >
                  <p className="text-hairline text-muted-foreground">{exam.topic}</p>
                  <p className="mt-1 font-medium">{exam.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {exam.questionCount} questions · {exam.duration} min ·{" "}
                    {exam.startsAt ? `Opens ${formatDate(exam.startsAt)}` : "Open now"}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionHeading eyebrow="History" title="Recent results" />
          {data.recent.length === 0 ? (
            <EmptyState
              icon="📈"
              title="No results yet"
              body="Complete an assessment to start building your performance history."
            />
          ) : (
            <div className="surface-paper divide-y divide-border">
              {data.recent.map((result) => (
                <Link
                  key={result.id}
                  to="/results/$attemptId"
                  params={{ attemptId: result.id }}
                  className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-secondary/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{result.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {result.topic} · {formatDate(result.submittedAt)}
                    </p>
                  </div>
                  <ScorePill score={result.score} passed={result.passed} />
                </Link>
              ))}
            </div>
          )}

          {data.trend.length > 1 ? (
            <div className="surface-paper mt-4 p-4">
              <p className="text-hairline text-muted-foreground">Score trend</p>
              <div className="mt-4 flex h-28 items-end gap-2">
                {data.trend.map((point, index) => (
                  <div key={index} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-accent/80"
                      style={{ height: `${(point.score / trendMax) * 100}%` }}
                      title={`${point.score}%`}
                    />
                    <span className="text-[10px] text-muted-foreground">{point.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionHeading
            eyebrow="Skills"
            title="Topic mastery"
            action={
              <Link
                to="/progress"
                className="text-sm text-accent underline-offset-4 hover:underline"
              >
                Full report
              </Link>
            }
          />
          {topMastery.length === 0 ? (
            <EmptyState
              icon="🎯"
              title="Mastery unlocks after your first assessment"
              body="Every answer feeds your per-topic mastery score."
            />
          ) : (
            <div className="surface-paper space-y-4 p-5">
              {topMastery.map((row) => (
                <MasteryBar
                  key={`${row.topic}-${row.subtopic}`}
                  label={`${row.topic} · ${row.subtopic}`}
                  value={row.mastery}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionHeading
            eyebrow="Rewards"
            title="Achievements"
            action={
              <Link
                to="/achievements"
                className="text-sm text-accent underline-offset-4 hover:underline"
              >
                All badges
              </Link>
            }
          />
          <div className="surface-paper p-5">
            <p className="font-display text-3xl">
              {data.badgeCount}
              <span className="ml-2 text-sm text-muted-foreground">earned</span>
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {data.latestBadges.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Pass your first assessment to earn a badge.
                </p>
              ) : (
                data.latestBadges.map((badge) => (
                  <span
                    key={badge.name}
                    className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm"
                  >
                    <span>{badge.icon}</span>
                    {badge.name}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="surface-paper mt-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-hairline text-muted-foreground">AI performance coach</p>
              <button
                onClick={() => insightMutation.mutate()}
                disabled={insightMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {insightMutation.isPending ? "Thinking…" : "Generate"}
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
                  (insightMutation.isError
                    ? "Could not generate insights right now."
                    : "Get a personalised read on your trajectory, strengths and next step.")}
              </p>
            )}
            {weakest.length > 0 ? (
              <p className="mt-4 text-xs text-muted-foreground">
                Focus areas: {weakest.map((w) => `${w.subtopic} (${w.mastery}%)`).join(", ")}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
