import { HelpTextLink } from "@/components/help/HelpCenter";
import { AssessaIcon } from "@/components/icons";
import { PageLoader } from "@/components/platform";
import { PlayLeaderboardPanel } from "@/components/play/PlayLeaderboardPanel";
import { PlayModeCard } from "@/components/play/PlayModeCard";
import { beginPlay, getPlayHub } from "@/lib/play.functions";
import {
  PLAY_KIND_GROUPS,
  PLAY_KIND_META,
  type PlayKind,
  type PlaySegment,
  type PlaySegmentMode,
} from "@/lib/play.math";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/play/")({
  validateSearch: z.object({}),
  head: () => ({
    meta: [
      { title: "Play — Assessa" },
      {
        name: "description",
        content: "Daily, topic, speed, survival and team challenges by course or activity.",
      },
    ],
  }),
  component: PlayHub,
});

const LINK_MODES: Partial<Record<PlayKind, { to: string; params?: { tournamentId: string } }>> = {
  topic: { to: "/play/topics" },
  flash: { to: "/play/flash" },
  battle: { to: "/play/battle" },
  team: { to: "/play/team" },
  escape: { to: "/play/escape" },
  arena: { to: "/play/arena" },
  knockout: { to: "/play/knockout" },
};

function PlayHub() {
  const navigate = useNavigate({ from: Route.fullPath });
  const fetchHub = useServerFn(getPlayHub);
  const start = useServerFn(beginPlay);
  const { data, isPending } = useQuery({ queryKey: ["play-hub"], queryFn: () => fetchHub() });
  const startMut = useMutation({
    mutationFn: (args: { kind: PlayKind; courseId?: string; poolId?: string | null }) =>
      start({
        data: {
          kind: args.kind,
          ...(args.courseId ? { courseId: args.courseId } : {}),
          ...(args.poolId ? { poolId: args.poolId } : {}),
        },
      }),
    onSuccess: (result) =>
      navigate({ to: "/play/session/$sessionId", params: { sessionId: result.sessionId } }),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not start"),
  });

  const segments = data?.segments ?? [];

  type ModeChoice = { segment: PlaySegment; mode: PlaySegmentMode };
  const modeByKind = useMemo(() => {
    const map = new Map<PlayKind, ModeChoice>();
    for (const segment of segments) {
      for (const mode of segment.modes) {
        const existing = map.get(mode.kind);
        if (!existing || mode.questionCount > existing.mode.questionCount) {
          map.set(mode.kind, { segment, mode });
        }
      }
    }
    return map;
  }, [segments]);

  const boardKind = useMemo<PlayKind | null>(() => {
    const order: PlayKind[] = [
      "daily",
      "speed",
      "topic",
      "flash",
      "survival",
      "battle",
      "team",
      "rapid",
      "marathon",
      "knockout",
      "escape",
      "arena",
      "weekly",
    ];
    return order.find((k) => modeByKind.has(k)) ?? null;
  }, [modeByKind]);

  const boardChoice = boardKind ? modeByKind.get(boardKind) ?? null : null;

  if (isPending || !data) return <PageLoader label="Loading play modes…" />;

  if (data.menuEnabled === false) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-12 text-center">
        <AssessaIcon name="play" className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="font-display text-2xl">Play is turned off</h1>
        <p className="text-sm text-muted-foreground">
          An admin has disabled the Play menu. Individual modes can still be configured in Play
          control.
        </p>
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-12 text-center">
        <AssessaIcon name="play" className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="font-display text-2xl">Play is not configured yet</h1>
        <p className="text-sm text-muted-foreground">
          An admin needs to enable play modes, attach pools to a course, or map modes to an activity
          in Play control.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Play</p>
          <h1 className="font-display text-2xl">Challenge yourself</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Games from your question pools. Daily and Weekly are required when they are on; other
            modes are optional practice. <HelpTextLink>Ask Assessa</HelpTextLink> for the full loop.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {boardKind ? (
            <Link
              to="/play/leaderboard"
              search={{
                kind: boardKind,
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-secondary"
            >
              <AssessaIcon name="trophy" className="h-4 w-4 text-amber-500" />
              Leaderboard
            </Link>
          ) : null}
          <p className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm">
            <AssessaIcon name="flame" className="h-4 w-4 text-amber-500" />
            {data.streak.current} day streak
          </p>
        </div>
      </header>
      {boardKind && boardChoice ? (
        <section className="surface-paper rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <AssessaIcon name="trophy" className="h-4 w-4 text-amber-500" />
              Leaderboard · {PLAY_KIND_META[boardKind].label}
            </h2>
            <Link
              to="/play/leaderboard"
              search={{
                kind: boardKind,
              }}
              className="text-xs font-medium text-accent underline"
            >
              Full board
            </Link>
          </div>
          <div className="mt-3">
            <PlayLeaderboardPanel
              kind={boardKind}
            />
          </div>
        </section>
      ) : null}
      <ModesPanel modeByKind={modeByKind} data={data} startMut={startMut} />

      {data.resume.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold">Resume</h2>
          <ul className="mt-2 space-y-2">
            {data.resume.map((row) => (
              <li key={row.id}>
                <Link
                  to="/play/session/$sessionId"
                  params={{ sessionId: row.id }}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
                >
                  <span>
                    {PLAY_KIND_META[row.kind]?.label ?? row.kind}
                    {row.topic ? ` · ${row.topic}` : ""}
                  </span>
                  <span className="text-muted-foreground">Continue</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.enabled.escape || data.enabled.knockout || data.enabled.arena ? (
        <section>
          <h2 className="text-sm font-semibold">Events</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {data.enabled.escape ? (
              <Link
                to="/play/escape"
                className="rounded-xl border border-border p-4 hover:bg-secondary"
              >
                <p className="font-medium">Escape Room</p>
                <p className="mt-1 text-xs text-muted-foreground">Browse published scenarios</p>
              </Link>
            ) : null}
            {data.enabled.knockout ? (
              <Link
                to="/play/knockout"
                className="rounded-xl border border-border p-4 hover:bg-secondary"
              >
                <p className="font-medium">Knockout</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.tournaments.length} open bracket
                  {data.tournaments.length === 1 ? "" : "s"}
                </p>
              </Link>
            ) : null}
            {data.enabled.arena ? (
              <Link
                to="/play/arena"
                className="rounded-xl border border-border p-4 hover:bg-secondary"
              >
                <p className="font-medium">Live Arena</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.arenas.length} lobby{data.arenas.length === 1 ? "" : "ies"} available
                </p>
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ModesPanel({
  modeByKind,
  data,
  startMut,
}: {
  modeByKind: Map<
    PlayKind,
    {
      segment: PlaySegment;
      mode: PlaySegmentMode;
    }
  >;
  data: NonNullable<Awaited<ReturnType<typeof getPlayHub>>>;
  startMut: {
    isPending: boolean;
    mutate: (args: { kind: PlayKind; courseId?: string; poolId?: string | null }) => void;
  };
}) {
  function start(kind: PlayKind) {
    const choice = modeByKind.get(kind);
    if (!choice) return;
    const { segment, mode } = choice;
    startMut.mutate({
      kind,
      ...(segment.scope === "course"
        ? { courseId: segment.id }
        : mode.bindingCourseId
          ? { courseId: mode.bindingCourseId }
          : {}),
      ...(mode.poolId ? { poolId: mode.poolId } : {}),
    });
  }

  const dailyChoice = modeByKind.get("daily") ?? null;
  const weeklyChoice = modeByKind.get("weekly") ?? null;

  return (
    <div className="space-y-6">
      {(dailyChoice || weeklyChoice) && (
        <section className="surface-metal rounded-xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Required
              </p>
              <h2 className="mt-1 text-lg font-semibold">
                {dailyChoice ? PLAY_KIND_META.daily.label : PLAY_KIND_META.weekly.label}
              </h2>
              <p className="text-sm text-muted-foreground">
                {dailyChoice?.mode.blurb ?? weeklyChoice?.mode.blurb}
              </p>
            </div>
            <span className="rounded-md bg-secondary px-2 py-1 text-xs tabular-nums">
              {dailyChoice?.segment.questionCount ?? weeklyChoice?.segment.questionCount ?? 0} pool questions
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {dailyChoice ? (
              data.daily.completed ? (
                data.daily.sessionId ? (
                  <Link
                    to="/play/results/$sessionId"
                    params={{ sessionId: data.daily.sessionId }}
                    className="rounded-md bg-secondary px-3 py-2 text-sm"
                  >
                    View today&apos;s result
                  </Link>
                ) : (
                  <span className="rounded-md bg-secondary px-3 py-2 text-sm">Daily complete</span>
                )
              ) : (
                <button
                  type="button"
                  disabled={startMut.isPending}
                  onClick={() => start("daily")}
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                >
                  Start daily
                </button>
              )
            ) : null}

            {weeklyChoice ? (
              <button
                type="button"
                disabled={startMut.isPending || data.weekly.completed}
                onClick={() => start("weekly")}
                className="rounded-md border border-border px-3 py-2 text-sm"
              >
                {data.weekly.completed ? "Weekly done" : "Weekly challenge"}
              </button>
            ) : null}
          </div>
        </section>
      )}

      {PLAY_KIND_GROUPS.map((group) => {
        if (group.label === "Events") return null;
        const kinds = group.kinds.filter((k) => k !== "daily" && k !== "weekly");
        const choices = kinds
          .map((kind) => modeByKind.get(kind))
          .filter(Boolean) as Array<{ segment: PlaySegment; mode: PlaySegmentMode }>;
        if (choices.length === 0) return null;

        return (
          <section key={group.label}>
            <h2 className="text-sm font-semibold">{group.label}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {choices.map((choice) => {
                const mode = choice.mode;
                const link = LINK_MODES[mode.kind];
                const courseIdForCard =
                  choice.segment.scope === "course"
                    ? choice.segment.id
                    : mode.bindingCourseId ?? choice.segment.id;

                if (link) {
                  return (
                    <PlayModeCard
                      key={mode.kind}
                      kind={mode.kind}
                      courseId={courseIdForCard}
                      questionCount={mode.questionCount}
                      durationSeconds={mode.durationSeconds}
                      lives={mode.lives}
                      to={link.to}
                      footer={
                        mode.kind === "battle" ? (
                          <AssessaIcon
                            name="swords"
                            className="mt-3 h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                          />
                        ) : undefined
                      }
                    />
                  );
                }

                return (
                  <PlayModeCard
                    key={mode.kind}
                    kind={mode.kind}
                    courseId={courseIdForCard}
                    questionCount={mode.questionCount}
                    durationSeconds={mode.durationSeconds}
                    lives={mode.lives}
                    pending={startMut.isPending}
                    onStart={() => start(mode.kind)}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
