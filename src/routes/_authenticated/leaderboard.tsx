import { EmptyState, PageLoader, SectionHeading } from "@/components/platform";
import { getLeaderboard } from "@/lib/platform.functions";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Assessa" },
      {
        name: "description",
        content: "Global, organisation and department leaderboards with privacy-aware names.",
      },
      { property: "og:title", content: "Leaderboard — Assessa" },
      {
        property: "og:description",
        content: "See how you rank across assessments.",
      },
    ],
  }),
  component: LeaderboardPage,
});

const SCOPES = [
  { value: "global", label: "Global" },
  { value: "organization", label: "Organisation" },
  { value: "department", label: "Department" },
] as const;

function LeaderboardPage() {
  const fetchLeaderboard = useServerFn(getLeaderboard);
  const [scope, setScope] = useState<(typeof SCOPES)[number]["value"]>("global");
  const { data, isPending } = useQuery({
    queryKey: ["leaderboard", scope],
    queryFn: () => fetchLeaderboard({ data: { scope } }),
  });

  return (
    <div>
      <SectionHeading eyebrow="Competition" title="Leaderboard" />

      <div className="mb-6 flex flex-wrap gap-2">
        {SCOPES.map((option) => (
          <button
            key={option.value}
            onClick={() => setScope(option.value)}
            className={
              "rounded-full px-3.5 py-1.5 text-sm transition-colors " +
              (scope === option.value
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground hover:text-foreground")
            }
          >
            {option.label}
          </button>
        ))}
      </div>

      {isPending || !data ? (
        <PageLoader />
      ) : data.rows.length === 0 ? (
        <EmptyState
          icon="🥇"
          title="No ranked results yet"
          body="Leaderboards populate once participants submit assessments with leaderboards enabled."
        />
      ) : (
        <div className="surface-paper divide-y divide-border">
          {data.myRank ? (
            <p className="p-4 text-sm text-muted-foreground">
              Your rank: <strong className="text-foreground">#{data.myRank.rank}</strong> of{" "}
              {data.myRank.total}
            </p>
          ) : null}
          {data.rows.map((row) => (
            <div
              key={row.rank}
              className={cn("flex items-center gap-4 p-4", row.isMe && "bg-accent/10")}
            >
              <span className="w-8 font-display text-lg tabular-nums">{row.rank}</span>
              <span className="flex-1 truncate text-sm font-medium">{row.name}</span>
              <span className="text-xs text-muted-foreground">{row.exams} assessments</span>
              <span className="w-14 text-right font-semibold tabular-nums">{row.score}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
