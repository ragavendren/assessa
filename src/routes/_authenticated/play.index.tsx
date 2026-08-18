import { HelpTextLink } from "@/components/help/HelpCenter";
import { AssessaIcon } from "@/components/icons";
import { PageLoader } from "@/components/platform";
import { PlayLeaderboardPanel } from "@/components/play/PlayLeaderboardPanel";
import { PlayModeCard } from "@/components/play/PlayModeCard";
import { beginPlay, getPlayHub } from "@/lib/play.functions";
import { PLAY_KIND_GROUPS, PLAY_KIND_META, type PlayKind, type PlaySegment } from "@/lib/play.math";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/play/")({
  validateSearch: z.object({
    courseId: z.string().uuid().optional(),
    activityId: z.string().uuid().optional(),
  }),
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

const LINK_MODES: Partial<
  Record<PlayKind, { to: string; params?: { tournamentId: string }; searchKey?: "courseId" }>
> = {
  topic: { to: "/play/topics", searchKey: "courseId" },
  flash: { to: "/play/flash", searchKey: "courseId" },
  battle: { to: "/play/battle" },
  team: { to: "/play/team" },
  escape: { to: "/play/escape" },
  arena: { to: "/play/arena" },
};

function PlayHub() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { courseId: searchCourseId, activityId: searchActivityId } = Route.useSearch();
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
  const courseSegments = segments.filter((s) => s.scope === "course");
  const activitySegments = segments.filter((s) => s.scope === "activity");
  const selected =
    (searchActivityId
      ? activitySegments.find((s) => s.id === searchActivityId)
      : courseSegments.find((s) => s.id === searchCourseId)) ??
    courseSegments[0] ??
    activitySegments[0] ??
    null;

  const boardKind = useMemo(() => {
    if (!selected) return null;
    return (
      selected.modes.find((m) => m.kind === "daily")?.kind ??
      selected.modes.find((m) => m.kind === "speed")?.kind ??
      selected.modes.find((m) => m.kind === "topic")?.kind ??
      selected.modes[0]?.kind ??
      null
    );
  }, [selected]);

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
          {selected && boardKind && selected.scope === "course" ? (
            <Link
              to="/play/leaderboard"
              search={{ courseId: selected.id, kind: boardKind }}
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

      {courseSegments.length > 0 ? (
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Course
          </p>
          <div className="flex flex-wrap gap-2">
            {courseSegments.map((segment) => (
              <button
                key={segment.id}
                type="button"
                onClick={() => navigate({ search: { courseId: segment.id } })}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
                  selected?.scope === "course" && selected.id === segment.id
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "border-border hover:bg-secondary",
                )}
              >
                <AssessaIcon name="courses" className="h-4 w-4 shrink-0" />
                {segment.name}
                <span className="text-xs text-muted-foreground">({segment.modes.length})</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {activitySegments.length > 0 ? (
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Activity
          </p>
          <div className="flex flex-wrap gap-2">
            {activitySegments.map((segment) => (
              <button
                key={segment.id}
                type="button"
                onClick={() => navigate({ search: { activityId: segment.id } })}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
                  selected?.scope === "activity" && selected.id === segment.id
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "border-border hover:bg-secondary",
                )}
              >
                <AssessaIcon name="escape" className="h-4 w-4 shrink-0" />
                {segment.name}
                <span className="text-xs text-muted-foreground">({segment.modes.length})</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {selected && boardKind && selected.scope === "course" ? (
        <section className="surface-paper rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <AssessaIcon name="trophy" className="h-4 w-4 text-amber-500" />
              Leaderboard · {PLAY_KIND_META[boardKind].label} · {selected.name}
            </h2>
            <Link
              to="/play/leaderboard"
              search={{ courseId: selected.id, kind: boardKind }}
              className="text-xs font-medium text-accent underline"
            >
              Full board
            </Link>
          </div>
          <div className="mt-3">
            <PlayLeaderboardPanel
              kind={boardKind}
              courseId={selected.id}
              courseName={selected.name}
            />
          </div>
        </section>
      ) : null}

      {selected ? <SegmentPanel segment={selected} data={data} startMut={startMut} /> : null}

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

      {(data.enabled.knockout && data.tournaments[0]) ||
      data.enabled.escape ||
      data.arenas.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold">Events</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {data.enabled.escape ? (
              <Link
                to="/play/escape"
                className="rounded-xl border border-border p-4 hover:bg-secondary"
              >
                <p className="font-medium">Escape Room</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Solve incident scenes scene by scene.
                </p>
              </Link>
            ) : null}
            {data.enabled.knockout && data.tournaments[0] ? (
              <Link
                to="/play/tournament/$tournamentId"
                params={{ tournamentId: data.tournaments[0].id }}
                className="rounded-xl border border-border p-4 hover:bg-secondary"
              >
                <p className="font-medium">Knockout · {data.tournaments[0].name}</p>
                <p className="mt-1 text-xs text-muted-foreground">Bracket tournament</p>
              </Link>
            ) : null}
            {data.arenas.map((arena) => (
              <Link
                key={arena.id}
                to="/play/arena/$arenaId"
                params={{ arenaId: arena.id }}
                className="rounded-xl border border-border p-4 hover:bg-secondary"
              >
                <p className="font-medium">Live Arena · {arena.name}</p>
                <p className="mt-1 text-xs capitalize text-muted-foreground">{arena.status}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SegmentPanel({
  segment,
  data,
  startMut,
}: {
  segment: PlaySegment;
  data: NonNullable<Awaited<ReturnType<typeof getPlayHub>>>;
  startMut: {
    isPending: boolean;
    mutate: (args: { kind: PlayKind; courseId?: string; poolId?: string | null }) => void;
  };
}) {
  const daily = segment.modes.find((m) => m.kind === "daily");
  const weekly = segment.modes.find((m) => m.kind === "weekly");

  function launch(kind: PlayKind) {
    const mode = segment.modes.find((m) => m.kind === kind);
    startMut.mutate({
      kind,
      ...(segment.scope === "course"
        ? { courseId: segment.id }
        : mode?.bindingCourseId
          ? { courseId: mode.bindingCourseId }
          : {}),
      ...(mode?.poolId ? { poolId: mode.poolId } : {}),
    });
  }

  return (
    <div className="space-y-6">
      {(daily || weekly) && (
        <section className="surface-metal rounded-xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {segment.name}
              </p>
              <h2 className="mt-1 text-lg font-semibold">
                {daily ? PLAY_KIND_META.daily.label : PLAY_KIND_META.weekly.label}
              </h2>
              <p className="text-sm text-muted-foreground">{daily?.blurb ?? weekly?.blurb}</p>
            </div>
            <span className="rounded-md bg-secondary px-2 py-1 text-xs tabular-nums">
              {segment.questionCount} pool questions
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {daily ? (
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
                  onClick={() => launch("daily")}
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                >
                  Start daily
                </button>
              )
            ) : null}
            {weekly ? (
              <button
                type="button"
                disabled={startMut.isPending || data.weekly.completed}
                onClick={() => launch("weekly")}
                className="rounded-md border border-border px-3 py-2 text-sm"
              >
                {data.weekly.completed ? "Weekly done" : "Weekly challenge"}
              </button>
            ) : null}
          </div>
        </section>
      )}

      {PLAY_KIND_GROUPS.map((group) => {
        const modes = segment.modes.filter((m) => group.kinds.includes(m.kind));
        if (modes.length === 0) return null;
        return (
          <section key={group.label}>
            <h2 className="text-sm font-semibold">{group.label}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {modes.map((mode) => {
                const link = LINK_MODES[mode.kind];
                if (link) {
                  const search =
                    mode.kind === "arena" && segment.scope === "activity"
                      ? { activityId: segment.id }
                      : link.searchKey
                        ? {
                            [link.searchKey]:
                              segment.scope === "course"
                                ? segment.id
                                : (mode.bindingCourseId ?? segment.id),
                          }
                        : undefined;
                  return (
                    <PlayModeCard
                      key={mode.kind}
                      kind={mode.kind}
                      courseId={segment.id}
                      questionCount={mode.questionCount}
                      durationSeconds={mode.durationSeconds}
                      lives={mode.lives}
                      to={link.to}
                      {...(search ? { search } : {})}
                      {...(link.params ? { params: link.params } : {})}
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
                    courseId={segment.id}
                    questionCount={mode.questionCount}
                    durationSeconds={mode.durationSeconds}
                    lives={mode.lives}
                    pending={startMut.isPending}
                    onStart={() => launch(mode.kind)}
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
