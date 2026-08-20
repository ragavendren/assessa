import { QuestionPrompt } from "@/components/QuestionPrompt";
import { AdminNav } from "@/components/AdminNav";
import { AdminAccessDenied, AdminPageHeader } from "@/components/admin/AdminPageUi";
import { ArenaHostLobbyTools } from "@/components/play/ArenaHostLobbyTools";
import { ArenaQuestionTimer, ArenaScoreboard } from "@/components/play/ArenaScoreboard";
import { ArenaShareCard } from "@/components/play/ArenaShareCard";
import { PageLoader } from "@/components/platform";
import { isArenaKeyVisible, isLastQuestionOfSegment } from "@/lib/play.arena";
import { deleteLiveArena, getArenaHost, runArenaAction } from "@/lib/play.functions";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type ArenaHostAction = "start" | "lock" | "reveal" | "next" | "publishSegment" | "finish";

export const Route = createFileRoute("/_authenticated/admin/play_/arena/$arenaId")({
  head: () => ({ meta: [{ title: "Host Live Arena — Assessa Admin" }] }),
  component: ArenaHostPage,
});

function ArenaHostPage() {
  const { arenaId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchHost = useServerFn(getArenaHost);
  const act = useServerFn(runArenaAction);
  const remove = useServerFn(deleteLiveArena);
  const { data, isPending, error } = useQuery({
    queryKey: ["arena-host", arenaId],
    queryFn: () => fetchHost({ data: { arenaId } }),
    refetchInterval: 1500,
    retry: false,
  });
  const [remaining, setRemaining] = useState<number | null>(null);

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

  const actionMut = useMutation({
    mutationFn: (action: ArenaHostAction) => act({ data: { arenaId, action } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["arena-host", arenaId] });
      void queryClient.invalidateQueries({ queryKey: ["arena-player", arenaId] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Action failed"),
  });
  const deleteMut = useMutation({
    mutationFn: () => remove({ data: { arenaId } }),
    onSuccess: () => {
      toast.success("Event deleted");
      void navigate({ to: "/admin/play" });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not delete"),
  });

  if (isPending) {
    return (
      <div>
        <AdminNav />
        <PageLoader />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div>
        <AdminNav />
        <AdminAccessDenied />
      </div>
    );
  }

  const { arena, question, teams, board, participants, directory } = data;
  const lastQuestion = arena.currentIndex >= arena.totalQuestions - 1;
  const lastInSegment = isLastQuestionOfSegment(arena.currentIndex, arena.questionsPerSegment);
  const submitted = teams.filter((t) => t.submitted).length;
  const showKey = isArenaKeyVisible(arena.status);

  return (
    <div className="space-y-6">
      <AdminNav />
      <AdminPageHeader
        title={arena.name}
        back={{ to: "/admin/play", label: "Play" }}
        help={{
          label: "Host controls",
          body: "The timer is visible while a question is open. Answers stay hidden until you lock. Reveal the key, publish that segment’s results, then publish the overall leaderboard after the last segment.",
        }}
      />
      <p className="text-sm">
        <span className="capitalize">{arena.status}</span>
        <span className="ml-2 text-muted-foreground">
          Q {Math.min(arena.currentIndex + 1, arena.totalQuestions)}/{arena.totalQuestions} · +
          {arena.correctMarks}/−{arena.wrongMarks}
          {arena.timeBonusMax ? ` · time +${arena.timeBonusMax}` : ""}
          {arena.earlyLockBonus ? ` · early lock +${arena.earlyLockBonus}` : ""}
          {arena.publishedThroughSegment >= 0
            ? ` · published through S${arena.publishedThroughSegment + 1}`
            : ""}
        </span>
      </p>
      <ArenaQuestionTimer remaining={remaining} status={arena.status} />

      <ArenaShareCard arenaId={arena.id} arenaName={arena.name} />

      {arena.status !== "complete" ? (
        <ArenaHostLobbyTools
          arenaId={arena.id}
          participants={participants ?? []}
          directory={directory ?? []}
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {arena.status === "lobby" || arena.status === "draft" ? (
          <HostBtn
            label="Start first question"
            pending={actionMut.isPending}
            onClick={() => actionMut.mutate("start")}
          />
        ) : null}
        {arena.status === "question" ? (
          <HostBtn
            label="Lock answers"
            pending={actionMut.isPending}
            onClick={() => actionMut.mutate("lock")}
          />
        ) : null}
        {arena.status === "locked" ? (
          <HostBtn
            label="Reveal answer"
            pending={actionMut.isPending}
            onClick={() => actionMut.mutate("reveal")}
          />
        ) : null}
        {arena.publishSegmentReady ? (
          <HostBtn
            label={`Publish segment ${(question?.segment ?? 0) + 1} results`}
            pending={actionMut.isPending}
            onClick={() => actionMut.mutate("publishSegment")}
          />
        ) : null}
        {arena.status === "revealed" && !lastQuestion && !arena.publishSegmentReady ? (
          <HostBtn
            label={lastInSegment ? "Start next segment" : "Next question"}
            pending={actionMut.isPending}
            onClick={() => actionMut.mutate("next")}
          />
        ) : null}
        {arena.status === "revealed" && lastQuestion && !arena.publishSegmentReady ? (
          <HostBtn
            label="Publish overall results"
            pending={actionMut.isPending}
            onClick={() => actionMut.mutate("finish")}
          />
        ) : null}
        <button
          type="button"
          disabled={deleteMut.isPending}
          onClick={() => {
            if (window.confirm(`Delete “${arena.name}”? Teams and answers are removed.`)) {
              deleteMut.mutate();
            }
          }}
          className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive disabled:opacity-60"
        >
          {deleteMut.isPending ? "Deleting…" : "Delete event"}
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="space-y-4">
          {question ? (
            <section className="surface-paper rounded-2xl p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Segment {(question.segment ?? 0) + 1} · submitted {submitted}/{teams.length}
              </p>
              <QuestionPrompt
                prompt={question.prompt}
                imageUrl={question.imageUrl}
                level="p"
                showUrl
                className="mt-2"
              />
              <ol className="mt-3 list-none space-y-1 text-sm">
                {question.options.map((option, index) => (
                  <li
                    key={index}
                    className={cn(
                      "rounded-md px-2 py-1",
                      showKey && question.correctIndexes?.includes(index) ? "bg-success/10" : "",
                    )}
                  >
                    {String.fromCharCode(65 + index)}. {option}
                  </li>
                ))}
              </ol>
            </section>
          ) : (
            <p className="text-sm text-muted-foreground">
              Lobby open. {teams.length} teams waiting.
            </p>
          )}
          {teams.length > 0 ? (
            <ul className="flex flex-wrap gap-2 text-xs">
              {teams.map((team) => (
                <li
                  key={team.id}
                  className={cn(
                    "rounded-full px-3 py-1",
                    team.submitted
                      ? "bg-success/15 text-success"
                      : "bg-secondary text-muted-foreground",
                  )}
                >
                  {team.name}
                  {arena.status === "revealed" && showKey && team.correct != null
                    ? team.correct
                      ? " · correct"
                      : " · wrong"
                    : team.submitted
                      ? " · in"
                      : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <ArenaScoreboard
          rows={board.rows}
          currentSegmentWinner={board.currentSegmentWinner ?? null}
          segmentWinners={board.segmentWinners}
          champion={board.champion}
          visible
          title={board.overallVisible ? "Overall leaderboard" : "Host scoreboard"}
        />
      </div>
    </div>
  );
}

function HostBtn({
  label,
  pending,
  onClick,
}: {
  label: string;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
    >
      {pending ? "Working…" : label}
    </button>
  );
}
