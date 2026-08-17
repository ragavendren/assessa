import { BadgeDriftWall } from "@/components/BadgeDriftWall";
import { BadgeMark } from "@/components/BadgeMark";
import { Carousel } from "@/components/Carousel";
import {
  EmptyState,
  LevelMeter,
  MasteryBar,
  PageLoader,
  ScorePill,
  SectionHeading,
  StatTile,
} from "@/components/platform";
import { ScoreTrendChart } from "@/components/ScoreTrendChart";
import { PlayDashboardSection } from "@/components/play/PlayDashboardSection";
import { getParticipantInsight } from "@/lib/ai.functions";
import { formatDate } from "@/lib/gamification";
import { beginPlay, getPlayHub } from "@/lib/play.functions";
import type { PlayKind } from "@/lib/play.math";
import { getDashboard, listNotifications } from "@/lib/platform.functions";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Award, Flame, Sparkles, Target, Trophy, Zap } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Assessa" },
      {
        name: "description",
        content: "Your Assessa home: level, assessments, results and badges.",
      },
      { property: "og:title", content: "Dashboard — Assessa" },
      {
        property: "og:description",
        content: "Track progress, badges and assessment results in one place.",
      },
    ],
  }),
  component: Dashboard,
});

function delay(ms: number): CSSProperties {
  return { animationDelay: `${ms}ms` };
}

function Dashboard() {
  const navigate = useNavigate();
  const fetchDashboard = useServerFn(getDashboard);
  const fetchPlayHub = useServerFn(getPlayHub);
  const startDaily = useServerFn(beginPlay);
  const { data, isPending } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchDashboard(),
    staleTime: 30_000,
  });
  const fetchNotifications = useServerFn(listNotifications);
  const { data: playHub } = useQuery({
    queryKey: ["play-hub"],
    queryFn: () => fetchPlayHub(),
    staleTime: 30_000,
  });
  const { data: notices } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(),
    staleTime: 30_000,
  });
  const dailyStartMut = useMutation({
    mutationFn: (args: { kind: PlayKind; courseId?: string }) =>
      startDaily({
        data: {
          kind: args.kind,
          ...(args.courseId ? { courseId: args.courseId } : {}),
        },
      }),
    onSuccess: (result) =>
      navigate({ to: "/play/session/$sessionId", params: { sessionId: result.sessionId } }),
  });

  const insight = useServerFn(getParticipantInsight);
  const insightMutation = useMutation({ mutationFn: () => insight() });

  if (isPending || !data) return <PageLoader />;

  const streak = (type: string) => data.streaks.find((s) => s.type === type);
  const examStreak = streak("exam");
  const passStreak = streak("pass");
  const playOn = playHub?.menuEnabled === true;
  const dailyPlayStreak = playOn ? (playHub?.streak.current ?? 0) : 0;
  const focusAreas = [...data.mastery].sort((a, b) => a.mastery - b.mastery).slice(0, 3);
  const availableExams = (data.available ?? []).slice(0, 8);
  const earnedBadges = (data.earnedBadges ?? data.latestBadges ?? []).slice(0, 12);
  const recent = data.recent.slice(0, 6);
  const unreadNotices = (notices ?? []).filter((item) => !item.read);

  const displayName = data.profile.display_name || data.profile.full_name || "Participant";
  const greeting = timeGreeting();

  return (
    <div className="space-y-8">
      {/* Hero — Assessa Yourself with badge drift */}
      <header className="animate-dash-rise relative overflow-hidden surface-metal p-6 md:p-7">
        <BadgeDriftWall badges={earnedBadges} limit={10} />
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-amber-400/20 blur-3xl animate-dash-float"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 left-[30%] h-44 w-44 rounded-full bg-sky-300/15 blur-3xl animate-dash-float-alt"
          aria-hidden
        />

        <div className="relative z-10 flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0 max-w-xl">
            <p className="animate-dash-chip inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-amber-700">
              <Zap className="h-3.5 w-3.5 animate-dash-flame" />
              Assessa Yourself
            </p>
            <p className="animate-dash-rise mt-2 text-sm text-muted-foreground" style={delay(40)}>
              {greeting}
            </p>
            <h1
              className="animate-dash-rise mt-1 font-display text-3xl md:text-4xl"
              style={delay(70)}
            >
              {displayName}
            </h1>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <QuestChip
                icon={<Target className="h-3.5 w-3.5" />}
                label={`${data.availableCount} ready`}
                style={delay(140)}
              />
              <QuestChip
                icon={<Flame className="h-3.5 w-3.5 animate-dash-flame" />}
                label={`${examStreak?.current ?? 0} exam streak`}
                style={delay(190)}
              />
              {playOn ? (
                <QuestChip
                  icon={<Flame className="h-3.5 w-3.5 text-amber-500 animate-dash-flame" />}
                  label={`${dailyPlayStreak} day streak`}
                  style={delay(220)}
                />
              ) : null}
              <QuestChip
                icon={<Award className="h-3.5 w-3.5" />}
                label={`${data.badgeCount} badges`}
                style={delay(240)}
              />
              <QuestChip
                icon={<Trophy className="h-3.5 w-3.5" />}
                label={`${passStreak?.current ?? 0} pass streak`}
                style={delay(290)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/exams"
              className="animate-dash-pop group inline-flex items-center gap-2 rounded-md border border-amber-200/30 bg-gradient-to-b from-amber-200 to-amber-600 px-4 py-2.5 text-sm font-semibold text-amber-950 shadow-[0_8px_24px_-12px_rgba(251,191,36,0.55)] transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:from-amber-100 hover:to-amber-500 active:scale-[0.98]"
              style={delay(160)}
            >
              Start assessment
              <ArrowRight className="h-4 w-4 animate-dash-cta-arrow transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1" />
            </Link>
            {playOn && (playHub?.segments.length ?? 0) > 0 ? (
              <Link
                to="/play"
                className="animate-dash-pop inline-flex items-center gap-2 rounded-md border border-border bg-white/70 px-4 py-2.5 text-sm font-semibold backdrop-blur-sm"
                style={delay(200)}
              >
                Open Play
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      {unreadNotices.length > 0 ? (
        <MotionSection delayMs={10}>
          <section className="surface-paper rounded-xl p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Notifications</h2>
              <Link to="/notifications" className="text-xs text-accent underline">
                View all
              </Link>
            </div>
            <ul className="mt-2 space-y-2">
              {unreadNotices.slice(0, 3).map((item) => {
                const href =
                  item.kind === "play_launched"
                    ? "/play"
                    : item.kind === "play_battle"
                      ? "/play/battle"
                      : item.kind === "badge"
                        ? "/achievements"
                        : item.kind === "exam_launched" || item.kind === "invitation"
                          ? "/exams"
                          : "/notifications";
                return (
                  <li key={item.id}>
                    <Link to={href} className="block text-sm hover:text-accent">
                      <span className="mr-1">{item.icon ?? "🔔"}</span>
                      <span className="font-medium">{item.title}</span>
                      {item.body ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {item.body}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </MotionSection>
      ) : null}

      {playOn && playHub ? (
        <MotionSection delayMs={20}>
          <PlayDashboardSection
            hub={playHub}
            pending={dailyStartMut.isPending}
            onStart={(kind, courseId) => dailyStartMut.mutate({ kind, courseId })}
          />
        </MotionSection>
      ) : null}

      {/* Level + key stats only */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)]">
        <LevelMeter
          {...data.level}
          surface="metal"
          className="animate-dash-rise"
          style={delay(40)}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            surface="metal"
            label="Average"
            value={data.stats.average}
            suffix="%"
            className="animate-dash-pop"
            style={delay(80)}
          />
          <StatTile
            surface="metal"
            label="Best"
            value={data.stats.best}
            suffix="%"
            className="animate-dash-pop"
            style={delay(130)}
          />
          <StatTile
            surface="metal"
            label="Completed"
            value={data.stats.completed}
            className="animate-dash-pop"
            style={delay(180)}
          />
          <StatTile
            surface="metal"
            label="Pass rate"
            value={data.stats.passRate}
            suffix="%"
            className="animate-dash-pop"
            style={delay(230)}
          />
        </div>
      </div>

      {/* Available assessments */}
      <MotionSection delayMs={40}>
        <SectionHeading
          eyebrow="Next up"
          title="Available assessments"
          action={
            <Link to="/exams" className="text-sm text-accent underline-offset-4 hover:underline">
              View all
            </Link>
          }
        />
        {availableExams.length === 0 && data.upcoming.length === 0 ? (
          <EmptyState
            icon="🗂"
            title="No assessments yet"
            body="Assigned and public assessments will show here."
          />
        ) : (
          <Carousel
            label="Available assessments"
            itemClassName="w-[min(100%,16.5rem)]"
            autoPlay={4500}
          >
            {availableExams.map((exam) => (
              <Link
                key={exam.id}
                to="/exams/$examId"
                params={{ examId: exam.id }}
                className="group surface-metal dash-lift dash-lift-metal flex h-full min-h-[9.5rem] flex-col justify-between p-4"
              >
                <div>
                  <p className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    {exam.topic || "General"}
                  </p>
                  <p className="mt-2 line-clamp-2 font-display text-lg leading-snug transition-colors duration-300 group-hover:text-accent">
                    {exam.title}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {exam.questionCount} Q · {exam.duration} min
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0 group-hover:opacity-100" />
                </div>
              </Link>
            ))}
            {data.upcoming.map((exam) => (
              <Link
                key={`up-${exam.id}`}
                to="/exams/$examId"
                params={{ examId: exam.id }}
                className="surface-metal dash-lift dash-lift-metal flex h-full min-h-[9.5rem] flex-col justify-between border-dashed p-4"
              >
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-accent">
                    Upcoming
                  </p>
                  <p className="mt-2 line-clamp-2 font-display text-lg leading-snug">
                    {exam.title}
                  </p>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {exam.startsAt ? formatDate(exam.startsAt) : "Soon"} · {exam.duration} min
                </p>
              </Link>
            ))}
          </Carousel>
        )}
      </MotionSection>

      {/* Recent results */}
      <MotionSection delayMs={60}>
        <SectionHeading eyebrow="History" title="Recent results" />
        {recent.length === 0 ? (
          <EmptyState
            icon="📈"
            title="No results yet"
            body="Complete an assessment to see scores here."
          />
        ) : (
          <Carousel label="Recent results" itemClassName="w-[min(100%,15.5rem)]" autoPlay={5000}>
            {recent.map((result) => (
              <Link
                key={result.id}
                to="/results/$attemptId"
                params={{ attemptId: result.id }}
                className="surface-metal dash-lift dash-lift-metal flex h-full min-h-[8.75rem] flex-col justify-between p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{result.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {result.submittedAt ? formatDate(result.submittedAt) : result.topic}
                  </p>
                </div>
                <div className="mt-3">
                  <ScorePill score={result.score} passed={result.passed} />
                </div>
              </Link>
            ))}
          </Carousel>
        )}
      </MotionSection>

      {/* Badges — interactive carousel */}
      <MotionSection delayMs={80}>
        <SectionHeading
          eyebrow="Trophy case"
          title="Pinned badges"
          action={
            <Link
              to="/achievements"
              className="text-sm text-accent underline-offset-4 hover:underline"
            >
              All
            </Link>
          }
        />
        {earnedBadges.length === 0 ? (
          <EmptyState
            icon="🏅"
            title="No badges yet"
            body="Pass an assessment to pin your first badge."
          />
        ) : (
          <Carousel label="Pinned badges" itemClassName="w-[min(100%,11.5rem)]" autoPlay={3800}>
            {earnedBadges.map((badge, index) => (
              <div
                key={`${"code" in badge && badge.code ? badge.code : badge.name}-${index}`}
                className="flex h-full min-h-[7.5rem] flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-border bg-card px-3 py-4 text-center"
                title={badge.description || badge.name}
              >
                <BadgeMark
                  icon={badge.icon}
                  code={"code" in badge ? (badge.code ?? null) : null}
                  name={badge.name}
                  size="lg"
                />
                <p className="line-clamp-2 text-xs font-medium leading-snug">{badge.name}</p>
                {"earnedAt" in badge && badge.earnedAt ? (
                  <p className="text-[10px] text-muted-foreground">{formatDate(badge.earnedAt)}</p>
                ) : null}
              </div>
            ))}
          </Carousel>
        )}
      </MotionSection>

      {/* Trend + focus — one compact row */}
      <MotionSection delayMs={50} className="grid gap-4 lg:grid-cols-2">
        <div className="surface-metal dash-lift p-5">
          <SectionHeading eyebrow="Trend" title="Score trend" />
          <div className="mt-3">
            {data.trend.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Complete assessments to unlock your score trend.
              </p>
            ) : (
              <ScoreTrendChart points={data.trend} limit={8} />
            )}
          </div>
        </div>

        <div className="surface-metal dash-lift space-y-4 p-5">
          <SectionHeading
            eyebrow="Focus"
            title="Practice next"
            action={
              <button
                type="button"
                onClick={() => insightMutation.mutate()}
                disabled={insightMutation.isPending}
                className="inline-flex items-center gap-1 text-xs font-medium text-accent underline-offset-4 hover:underline disabled:opacity-60"
              >
                <Sparkles
                  className={cn("h-3.5 w-3.5", insightMutation.isPending && "animate-dash-flame")}
                />
                {insightMutation.isPending ? "…" : "Coach"}
              </button>
            }
          />
          {focusAreas.length === 0 && (data.career ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Mastery tips appear after your first attempt.
            </p>
          ) : (
            <div className="space-y-3">
              {(data.career ?? []).length > 0 ? (
                <>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Career readiness
                  </p>
                  {(data.career ?? []).slice(0, 4).map((row) => (
                    <MasteryBar
                      key={row.topic}
                      label={row.topic}
                      value={row.mastery}
                      meta={`${row.subtopics} skill${row.subtopics === 1 ? "" : "s"}`}
                    />
                  ))}
                  {playOn ? (
                    <Link to="/play/topics" className="inline-block text-xs text-accent underline">
                      Topic Challenge →
                    </Link>
                  ) : null}
                </>
              ) : null}
              {focusAreas.map((row) => (
                <MasteryBar
                  key={`${row.topic}-${row.subtopic}`}
                  label={row.subtopic || row.topic}
                  value={row.mastery}
                />
              ))}
            </div>
          )}
          {insightMutation.data?.text ? (
            <p className="animate-dash-rise line-clamp-4 text-xs leading-relaxed text-muted-foreground">
              {insightMutation.data.text.split("\n").filter(Boolean)[0]}
            </p>
          ) : null}
        </div>
      </MotionSection>
    </div>
  );
}

function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function MotionSection({
  children,
  className,
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  return (
    <section className={cn("animate-dash-rise", className)} style={delay(delayMs)}>
      {children}
    </section>
  );
}

function QuestChip({
  icon,
  label,
  style,
}: {
  icon: ReactNode;
  label: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className="animate-dash-chip inline-flex items-center gap-1.5 rounded-md border border-amber-700/15 bg-white/70 px-2.5 py-1 font-medium text-foreground backdrop-blur-sm transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-amber-600/35"
      style={style}
    >
      <span className="text-amber-700">{icon}</span>
      {label}
    </span>
  );
}
