import { QuestionPrompt } from "@/components/QuestionPrompt";
import { ArenaScoreboard } from "@/components/play/ArenaScoreboard";
import { PlayOptions } from "@/components/play/PlayOptions";
import { PageLoader } from "@/components/platform";
import { getArenaPlayer, joinLiveArena, submitArenaAnswer } from "@/lib/play.functions";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Timer } from "lucide-react";
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
    onSuccess: () => {
      toast.success("Answer locked for your team");
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
    if (data.arena.status === "revealed") return "Key and scoreboard revealed";
    if (data.arena.status === "complete") return "Arena complete";
    return data.arena.status;
  }, [data, remaining]);

  if (isPending || !data) return <PageLoader />;

  const answering = data.arena.status === "question";
  const revealed = data.arena.status === "revealed" || data.arena.status === "complete";
  const finished = data.arena.status === "complete";

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

      {answering && remaining != null ? (
        <p className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1.5 text-sm font-medium text-amber-800 dark:text-amber-200">
          <Timer className="h-4 w-4" />
          {remaining}s
        </p>
      ) : null}

      {!data.myTeam && !finished ? (
        <section className="surface-paper space-y-3 rounded-2xl p-5">
          <h2 className="text-sm font-semibold">Join a team</h2>
          <p className="text-xs text-muted-foreground">
            Create a name, or join an existing team by using the same name.
          </p>
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
          ) : null}
        </section>
      ) : data.myTeam ? (
        <p className="rounded-xl bg-secondary px-4 py-2 text-sm">
          Your team: <span className="font-medium">{data.myTeam.name}</span>
        </p>
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
              disabled={submitMut.isPending || pick.length === 0}
              onClick={() => submitMut.mutate(pick)}
              className="mt-4 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-60"
            >
              {submitMut.isPending ? "Sending…" : "Lock in team answer"}
            </button>
          ) : null}
          {data.myResult ? (
            <p
              className={cn(
                "mt-3 text-sm",
                data.myResult.correct ? "text-success" : "text-muted-foreground",
              )}
            >
              {data.myResult.correct ? "Correct" : "Not correct"} · {data.myResult.marks} marks
            </p>
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
        rows={data.board.visible ? data.board.rows : []}
        highlightId={data.myTeam?.id ?? null}
        currentSegmentWinner={data.board.visible ? data.board.currentSegmentWinner : null}
        segmentWinners={data.board.segmentWinners}
        champion={data.board.champion}
        visible={data.board.visible}
        emptyHint={
          finished ? "No teams scored." : "The host will reveal the overall board with each key."
        }
      />
    </div>
  );
}
