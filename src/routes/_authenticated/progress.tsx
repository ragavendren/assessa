import {
  EmptyState,
  MasteryBar,
  PageLoader,
  ScorePill,
  SectionHeading,
  StatTile,
} from "@/components/platform";
import { formatDate, formatDuration } from "@/lib/gamification";
import { getProgress } from "@/lib/platform.functions";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({
    meta: [
      { title: "Progress & analytics — Assessa" },
      {
        name: "description",
        content:
          "Score trends, improvement, time usage and per-topic mastery across all your assessments.",
      },
      { property: "og:title", content: "Progress & analytics — Assessa" },
      { property: "og:description", content: "Your full assessment analytics report." },
    ],
  }),
  component: ProgressPage,
});

function ProgressPage() {
  const fetchProgress = useServerFn(getProgress);
  const { data, isPending } = useQuery({ queryKey: ["progress"], queryFn: () => fetchProgress() });

  if (isPending || !data) return <PageLoader />;

  const byTopic = new Map<string, typeof data.mastery>();
  for (const row of data.mastery) {
    byTopic.set(row.topic, [...(byTopic.get(row.topic) ?? []), row]);
  }

  return (
    <div className="space-y-10">
      <SectionHeading eyebrow="Analytics" title="My progress" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Average" value={data.stats.average} suffix="%" />
        <StatTile label="Best" value={data.stats.best} suffix="%" />
        <StatTile label="Pass rate" value={data.stats.passRate} suffix="%" />
        <StatTile
          label="Improvement"
          value={`${data.improvement > 0 ? "+" : ""}${data.improvement}`}
          suffix="pts"
          hint="Recent assessments"
        />
      </div>

      <section>
        <SectionHeading eyebrow="Skills" title="Topic mastery" />
        {data.mastery.length === 0 ? (
          <EmptyState icon="🎯" title="No mastery data yet" />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {[...byTopic.entries()].map(([topic, rows]) => (
              <div key={topic} className="surface-paper space-y-4 p-5">
                <p className="text-hairline text-muted-foreground">{topic}</p>
                {rows.map((row) => (
                  <MasteryBar
                    key={row.subtopic}
                    label={row.subtopic}
                    value={row.mastery}
                    meta={`${row.answered} questions answered`}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeading eyebrow="History" title="Assessment journey" />
        {data.journey.length === 0 ? (
          <EmptyState icon="📈" title="No completed assessments yet" />
        ) : (
          <div className="surface-paper divide-y divide-border">
            {[...data.journey].reverse().map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{entry.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.topic} · {formatDate(entry.submittedAt)} ·{" "}
                    {formatDuration(entry.durationSeconds)} used of{" "}
                    {Math.round(entry.allowedSeconds / 60)} min
                  </p>
                </div>
                <ScorePill score={entry.score} passed={entry.passed} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
