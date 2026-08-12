import { EmptyState, PageLoader } from "@/components/platform";
import { initials, LEADERBOARD_SCOPE_LABELS } from "@/lib/gamification";
import { getLeaderboard, listLeaderboardExams } from "@/lib/platform.functions";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Cpu, Medal, Sparkles, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  validateSearch: z.object({
    examId: z.string().uuid().optional(),
    scope: z.enum(["global", "organization", "department"]).optional(),
  }),
  head: () => ({
    meta: [
      { title: "Leaderboard — Assessa" },
      {
        name: "description",
        content:
          "Engineering rankings across Assessa assessments — top performers, personal rank and filtered boards.",
      },
      { property: "og:title", content: "Leaderboard — Assessa" },
      {
        property: "og:description",
        content: "See how you rank across every assessment.",
      },
    ],
  }),
  component: LeaderboardPage,
});

const SCOPES = (["global", "organization", "department"] as const).map((value) => ({
  value,
  label: LEADERBOARD_SCOPE_LABELS[value].label,
  hint: LEADERBOARD_SCOPE_LABELS[value].hint,
}));

type BoardRow = {
  rank: number;
  name: string;
  score: number;
  exams: number;
  isMe: boolean;
};

function LeaderboardPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  const scope = search.scope ?? "global";
  const examId = search.examId ?? null;

  const fetchLeaderboard = useServerFn(getLeaderboard);
  const fetchExams = useServerFn(listLeaderboardExams);

  const { data: exams = [], isPending: examsPending } = useQuery({
    queryKey: ["leaderboard-exams"],
    queryFn: () => fetchExams(),
  });

  const { data, isPending } = useQuery({
    queryKey: ["leaderboard", scope, examId],
    queryFn: () =>
      fetchLeaderboard({
        data: {
          scope,
          examId,
        },
      }),
  });

  function setScope(next: (typeof SCOPES)[number]["value"]) {
    void navigate({
      search: (prev) => ({ ...prev, scope: next === "global" ? undefined : next }),
      replace: true,
    });
  }

  function setExamId(next: string) {
    void navigate({
      search: (prev) => ({
        ...prev,
        examId: next ? next : undefined,
      }),
      replace: true,
    });
  }

  const singleExam = Boolean(examId);
  const rows = data?.rows ?? [];
  const topThree = rows.slice(0, 3);
  const topScore = Math.max(1, ...rows.map((row) => row.score));

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-[var(--radius-lg)] border border-border bg-primary text-primary-foreground">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 top-0 h-40 w-40 rounded-full bg-accent/30 blur-3xl animate-brand-glow"
        />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4 p-5 md:p-6">
          <div className="animate-brand-rise min-w-0">
            <p className="text-hairline text-primary-foreground/65">Leaderboard</p>
            <h1 className="mt-1 font-display text-3xl leading-none tracking-tight md:text-4xl">
              Rankings
            </h1>
            <p className="mt-2 max-w-xl text-sm text-primary-foreground/75">
              Filter by assessment, organisation or team to see where you stand.
            </p>
          </div>
          <div className="animate-brand-rise-delayed flex flex-wrap gap-2">
            <HeroChip
              icon={<Trophy className="h-3.5 w-3.5" />}
              label="Ranked"
              value={rows.length}
            />
            <HeroChip
              icon={<Sparkles className="h-3.5 w-3.5" />}
              label="Your place"
              value={data?.myRank ? `#${data.myRank.rank}` : "—"}
            />
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <label className="flex min-w-[16rem] flex-1 flex-col gap-1.5 text-sm sm:max-w-md">
          <span className="text-xs font-medium text-muted-foreground">Assessment</span>
          <select
            value={examId ?? ""}
            disabled={examsPending}
            onChange={(event) => setExamId(event.target.value)}
            className="field"
          >
            <option value="">All assessments</option>
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.title}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
          {SCOPES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setScope(option.value)}
              className={cn(
                "rounded-[var(--radius-md)] border px-3 py-2 text-left transition-colors",
                scope === option.value
                  ? "border-accent bg-accent/15 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="block text-[11px] opacity-70">{option.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {isPending || !data ? (
        <PageLoader />
      ) : data.disabled ? (
        <EmptyState
          icon="🥇"
          title="Leaderboard disabled"
          body="This assessment does not publish a leaderboard."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="🥇"
          title="No rankings yet"
          body={
            singleExam
              ? "Rankings appear after participants submit this assessment."
              : "Complete assessments with leaderboards enabled to appear here."
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-hairline text-muted-foreground">Now showing</p>
              <h2 className="font-display text-2xl">{data.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {singleExam
                  ? "Ranked by each participant’s best score on this assessment."
                  : "Ranked by average of each participant’s best score per assessment."}
              </p>
            </div>
            {data.myRank ? (
              <div className="surface-paper flex items-center gap-3 px-3 py-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 text-accent">
                  <Medal className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-hairline text-muted-foreground">Your rank</p>
                  <p className="font-display text-lg leading-none">
                    #{data.myRank.rank}
                    <span className="ml-1 text-sm text-muted-foreground">
                      of {data.myRank.total}
                    </span>
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <TopStrip rows={topThree} singleExam={singleExam} />

          <section className="surface-paper overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
              <div>
                <p className="text-hairline text-muted-foreground">Full standings</p>
                <p className="font-display text-base">All ranks</p>
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">{rows.length} ranked</p>
            </div>
            <ul className="divide-y divide-border">
              {rows.map((row, index) => (
                <RankRow
                  key={`${row.rank}-${row.name}`}
                  row={row}
                  topScore={topScore}
                  singleExam={singleExam}
                  delayMs={40 + index * 30}
                />
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

function HeroChip({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-primary-foreground/15 bg-primary-foreground/8 px-3 py-2 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-primary-foreground/70">
        {icon}
        <span className="text-hairline">{label}</span>
      </div>
      <p className="mt-0.5 font-display text-xl leading-none">{value}</p>
    </div>
  );
}

function TopStrip({ rows, singleExam }: { rows: BoardRow[]; singleExam: boolean }) {
  if (rows.length === 0) return null;

  const ordered = [1, 2, 3]
    .map((place) => rows.find((row) => row.rank === place))
    .filter((row): row is BoardRow => Boolean(row));

  return (
    <section className="surface-paper p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-accent" />
          <p className="text-sm font-medium">Top performers</p>
        </div>
        <p className="text-hairline text-muted-foreground">Best scores</p>
      </div>
      <div
        className={cn(
          "grid gap-2",
          ordered.length === 1 && "grid-cols-1",
          ordered.length === 2 && "grid-cols-1 sm:grid-cols-2",
          ordered.length >= 3 && "grid-cols-1 sm:grid-cols-3",
        )}
      >
        {ordered.map((row, index) => (
          <TopCard key={row.rank} row={row} singleExam={singleExam} delayMs={index * 80} />
        ))}
      </div>
    </section>
  );
}

function TopCard({
  row,
  singleExam,
  delayMs,
}: {
  row: BoardRow;
  singleExam: boolean;
  delayMs: number;
}) {
  const place = Math.min(row.rank, 3) as 1 | 2 | 3;
  const styles = {
    1: {
      shell: "border-accent/40 bg-accent/10",
      badge: "bg-accent text-accent-foreground",
      label: "1st",
    },
    2: {
      shell: "border-border bg-card",
      badge: "bg-primary text-primary-foreground",
      label: "2nd",
    },
    3: {
      shell: "border-border bg-card",
      badge: "bg-secondary text-foreground",
      label: "3rd",
    },
  }[place];

  return (
    <div
      className={cn(
        "animate-brand-rise flex items-center gap-3 rounded-[var(--radius-md)] border px-3 py-2.5",
        styles.shell,
        row.isMe && "ring-1 ring-accent/50",
      )}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          styles.badge,
        )}
      >
        {place === 1 ? <Trophy className="h-3.5 w-3.5" /> : styles.label}
      </span>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
        {initials(row.name === "You" ? "You" : row.name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {row.name}
          {row.isMe ? (
            <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
              You
            </span>
          ) : null}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {singleExam ? "Best attempt" : `${row.exams} assessment${row.exams === 1 ? "" : "s"}`}
        </p>
      </div>
      <p className="font-display text-xl tabular-nums">{row.score}%</p>
    </div>
  );
}

function RankRow({
  row,
  topScore,
  singleExam,
  delayMs,
}: {
  row: BoardRow;
  topScore: number;
  singleExam: boolean;
  delayMs: number;
}) {
  const width = Math.max(8, Math.round((row.score / topScore) * 100));
  const medal =
    row.rank === 1
      ? "text-accent"
      : row.rank === 2
        ? "text-primary"
        : row.rank === 3
          ? "text-foreground"
          : null;

  return (
    <li
      className={cn(
        "animate-brand-rise grid gap-2 px-4 py-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-3 sm:px-5 sm:py-3.5",
        row.isMe && "bg-accent/10",
        row.rank <= 3 && "bg-[color-mix(in_oklab,var(--color-paper)_92%,var(--color-accent)_8%)]",
      )}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <span
        className={cn("font-display text-xl tabular-nums text-muted-foreground sm:text-2xl", medal)}
      >
        #{row.rank}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold sm:h-9 sm:w-9">
            {initials(row.name === "You" ? "You" : row.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {row.name}
              {row.isMe ? (
                <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-accent">
                  You
                </span>
              ) : null}
            </p>
            {!singleExam ? (
              <p className="text-xs text-muted-foreground">
                {row.exams} assessment{row.exams === 1 ? "" : "s"}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Best attempt</p>
            )}
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="animate-score-fill h-full rounded-full bg-accent"
            style={{ width: `${width}%`, animationDelay: `${delayMs + 60}ms` }}
          />
        </div>
      </div>
      <p className="font-display text-xl tabular-nums sm:text-right sm:text-2xl">{row.score}%</p>
    </li>
  );
}
