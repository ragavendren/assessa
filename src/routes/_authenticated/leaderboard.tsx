import { AssessaIcon } from "@/components/icons";
import { BoardStage, LeaderboardChip, LeaderboardHero } from "@/components/leaderboard/BoardStage";
import { LeaderboardTabs } from "@/components/play/LeaderboardTabs";
import { EmptyState, PageLoader } from "@/components/platform";
import { LEADERBOARD_SCOPE_LABELS, MODE_LABELS, type ExamMode } from "@/lib/gamification";
import { getPlayFlags } from "@/lib/play.functions";
import { getLeaderboard, listLeaderboardExams } from "@/lib/platform.functions";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
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

type ExamMeta = {
  durationMinutes: number;
  maxAttempts: number;
  mode: string;
  topic: string;
  passMark: number;
  questionCount: number;
};

function LeaderboardPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  const scope = search.scope ?? "global";
  const examId = search.examId ?? null;

  const fetchLeaderboard = useServerFn(getLeaderboard);
  const fetchExams = useServerFn(listLeaderboardExams);
  const fetchPlayFlags = useServerFn(getPlayFlags);

  const { data: exams = [], isPending: examsPending } = useQuery({
    queryKey: ["leaderboard-exams"],
    queryFn: () => fetchExams(),
  });
  const { data: playFlags } = useQuery({
    queryKey: ["play-flags"],
    queryFn: () => fetchPlayFlags(),
    staleTime: 60_000,
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
  const examMeta = (data as { examMeta?: ExamMeta | null } | undefined)?.examMeta ?? null;
  const selectedExam = exams.find((exam) => exam.id === examId) ?? null;

  return (
    <div className="space-y-6">
      <LeaderboardHero
        title="Rankings"
        subtitle="Top 3 stand on the metallic podium. The full field sits beside it, raised off the stage — gold, silver and bronze stay highlighted."
        chips={
          <>
            <LeaderboardChip
              icon={<AssessaIcon name="trophy" className="h-3.5 w-3.5" />}
              label="Ranked"
              value={rows.length}
            />
            <LeaderboardChip
              icon={<AssessaIcon name="sparkles" className="h-3.5 w-3.5" />}
              label="Your place"
              value={data?.myRank ? `#${data.myRank.rank}` : "—"}
            />
          </>
        }
        tabs={
          <LeaderboardTabs
            active="assessments"
            playEnabled={playFlags?.menuEnabled === true}
            tone="banner"
          />
        }
      />

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
                  ? "Ranked by best score, then fewer attempts. Time shown for the best attempt."
                  : "Ranked by average best score across assessments."}
              </p>
            </div>
            {data.myRank ? (
              <div className="surface-paper flex items-center gap-3 px-3 py-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 text-accent">
                  <AssessaIcon name="medal" className="h-4 w-4" />
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

          {singleExam && (examMeta || selectedExam) ? (
            <AssessmentStatsStrip meta={examMeta} fallback={selectedExam} />
          ) : null}

          <BoardStage
            rows={rows}
            columns={singleExam ? "exam-single" : "exam-all"}
            scoreSuffix="%"
            podiumHint="Best score · fewer attempts"
          />
        </div>
      )}
    </div>
  );
}

function AssessmentStatsStrip({
  meta,
  fallback,
}: {
  meta: ExamMeta | null;
  fallback: {
    durationMinutes?: number;
    maxAttempts?: number;
    mode?: string;
    topic?: string;
    passMark?: number;
    questionCount?: number;
  } | null;
}) {
  const durationMinutes = meta?.durationMinutes ?? fallback?.durationMinutes;
  const maxAttempts = meta?.maxAttempts ?? fallback?.maxAttempts;
  const mode = meta?.mode ?? fallback?.mode;
  const topic = meta?.topic ?? fallback?.topic;
  const passMark = meta?.passMark ?? fallback?.passMark;
  const questionCount = meta?.questionCount ?? fallback?.questionCount;

  const items = [
    durationMinutes != null
      ? {
          icon: <AssessaIcon name="timer" className="h-3.5 w-3.5" />,
          label: "Time limit",
          value: `${durationMinutes} min`,
        }
      : null,
    maxAttempts != null
      ? {
          icon: <AssessaIcon name="hash" className="h-3.5 w-3.5" />,
          label: "Max attempts",
          value: String(maxAttempts),
        }
      : null,
    questionCount != null
      ? {
          icon: <AssessaIcon name="list" className="h-3.5 w-3.5" />,
          label: "Questions",
          value: String(questionCount),
        }
      : null,
    passMark != null
      ? {
          icon: <AssessaIcon name="target" className="h-3.5 w-3.5" />,
          label: "Pass mark",
          value: `${passMark}%`,
        }
      : null,
    mode
      ? {
          icon: <AssessaIcon name="sparkles" className="h-3.5 w-3.5" />,
          label: "Mode",
          value: mode in MODE_LABELS ? MODE_LABELS[mode as ExamMode] : mode,
        }
      : null,
    topic
      ? {
          icon: <AssessaIcon name="medal" className="h-3.5 w-3.5" />,
          label: "Topic",
          value: topic,
        }
      : null,
  ].filter(Boolean) as Array<{ icon: ReactNode; label: string; value: string }>;

  if (items.length === 0) return null;

  return (
    <section className="surface-paper grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-[var(--radius-md)] border border-border/70 bg-secondary/30 px-3 py-2"
        >
          <div className="flex items-center gap-1.5 text-muted-foreground">
            {item.icon}
            <span className="text-[11px] font-medium uppercase tracking-wide">{item.label}</span>
          </div>
          <p className="mt-1 truncate text-sm font-semibold">{item.value}</p>
        </div>
      ))}
    </section>
  );
}
