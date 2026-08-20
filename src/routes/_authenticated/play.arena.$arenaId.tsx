import { QuestionPrompt } from "@/components/QuestionPrompt";
import {
  ArenaQuestionTimer,
  ArenaScoreboard,
  ArenaTeamScoreCard,
} from "@/components/play/ArenaScoreboard";
import { PlayOptions } from "@/components/play/PlayOptions";
import { PageLoader } from "@/components/platform";
import { getArenaPlayer, joinLiveArena, submitArenaAnswer } from "@/lib/play.functions";
import { sameIndexSet } from "@/lib/play.math";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/play/arena/$arenaId")({
  head: () => ({ meta: [{ title: "Live Arena — Assessa" }] }),
  component: ArenaPlayerPage,
});

function ArenaPlayerPage() {
  const { arenaId } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchState = useServerFn(getArenaPlayer);
  const join = useServerFn(joinLiveArena);
  const submit = useServerFn(submitArenaAnswer);
  const { data, isPending } = useQuery({
    queryKey: ["arena-player", arenaId],
    queryFn: () => fetchState({ data: { arenaId } }),
    refetchInterval: 1500,
  });
  const [teamName, setTeamName] = useState("");
  const [pick, setPick] = useState<number[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    setPick(Array.isArray(data?.myAnswer) ? data.myAnswer : []);
  }, [data?.arena.currentIndex, data?.myAnswer]);

  useEffect(() => {
    if (!data?.arena.questionEndsAt || data.arena.status !== "question") {
      setRemaining(null);
      return;
    }
    const tick = () =>
      setRemaining(
        Math.max(0, Math.round((Date.parse(data.arena.questionEndsAt!) - Date.now()) / 1000)),
      );
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [data?.arena.questionEndsAt, data?.arena.status, data?.arena.currentIndex]);

  const joinMut = useMutation({
    mutationFn: (payload: { teamName?: string; teamId?: string }) =>
      join({ data: { arenaId, ...payload } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["arena-player", arenaId] }),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not join"),
  });
  const submitMut = useMutation({
    mutationFn: (answer: number[]) => submit({ data: { arenaId, answer } }),
    onSuccess: (result) => {
      toast.success(result?.modified ? "Locked answer updated" : "Answer locked for your team");
      void queryClient.invalidateQueries({ queryKey: ["arena-player", arenaId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not submit"),
  });

  const statusLabel = useMemo(() => {
    if (!data) return "";
    if (data.arena.status === "lobby") return "Lobby — waiting for the host";
    if (data.arena.status === "question")
      return remaining != null ? `${remaining}s left` : "Answer now";
    if (data.arena.status === "locked") return "Answers locked — waiting for reveal";
    if (data.arena.status === "revealed") return "Answer revealed — waiting for the host";
    if (data.arena.status === "complete") return "Arena complete";
    return data.arena.status;
  }, [data, remaining]);

  if (isPending || !data) return <PageLoader />;

  const answering = data.arena.status === "question";
  const revealed = data.arena.status === "revealed" || data.arena.status === "complete";
  const finished = data.arena.status === "complete";
  const lockedIn = (data.myAnswer?.length ?? 0) > 0;
  const unchanged = lockedIn && sameIndexSet(pick, data.myAnswer);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to="/play/arena" className="text-xs text-accent underline">
        Live Arena
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Live Arena
          </p>
          <h1 className="font-display text-3xl">{data.arena.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{statusLabel}</p>
        </div>
        {data.question ? (
          <p className="rounded-full bg-secondary px-3 py-1 text-xs tabular-nums">
            Segment {data.question.segment + 1}/{data.arena.segmentCount} · Q
            {data.question.offset + 1} · {data.arena.currentIndex + 1}/{data.arena.totalQuestions}
          </p>
        ) : null}
      </header>

      <ArenaQuestionTimer remaining={remaining} status={data.arena.status} />

      {!data.myTeam && !finished ? (
        <section className="surface-paper space-y-3 rounded-2xl p-5">
          <h2 className="text-sm font-semibold">Join a team</h2>
          <p className="text-xs text-muted-foreground">
            {data.arena.allowOpenTeams === false
              ? "This arena uses precreated teams. Pick one below."
              : "Create a name, or join an existing team by using the same name."}
          </p>
          {data.arena.allowOpenTeams !== false ? (
            <div className="flex flex-wrap gap-2">
              <input
                className="field h-9 min-w-[12rem] text-sm"
                placeholder="Team name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
              />
              <button
                type="button"
                disabled={joinMut.isPending || teamName.trim().length < 2}
                onClick={() => joinMut.mutate({ teamName: teamName.trim() })}
                className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-60"
              >
                Join
              </button>
            </div>
          ) : null}
          {data.teams.length > 0 ? (
            <ul className="flex flex-wrap gap-2 text-sm">
              {data.teams.map((team) => (
                <li key={team.id}>
                  <button
                    type="button"
                    className="rounded-full border border-border px-3 py-1 text-xs hover:bg-secondary"
                    onClick={() => joinMut.mutate({ teamId: team.id })}
                  >
                    Join {team.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : data.arena.allowOpenTeams === false ? (
            <p className="text-xs text-muted-foreground">Waiting for the host to create teams.</p>
          ) : null}
        </section>
      ) : data.myTeam ? (
        <ArenaTeamScoreCard
          name={data.myTeam.name}
          score={data.myTeam.score}
          correctCount={data.myTeam.correctCount}
          wrongCount={data.myTeam.wrongCount}
          rank={data.myTeam.rank}
          lastResult={data.myResult}
        />
      ) : null}

      {data.myTeam &&
      data.question &&
      (answering || data.arena.status === "locked" || revealed) &&
      !finished ? (
        <section className="surface-paper rounded-2xl p-5">
          <QuestionPrompt
            prompt={data.question.prompt}
            imageUrl={data.question.imageUrl}
            level="p"
          />
          <PlayOptions
            options={data.question.options}
            multiSelect={data.question.multiSelect}
            value={pick}
            onChange={(next) => setPick(Array.isArray(next) ? next : [next])}
            disabled={!answering || submitMut.isPending}
            reveal={revealed}
            {...(revealed && data.question.correctIndexes
              ? { correctIndexes: data.question.correctIndexes }
              : {})}
          />
          {answering ? (
            <button
              type="button"
              disabled={submitMut.isPending || pick.length === 0 || unchanged}
              onClick={() => submitMut.mutate(pick)}
              className="mt-4 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-60"
            >
              {submitMut.isPending
                ? "Sending…"
                : lockedIn
                  ? "Modify the locked answer"
                  : "Lock in team answer"}
            </button>
          ) : null}
          {revealed && data.question.explanation ? (
            <p className="mt-2 text-xs text-muted-foreground">{data.question.explanation}</p>
          ) : null}
        </section>
      ) : null}

      {data.myTeam && data.arena.status === "lobby" ? (
        <p className="text-sm text-muted-foreground">
          You’re in. Wait for the host to start the first question.
        </p>
      ) : null}

      <ArenaScoreboard
        rows={
          data.board.overallVisible
            ? data.board.rows
            : data.board.segmentVisible
              ? data.board.segmentRows
              : []
        }
        highlightId={data.myTeam?.id ?? null}
        currentSegmentWinner={data.board.overallVisible ? null : data.board.currentSegmentWinner}
        segmentWinners={data.board.segmentWinners}
        champion={data.board.champion}
        visible={data.board.overallVisible || data.board.segmentVisible}
        showSegmentColumn={!data.board.overallVisible}
        title={
          data.board.overallVisible
            ? "Overall leaderboard"
            : data.board.publishedSegment != null
              ? `Segment ${data.board.publishedSegment + 1} results`
              : "Scoreboard"
        }
        emptyHint={
          finished
            ? "No teams scored."
            : "The host publishes each segment’s results, then the overall board at the end."
        }
      />
    </div>
  );
}
