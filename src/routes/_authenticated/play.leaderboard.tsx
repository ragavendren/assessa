import { AssessaIcon } from "@/components/icons";
import { BoardStage, LeaderboardChip, LeaderboardHero } from "@/components/leaderboard/BoardStage";
import { LeaderboardTabs } from "@/components/play/LeaderboardTabs";
import { EmptyState, PageLoader } from "@/components/platform";
import { useMe } from "@/hooks/use-me";
import { getPlayBoard, getPlayHub } from "@/lib/play.functions";
import { PLAY_KIND_META, PLAY_KINDS, type PlayKind } from "@/lib/play.math";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/play/leaderboard")({
  validateSearch: z.object({
    kind: z.enum(PLAY_KINDS).optional(),
    activityId: z.string().uuid().optional(),
    topic: z.string().optional(),
  }),
  head: () => ({ meta: [{ title: "Play leaderboard — Assessa" }] }),
  component: PlayLeaderboardPage,
});

function PlayLeaderboardPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  const { data: me } = useMe();
  const fetchHub = useServerFn(getPlayHub);
  const fetchBoard = useServerFn(getPlayBoard);

  const { data: hub, isPending: hubPending } = useQuery({
    queryKey: ["play-hub"],
    queryFn: () => fetchHub(),
  });

  const activities = useMemo(
    () => (hub?.segments ?? []).filter((s) => s.scope === "activity"),
    [hub?.segments],
  );
  const enabledKinds = useMemo(() => {
    const kinds = new Set<PlayKind>();
    for (const [kind, on] of Object.entries(hub?.enabled ?? {})) {
      if (on) kinds.add(kind as PlayKind);
    }
    for (const segment of hub?.segments ?? []) {
      for (const mode of segment.modes) kinds.add(mode.kind);
    }
    return PLAY_KINDS.filter((kind) => kinds.has(kind));
  }, [hub]);

  const kind =
    search.kind && enabledKinds.includes(search.kind)
      ? search.kind
      : (enabledKinds.find((k) => k === "daily") ?? enabledKinds[0] ?? ("daily" as PlayKind));
  const activityId = search.activityId ?? null;
  const activity = activities.find((s) => s.id === activityId) ?? null;

  const { data: board, isPending: boardPending } = useQuery({
    queryKey: ["play-board-full", kind, activityId ?? "all", search.topic ?? ""],
    queryFn: () =>
      fetchBoard({
        data: {
          kind,
          ...(activityId ? { activityId } : {}),
          ...(search.topic ? { topic: search.topic } : {}),
        },
      }),
    enabled: Boolean(kind),
  });

  if (hubPending || !hub) return <PageLoader label="Loading leaderboard…" />;

  const playOn = hub.menuEnabled === true;

  if (!playOn) {
    return (
      <div className="space-y-6">
        <LeaderboardHero
          title="Rankings"
          subtitle="Play is turned off. Assessment rankings are still available."
          tabs={
            <Link
              to="/leaderboard"
              className="text-sm font-medium text-primary-foreground underline-offset-4 hover:underline"
            >
              Assessment rankings
            </Link>
          }
        />
        <EmptyState
          title="Play leaderboard is off"
          body="An admin can enable the Play menu in Play control to show challenge rankings here."
          action={
            <Link to="/leaderboard" className="mt-2 text-sm text-accent underline">
              Open assessment leaderboard
            </Link>
          }
        />
      </div>
    );
  }

  if (enabledKinds.length === 0) {
    return (
      <div className="space-y-6">
        <LeaderboardHero
          kicker="Play leaderboard"
          title="Rankings"
          subtitle="Turn on play modes to see rankings here."
          tabs={<LeaderboardTabs active="play" playEnabled tone="banner" />}
        />
        <EmptyState
          title="No play leaderboards yet"
          body="Enable play modes under Admin → Play so rankings can appear here."
        />
      </div>
    );
  }

  const rows = (board?.rows ?? []).map((row) => ({
    rank: row.rank,
    name: row.name,
    score: row.score,
    durationSeconds: "durationSeconds" in row ? row.durationSeconds : null,
    isMe: "userId" in row && row.userId === me?.profile.id,
  }));
  const meta = PLAY_KIND_META[kind];
  const myRank = rows.find((row) => row.isMe)?.rank ?? null;

  return (
    <div className="space-y-6">
      <LeaderboardHero
        kicker="Play leaderboard"
        title="Rankings"
        subtitle="Filter by play mode and activity. Top 3 stand on the podium — gold, silver and bronze stay highlighted."
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
              value={myRank ? `#${myRank}` : "—"}
            />
          </>
        }
        tabs={<LeaderboardTabs active="play" playEnabled tone="banner" />}
      />

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Play mode
        </p>
        <div className="flex flex-wrap gap-2">
          {enabledKinds.map((modeKind) => (
            <button
              key={modeKind}
              type="button"
              onClick={() =>
                navigate({ search: (prev) => ({ ...prev, kind: modeKind, topic: undefined }) })
              }
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm",
                kind === modeKind
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-secondary",
              )}
            >
              {PLAY_KIND_META[modeKind].label}
            </button>
          ))}
        </div>
      </section>

      {activities.length > 0 ? (
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Activity
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate({ search: (prev) => ({ ...prev, activityId: undefined }) })}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
                !activityId
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-secondary",
              )}
            >
              All activities
            </button>
            {activities.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => navigate({ search: (prev) => ({ ...prev, activityId: s.id }) })}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
                  activityId === s.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-secondary",
                )}
              >
                <AssessaIcon name="play" className="h-3.5 w-3.5" />
                {s.name}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {boardPending ? (
        <PageLoader label="Loading scores…" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No scores yet"
          body={
            activity
              ? `Complete ${meta.label} in ${activity.name} to appear on the board.`
              : `Complete ${meta.label} to appear on the board.`
          }
        />
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-hairline text-muted-foreground">Now showing</p>
            <h2 className="font-display text-2xl">
              {meta.label}
              {activity ? ` · ${activity.name}` : ""}
              {search.topic ? ` · ${search.topic}` : ""}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Ranked by best score, then faster finish.
            </p>
          </div>
          <BoardStage rows={rows} columns="play" podiumHint="Best score · faster finish" />
        </div>
      )}
    </div>
  );
}
