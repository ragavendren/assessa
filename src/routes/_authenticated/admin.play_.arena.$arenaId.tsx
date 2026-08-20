import { QuestionPrompt } from "@/components/QuestionPrompt";
import { AdminNav } from "@/components/AdminNav";
import { AdminAccessDenied, AdminPageHeader } from "@/components/admin/AdminPageUi";
import { ArenaHostLobbyTools } from "@/components/play/ArenaHostLobbyTools";
import { ArenaPlayGuide } from "@/components/play/ArenaPlayGuide";
import {
  ArenaHeartbeatTimer,
  ArenaLiveLocks,
  ArenaScoreboard,
} from "@/components/play/ArenaScoreboard";
import { PageLoader } from "@/components/platform";
import { useArenaRealtime } from "@/hooks/use-arena-realtime";
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
  useArenaRealtime(arenaId);
  const { data, isPending, error } = useQuery({
    queryKey: ["arena-host", arenaId],
    queryFn: () => fetchHost({ data: { arenaId } }),
    refetchInterval: 4000,
    retry: false,
  });
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [boardTab, setBoardTab] = useState<"overall" | number>("overall");

  useEffect(() => {
    if (!data?.arena.questionEndsAt || data.arena.status !== "question") {
      setRemainingMs(null);
      return;
    }
    const tick = () =>
      setRemainingMs(Math.max(0, Date.parse(data.arena.questionEndsAt!) - Date.now()));
    tick();
    const id = window.setInterval(tick, 100);
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

  const { arena, question, teams, board, participants, directory, lockEvents, answerLedger } = data;
  const lastQuestion = arena.currentIndex >= arena.totalQuestions - 1;
  const lastInSegment = isLastQuestionOfSegment(arena.currentIndex, arena.questionsPerSegment);
  const submitted = teams.filter((t) => t.submitted).length;
  const showKey = isArenaKeyVisible(arena.status);
  const segmentBoards = board.allSegmentBoards ?? [];
  const activeRows =
    boardTab === "overall"
      ? board.rows
      : (segmentBoards.find((row) => row.segment === boardTab)?.rows ?? []);
  const activeWinner =
    boardTab === "overall"
      ? null
      : (board.segmentWinners.find((row) => row.segment === boardTab) ?? null);
  const undockUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/admin/play/scoreboard/${arenaId}`
      : `/admin/play/scoreboard/${arenaId}`;

  function openScoreboardWindow() {
    const popup = window.open(
      undockUrl,
      `arena-scoreboard-${arenaId}`,
      "noopener,noreferrer,width=1440,height=900",
    );
    if (!popup) {
      toast.error("Pop-up blocked — allow pop-ups for the undocked scoreboard");
      return;
    }
    popup.focus();
  }

  return (
    <div className="relative space-y-6">
      <AdminNav />
      <AdminPageHeader
        title={arena.name}
        back={{ to: "/admin/play", label: "Play" }}
        action={
          <ArenaPlayGuide
            defaultOpen={arena.status === "lobby" || arena.status === "draft"}
            config={{
              name: arena.name,
              segmentCount: arena.segmentCount,
              questionsPerSegment: arena.questionsPerSegment,
              totalQuestions: arena.totalQuestions,
              perQuestionSeconds: arena.perQuestionSeconds,
              correctMarks: arena.correctMarks,
              wrongMarks: arena.wrongMarks,
              timeBonusMax: arena.timeBonusMax,
              earlyLockBonus: arena.earlyLockBonus,
            }}
            share={{ arenaId: arena.id, arenaName: arena.name }}
          />
        }
        help={{
          label: "Host controls",
          body: "Open the game guide (book icon, top right) for scoring rules. Use QR beside it to invite. Undock the scoreboard from the table for the audience screen.",
        }}
      />
      <p className="text-sm">
        <span className="capitalize">{arena.status}</span>
        <span className="ml-2 text-muted-foreground">
          Q {Math.min(arena.currentIndex + 1, arena.totalQuestions)}/{arena.totalQuestions} · +
          {arena.correctMarks}/−{arena.wrongMarks}
          {arena.timeBonusMax ? ` · time +${arena.timeBonusMax}` : ""}
          {arena.earlyLockBonus ? ` · first lock +${arena.earlyLockBonus}` : ""}
          {arena.publishedThroughSegment >= 0
            ? ` · published through S${arena.publishedThroughSegment + 1}`
            : ""}
        </span>
      </p>

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

      <div className="space-y-5">
        <div className="space-y-4">
          {question ? (
            <section className="surface-paper rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Segment {(question.segment ?? 0) + 1} · submitted {submitted}/{teams.length}
                </p>
                <ArenaHeartbeatTimer
                  remainingMs={remainingMs}
                  durationSeconds={arena.perQuestionSeconds}
                  status={arena.status}
                />
              </div>
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
              <ArenaLiveLocks events={lockEvents ?? []} status={arena.status} />
            </section>
          ) : (
            <p className="text-sm text-muted-foreground">
              {arena.status === "complete"
                ? "Overall results announced. Question play is closed."
                : arena.status === "lobby" || arena.status === "draft"
                  ? `Lobby open. ${teams.length} teams waiting — start the first question when ready.`
                  : "Waiting for the next question."}
            </p>
          )}
        </div>

        <div className="space-y-3 border-t border-border pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Scoreboard
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => setBoardTab("overall")}
                className={cn(
                  "rounded-full px-3 py-1.5",
                  boardTab === "overall" ? "bg-primary text-primary-foreground" : "bg-secondary",
                )}
              >
                Overall
              </button>
              {segmentBoards.map((seg) => (
                <button
                  key={seg.segment}
                  type="button"
                  onClick={() => setBoardTab(seg.segment)}
                  className={cn(
                    "rounded-full px-3 py-1.5",
                    boardTab === seg.segment
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary",
                  )}
                >
                  S{seg.segment + 1}
                </button>
              ))}
            </div>
          </div>
          <ArenaScoreboard
            rows={activeRows}
            currentSegmentWinner={activeWinner}
            segmentWinners={board.segmentWinners}
            champion={boardTab === "overall" ? board.champion : null}
            visible
            showSegmentColumn={boardTab === "overall"}
            showDetailColumns
            undockMode="undock"
            onUndock={openScoreboardWindow}
            answerLedger={answerLedger}
            ledgerSegment={boardTab === "overall" ? null : boardTab}
            title={
              boardTab === "overall"
                ? board.overallVisible
                  ? "Overall leaderboard"
                  : "Cumulative host board"
                : `Segment ${boardTab + 1}`
            }
          />
        </div>
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
