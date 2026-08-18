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
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/play/leaderboard")({
  validateSearch: z.object({
    courseId: z.string().uuid().optional(),
    kind: z.enum(PLAY_KINDS).optional(),
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

  const segments = hub?.segments ?? [];
  const courseId = search.courseId ?? segments[0]?.courseId ?? null;
  const segment = segments.find((s) => s.courseId === courseId) ?? segments[0];
  const kind =
    search.kind ??
    segment?.modes.find((m) => m.kind === "daily")?.kind ??
    segment?.modes[0]?.kind ??
    ("daily" as PlayKind);

  const { data: board, isPending: boardPending } = useQuery({
    queryKey: ["play-board-full", kind, courseId, search.topic ?? ""],
    queryFn: () =>
      fetchBoard({
        data: {
          kind,
          courseId: courseId!,
          ...(search.topic ? { topic: search.topic } : {}),
        },
      }),
    enabled: Boolean(courseId),
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
          body="An admin can enable the Play menu in Play control to show course challenge rankings here."
          action={
            <Link to="/leaderboard" className="mt-2 text-sm text-accent underline">
              Open assessment leaderboard
            </Link>
          }
        />
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="space-y-6">
        <LeaderboardHero
          kicker="Play leaderboard"
          title="Rankings"
          subtitle="Configure play modes and pools for a course to see rankings here."
          tabs={<LeaderboardTabs active="play" playEnabled tone="banner" />}
        />
        <EmptyState
          title="No play leaderboards yet"
          body="Configure play modes and pools for a course to see rankings here."
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
              value={myRank ? `#${myRank}` : "—"}
            />
          </>
        }
        tabs={<LeaderboardTabs active="play" playEnabled tone="banner" />}
      />

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Course
        </p>
        <div className="flex flex-wrap gap-2">
          {segments.map((s) => (
            <button
              key={s.courseId}
              type="button"
              onClick={() =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    courseId: s.courseId,
                    kind: s.modes.some((m) => m.kind === kind) ? kind : s.modes[0]?.kind,
                  }),
                })
              }
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
                courseId === s.courseId
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-secondary",
              )}
            >
              <AssessaIcon name="courses" className="h-3.5 w-3.5" />
              {s.courseName}
            </button>
          ))}
        </div>
      </section>

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Mode
        </p>
        <div className="flex flex-wrap gap-2">
          {(segment?.modes ?? []).map((mode) => (
            <button
              key={mode.kind}
              type="button"
              onClick={() =>
                navigate({ search: (prev) => ({ ...prev, kind: mode.kind, topic: undefined }) })
              }
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm",
                kind === mode.kind
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-secondary",
              )}
            >
              {PLAY_KIND_META[mode.kind].label}
            </button>
          ))}
        </div>
      </section>

      {boardPending ? (
        <PageLoader label="Loading scores…" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No scores yet"
          body="Complete a challenge in this course to appear on the board."
        />
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-hairline text-muted-foreground">Now showing</p>
            <h2 className="font-display text-2xl">
              {segment?.courseName} · {meta.label}
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
