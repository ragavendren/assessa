import { PodiumMedal } from "@/components/PodiumMedal";
import { EmptyState, PageLoader } from "@/components/platform";
import {
  formatAttemptCount,
  formatDuration,
  initials,
  LEADERBOARD_SCOPE_LABELS,
  MODE_LABELS,
  type ExamMode,
} from "@/lib/gamification";
import { getLeaderboard, listLeaderboardExams } from "@/lib/platform.functions";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ListChecks,
  Medal,
  Sparkles,
  Target,
  Timer,
  Trophy,
  Hash,
} from "lucide-react";
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
  attempts?: number;
  durationSeconds?: number | null;
  isMe: boolean;
};

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
  const topThree = rows.filter((row) => row.rank <= 3);
  const rest = rows.filter((row) => row.rank > 3);
  const examMeta = (data as { examMeta?: ExamMeta | null } | undefined)?.examMeta ?? null;
  const selectedExam = exams.find((exam) => exam.id === examId) ?? null;

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
              Top 3 on the podium. Everyone else listed with score, attempts and finish time.
            </p>
          </div>
          <div className="animate-brand-rise-delayed flex flex-wrap gap-2">
            <HeroChip icon={<Trophy className="h-3.5 w-3.5" />} label="Ranked" value={rows.length} />
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
                  ? "Ranked by best score, then fewer attempts. Time shown for the best attempt."
                  : "Ranked by average best score across assessments."}
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
                    <span className="ml-1 text-sm text-muted-foreground">of {data.myRank.total}</span>
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          {singleExam && (examMeta || selectedExam) ? (
            <AssessmentStatsStrip meta={examMeta} fallback={selectedExam} />
          ) : null}

          <Podium rows={topThree} singleExam={singleExam} />

          {rest.length > 0 ? (
            <section className="surface-paper overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
                <div>
                  <p className="text-hairline text-muted-foreground">Rest of the field</p>
                  <p className="font-display text-base">Ranks 4+</p>
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">{rest.length} listed</p>
              </div>

              <div
                className={cn(
                  "hidden border-b border-border px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid sm:gap-3 sm:px-5",
                  singleExam
                    ? "sm:grid-cols-[3rem_minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_4.5rem]"
                    : "sm:grid-cols-[3rem_minmax(0,1.4fr)_repeat(3,minmax(0,0.7fr))_4.5rem]",
                )}
              >
                <span>#</span>
                <span>Participant</span>
                {singleExam ? (
                  <>
                    <span>Attempts</span>
                    <span>Time</span>
                  </>
                ) : (
                  <>
                    <span>Assessments</span>
                    <span>Attempts</span>
                    <span>Avg time</span>
                  </>
                )}
                <span className="text-right">Score</span>
              </div>

              <ul className="divide-y divide-border">
                {rest.map((row, index) => (
                  <FieldRow
                    key={`${row.rank}-${row.name}`}
                    row={row}
                    singleExam={singleExam}
                    delayMs={40 + index * 28}
                  />
                ))}
              </ul>
            </section>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              Only the top {topThree.length} {topThree.length === 1 ? "spot is" : "spots are"} filled
              so far.
            </p>
          )}
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
          icon: <Timer className="h-3.5 w-3.5" />,
          label: "Time limit",
          value: `${durationMinutes} min`,
        }
      : null,
    maxAttempts != null
      ? {
          icon: <Hash className="h-3.5 w-3.5" />,
          label: "Max attempts",
          value: String(maxAttempts),
        }
      : null,
    questionCount != null
      ? {
          icon: <ListChecks className="h-3.5 w-3.5" />,
          label: "Questions",
          value: String(questionCount),
        }
      : null,
    passMark != null
      ? {
          icon: <Target className="h-3.5 w-3.5" />,
          label: "Pass mark",
          value: `${passMark}%`,
        }
      : null,
    mode
      ? {
          icon: <Sparkles className="h-3.5 w-3.5" />,
          label: "Mode",
          value:
            mode in MODE_LABELS ? MODE_LABELS[mode as ExamMode] : mode,
        }
      : null,
    topic
      ? {
          icon: <Medal className="h-3.5 w-3.5" />,
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

function Podium({ rows, singleExam }: { rows: BoardRow[]; singleExam: boolean }) {
  if (rows.length === 0) return null;

  const first = rows.find((row) => row.rank === 1);
  const second = rows.find((row) => row.rank === 2);
  const third = rows.find((row) => row.rank === 3);
  // Desktop podium order: 2 · 1 · 3
  const ordered = [second, first, third].filter((row): row is BoardRow => Boolean(row));

  return (
    <section className="relative overflow-hidden rounded-[var(--radius-lg)] border border-border bg-[linear-gradient(165deg,#0f172a_0%,#1e293b_48%,#0f172a_100%)] p-4 text-slate-100 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-10 top-0 h-40 w-40 rounded-full bg-amber-400/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 bottom-0 h-36 w-36 rounded-full bg-sky-300/10 blur-3xl"
      />

      <div className="relative mb-5 flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-amber-200/70">
            Metallic podium
          </p>
          <p className="font-display text-xl text-white">Top 3</p>
        </div>
        <p className="text-xs text-slate-400">Best score · fewer attempts</p>
      </div>

      <div className="relative grid items-end gap-4 sm:grid-cols-3 sm:gap-3">
        {ordered.map((row) => (
          <PodiumCard key={row.rank} row={row} singleExam={singleExam} />
        ))}
      </div>
    </section>
  );
}

function PodiumCard({ row, singleExam }: { row: BoardRow; singleExam: boolean }) {
  const place = Math.min(row.rank, 3) as 1 | 2 | 3;
  const metal = {
    1: {
      order: "sm:order-2 sm:-translate-y-4",
      pedestal: "from-[#fbbf24] via-[#d97706] to-[#92400e]",
      pedestalHeight: "h-20",
      rim: "from-[#fef3c7] via-white/80 to-[#b45309]",
      glow: "shadow-[0_12px_40px_rgba(251,191,36,0.28)]",
      label: "Gold",
    },
    2: {
      order: "sm:order-1",
      pedestal: "from-[#e2e8f0] via-[#94a3b8] to-[#475569]",
      pedestalHeight: "h-14",
      rim: "from-[#f8fafc] via-white/70 to-[#64748b]",
      glow: "shadow-[0_10px_32px_rgba(148,163,184,0.22)]",
      label: "Silver",
    },
    3: {
      order: "sm:order-3",
      pedestal: "from-[#fdba74] via-[#ea580c] to-[#9a3412]",
      pedestalHeight: "h-10",
      rim: "from-[#ffedd5] via-white/60 to-[#c2410c]",
      glow: "shadow-[0_10px_32px_rgba(234,88,12,0.22)]",
      label: "Bronze",
    },
  }[place];

  return (
    <div
      className={cn(
        "animate-medal-pop flex flex-col items-center text-center",
        metal.order,
        row.isMe && "rounded-2xl ring-1 ring-amber-300/40",
      )}
    >
      <div className={cn("relative mb-3", metal.glow)}>
        <PodiumMedal place={place} size={place === 1 ? 104 : 88} />
      </div>

      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white ring-2 ring-white/20 backdrop-blur-sm">
        {initials(row.name === "You" ? "You" : row.name)}
      </div>

      <p className="max-w-[11rem] truncate text-sm font-semibold text-white">
        {row.name}
        {row.isMe ? (
          <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
            You
          </span>
        ) : null}
      </p>
      <p className="mt-1 font-display text-3xl tabular-nums leading-none text-white">{row.score}%</p>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">{metal.label}</p>

      <div className="mt-3 flex flex-wrap justify-center gap-1.5 text-[11px] text-slate-300">
        <MetalPill label={formatAttemptCount(row.attempts ?? 0)} />
        <MetalPill label={formatDuration(row.durationSeconds)} />
        {!singleExam ? (
          <MetalPill label={`${row.exams} assessment${row.exams === 1 ? "" : "s"}`} />
        ) : null}
      </div>

      {/* Metallic pedestal block */}
      <div className="mt-4 w-full max-w-[11rem]">
        <div
          className={cn(
            "relative overflow-hidden rounded-t-lg bg-gradient-to-b",
            metal.pedestal,
            metal.pedestalHeight,
            metal.glow,
          )}
        >
          <div
            className={cn("absolute inset-x-0 top-0 h-2 bg-gradient-to-r opacity-90", metal.rim)}
          />
          <div className="badge-shimmer-sweep pointer-events-none absolute inset-0 opacity-40">
            <div className="absolute -left-8 top-0 h-full w-10 bg-gradient-to-r from-transparent via-white/50 to-transparent" />
          </div>
          <div className="absolute inset-x-3 bottom-2 text-center font-display text-lg text-white/80">
            #{place}
          </div>
        </div>
        <div
          className={cn(
            "h-2 rounded-b-md bg-gradient-to-r opacity-80",
            metal.rim,
          )}
        />
      </div>
    </div>
  );
}

function MetalPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/8 px-2 py-0.5 backdrop-blur-sm">
      {label}
    </span>
  );
}

function FieldRow({
  row,
  singleExam,
  delayMs,
}: {
  row: BoardRow;
  singleExam: boolean;
  delayMs: number;
}) {
  return (
    <li
      className={cn(
        "animate-brand-rise grid gap-2 px-4 py-3 sm:items-center sm:gap-3 sm:px-5 sm:py-3.5",
        singleExam
          ? "sm:grid-cols-[3rem_minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_4.5rem]"
          : "sm:grid-cols-[3rem_minmax(0,1.4fr)_repeat(3,minmax(0,0.7fr))_4.5rem]",
        row.isMe && "bg-accent/10",
      )}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <span className="font-display text-xl tabular-nums text-muted-foreground">#{row.rank}</span>

      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
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
          <p className="text-xs text-muted-foreground sm:hidden">
            {formatAttemptCount(row.attempts ?? 0)} · {formatDuration(row.durationSeconds)}
            {!singleExam ? ` · ${row.exams} assessments` : ""}
          </p>
        </div>
      </div>

      {!singleExam ? (
        <p className="hidden text-sm tabular-nums text-muted-foreground sm:block">{row.exams}</p>
      ) : null}

      <p className="hidden text-sm tabular-nums text-muted-foreground sm:block">{row.attempts ?? 0}</p>

      <p className="hidden text-sm tabular-nums text-muted-foreground sm:block">
        {formatDuration(row.durationSeconds)}
      </p>

      <p className="font-display text-xl tabular-nums sm:text-right sm:text-2xl">{row.score}%</p>
    </li>
  );
}
