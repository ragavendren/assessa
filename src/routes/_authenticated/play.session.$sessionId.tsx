import { PlayOptions } from "@/components/play/PlayOptions";
import { QuestionPrompt } from "@/components/QuestionPrompt";
import { BattleHud } from "@/components/play/BattleHud";
import { SpeedHud } from "@/components/play/SpeedHud";
import { RapidHud, SurvivalHud } from "@/components/play/SurvivalHud";
import { SurvivalHitBanner, SurvivalLifeLostBanner } from "@/components/play/SurvivalOutcome";
import { PageLoader } from "@/components/platform";
import {
  answerPlayItem,
  finishPlay,
  getBattleLive,
  getPlayPaper,
  savePlayProgress,
} from "@/lib/play.functions";
import { PLAY_KIND_META } from "@/lib/play.math";
import { crossedSpeedAlert } from "@/lib/play.speed";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/play/session/$sessionId")({
  head: () => ({
    meta: [{ title: "Challenge in progress — Assessa" }],
  }),
  component: PlaySessionPage,
});

function PlaySessionPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const fetchPaper = useServerFn(getPlayPaper);
  const fetchBattle = useServerFn(getBattleLive);
  const save = useServerFn(savePlayProgress);
  const grade = useServerFn(answerPlayItem);
  const finish = useServerFn(finishPlay);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["play-paper", sessionId],
    queryFn: () => fetchPaper({ data: { sessionId } }),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const matchId = data?.session.matchId ?? null;
  const isDualMatch =
    Boolean(matchId) && (data?.session.kind === "battle" || data?.session.kind === "knockout");

  const { data: battleLive } = useQuery({
    queryKey: ["battle-live", matchId],
    queryFn: () => fetchBattle({ data: { matchId: matchId! } }),
    enabled: Boolean(isDualMatch && matchId),
    refetchInterval: isDualMatch ? 2000 : false,
  });

  useEffect(() => {
    if (!battleLive) return;
    if (battleLive.canAnswer && !data?.session.endsAt) {
      void refetch();
    }
  }, [battleLive, data?.session.endsAt, refetch]);

  const [answers, setAnswers] = useState<Record<string, number | number[]>>({});
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [itemRemaining, setItemRemaining] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; explanation: string } | null>(null);
  const [streak, setStreak] = useState(0);
  const [shake, setShake] = useState(false);
  const [survivalBeat, setSurvivalBeat] = useState<"hit" | "life" | null>(null);
  const [speedAlert, setSpeedAlert] = useState<{ title: string; body: string } | null>(null);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const lastSpeedPctRef = useRef<number | null>(null);
  const speedAlertTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!data) return;
    setAnswers(data.session.answers ?? {});
    setIndex(data.session.currentIndex ?? 0);
    setRemaining(
      data.session.endsAt
        ? Math.max(0, Math.round((Date.parse(data.session.endsAt) - Date.now()) / 1000))
        : null,
    );
    setItemRemaining(
      data.session.questionEndsAt
        ? Math.max(0, Math.round((Date.parse(data.session.questionEndsAt) - Date.now()) / 1000))
        : null,
    );
  }, [data]);

  const goResult = useCallback(() => {
    void navigate({ to: "/play/results/$sessionId", params: { sessionId }, replace: true });
  }, [navigate, sessionId]);

  const finishMut = useMutation({
    mutationFn: () => finish({ data: { sessionId, answers: answersRef.current } }),
    onSuccess: goResult,
    onError: (err) => toast.error(err instanceof Error ? err.message : "Submit failed"),
  });

  useEffect(() => {
    if (remaining == null) return;
    const id = window.setInterval(() => {
      setRemaining((value) => {
        if (value == null) return value;
        if (value <= 1) {
          window.clearInterval(id);
          finishMut.mutate();
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [remaining == null]);

  useEffect(() => {
    if (!data?.session.rules.perItem || itemRemaining == null) return;
    const id = window.setInterval(() => {
      setItemRemaining((value) => {
        if (value == null) return value;
        if (value <= 1) {
          window.clearInterval(id);
          const q = data.questions[index];
          if (q) {
            grade({ data: { sessionId, questionId: q.id, answer: null } }).then((result) => {
              if ("finished" in result && result.finished) {
                goResult();
                return;
              }
              setFeedback({ correct: false, explanation: "" });
              if ("nextIndex" in result) setIndex(result.nextIndex);
              setItemRemaining(
                "questionEndsAt" in result && result.questionEndsAt
                  ? Math.max(0, Math.round((Date.parse(result.questionEndsAt) - Date.now()) / 1000))
                  : data.session.rules.perQuestionSeconds,
              );
              void refetch();
            });
          }
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [data?.session.rules.perItem, itemRemaining == null, index]);

  useEffect(() => {
    if (data?.session.kind !== "speed" || remaining == null) return;
    const duration = Math.max(1, data.session.rules.durationSeconds ?? remaining);
    const pct = remaining / duration;
    const prev = lastSpeedPctRef.current;
    lastSpeedPctRef.current = pct;
    if (prev == null || prev <= pct) return;
    const hit = crossedSpeedAlert(prev, pct);
    if (!hit) return;
    setSpeedAlert({ title: hit.title, body: hit.body });
    if (speedAlertTimer.current) window.clearTimeout(speedAlertTimer.current);
    speedAlertTimer.current = window.setTimeout(() => setSpeedAlert(null), 3200);
  }, [remaining, data?.session.kind, data?.session.rules.durationSeconds]);

  useEffect(() => {
    return () => {
      if (speedAlertTimer.current) window.clearTimeout(speedAlertTimer.current);
    };
  }, []);

  useEffect(() => {
    if (
      !data?.session.rules.perItem &&
      (data?.session.kind === "marathon" ||
        data?.session.kind === "battle" ||
        data?.session.kind === "knockout")
    ) {
      const id = window.setInterval(
        () => {
          void save({
            data: { sessionId, answers: answersRef.current, currentIndex: index },
          });
        },
        data.session.kind === "battle" || data.session.kind === "knockout" ? 3000 : 8000,
      );
      return () => window.clearInterval(id);
    }
    return undefined;
  }, [data?.session.kind, data?.session.rules.perItem, index, sessionId]);

  if (isPending) return <PageLoader label="Loading challenge…" />;
  if (error || !data) {
    return (
      <p className="text-sm text-muted-foreground">
        {error instanceof Error ? error.message : "Session unavailable."}
      </p>
    );
  }

  if (data.session.status !== "in_progress") {
    goResult();
    return <PageLoader />;
  }

  const question = data.questions[index];
  const perItem = data.session.rules.perItem;
  const meta = PLAY_KIND_META[data.session.kind];
  const sessionRules = data.session.rules;
  const isSurvival = data.session.kind === "survival";
  const isRapid = data.session.kind === "rapid";
  const isSpeed = data.session.kind === "speed";
  const maxLives = sessionRules.lives ?? 3;
  const speedDuration = Math.max(1, sessionRules.durationSeconds ?? remaining ?? 300);
  const waitingForOpponent = Boolean(battleLive?.waitingForOpponent);
  const showBattleQuestions = !isDualMatch || Boolean(battleLive?.canAnswer);
  const dualTitle = data.session.kind === "knockout" ? "Knockout 1v1" : "Battle";

  async function submitItem() {
    if (!question) return;
    const result = await grade({
      data: { sessionId, questionId: question.id, answer: answers[question.id] ?? null },
    });
    if ("finished" in result && result.finished) {
      goResult();
      return;
    }
    const correct = result.correct;
    if (correct) setStreak((s) => s + 1);
    else {
      setStreak(0);
      if (isSurvival) {
        setShake(true);
        window.setTimeout(() => setShake(false), 450);
      }
    }
    setFeedback({
      correct,
      explanation: "explanation" in result ? result.explanation : "",
    });
    if (isSurvival) {
      setSurvivalBeat(correct ? "hit" : "life");
      void refetch();
      return;
    }
    window.setTimeout(() => {
      setFeedback(null);
      if ("nextIndex" in result) setIndex(result.nextIndex);
      setItemRemaining(sessionRules.perQuestionSeconds ?? null);
      void refetch();
    }, 900);
  }

  function continueSurvival() {
    setSurvivalBeat(null);
    setFeedback(null);
    setIndex(data?.session.currentIndex ?? index + 1);
    setItemRemaining(sessionRules.perQuestionSeconds ?? null);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {battleLive ? (
        <BattleHud
          me={battleLive.me}
          opponent={battleLive.opponent}
          waitingForOpponent={waitingForOpponent}
          winnerId={battleLive.winnerId}
          winnerName={battleLive.winnerName}
          myUserId={battleLive.me.userId}
          title={dualTitle}
        />
      ) : null}

      {waitingForOpponent ? (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-5 py-10 text-center">
          <p className="font-medium">You are in the battle lobby</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Questions unlock when your opponent also presses Play. Same paper for both of you.
          </p>
        </div>
      ) : null}

      {showBattleQuestions ? (
        <>
          {isSurvival && data.session.livesLeft != null ? (
            <SurvivalHud
              livesLeft={data.session.livesLeft}
              maxLives={maxLives}
              streak={streak}
              index={index}
              remaining={remaining}
              itemRemaining={itemRemaining}
              shake={shake}
            />
          ) : isRapid ? (
            <RapidHud
              index={index}
              total={data.questions.length}
              itemRemaining={itemRemaining}
              streak={streak}
            />
          ) : isSpeed && remaining != null ? (
            <SpeedHud
              remaining={remaining}
              durationSeconds={speedDuration}
              index={index}
              total={data.questions.length}
              alert={speedAlert}
            />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <div>
                <p className="font-semibold">{meta.label}</p>
                {data.session.topic ? (
                  <p className="text-xs text-muted-foreground">{data.session.topic}</p>
                ) : null}
              </div>
              <div className="flex gap-3 tabular-nums text-muted-foreground">
                {data.session.livesLeft != null ? (
                  <span>{data.session.livesLeft} lives</span>
                ) : null}
                {remaining != null ? <span>{formatClock(remaining)}</span> : null}
                {itemRemaining != null ? <span>{itemRemaining}s</span> : null}
              </div>
            </div>
          )}

          {!isSurvival && !isRapid && !isSpeed ? (
            <>
              <p className="text-xs text-muted-foreground">
                {index + 1} / {data.questions.length}
              </p>
              <div className="h-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${((index + 1) / Math.max(1, data.questions.length)) * 100}%` }}
                />
              </div>
            </>
          ) : null}

          {isSurvival && survivalBeat === "life" ? (
            <SurvivalLifeLostBanner
              livesLeft={data.session.livesLeft ?? 0}
              {...(feedback?.explanation ? { explanation: feedback.explanation } : {})}
              onContinue={continueSurvival}
            />
          ) : isSurvival && survivalBeat === "hit" ? (
            <SurvivalHitBanner streak={streak} onContinue={continueSurvival} />
          ) : question ? (
            <article
              className={cn(
                "surface-paper p-5 transition-colors",
                feedback &&
                  !feedback.correct &&
                  isSurvival &&
                  "border border-destructive/30 bg-destructive/5",
                feedback &&
                  feedback.correct &&
                  isSurvival &&
                  "border border-success/30 bg-success/5",
              )}
            >
              <QuestionPrompt
                prompt={question.prompt}
                imageUrl={question.imageUrl}
                className="mt-2"
                meta={
                  <p
                    className={cn(
                      "text-xs font-semibold",
                      question.multiSelect ? "text-accent" : "text-muted-foreground",
                    )}
                  >
                    {question.multiSelect ? "Select all that apply" : "Choose one"}
                  </p>
                }
              />
              <PlayOptions
                options={question.options}
                multiSelect={question.multiSelect}
                value={answers[question.id]}
                disabled={Boolean(feedback)}
                onChange={(next) => setAnswers((prev) => ({ ...prev, [question.id]: next }))}
              />
              {feedback ? (
                <div
                  className={cn(
                    "mt-4 rounded-lg px-3 py-2 text-sm",
                    feedback.correct
                      ? "bg-success/10 text-success"
                      : "bg-destructive/10 text-destructive",
                  )}
                >
                  {feedback.correct ? "Correct!" : isSurvival ? "Life lost" : "Not quite"}
                  {feedback.explanation ? ` — ${feedback.explanation}` : ""}
                </div>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-2">
                {perItem ? (
                  <button
                    type="button"
                    onClick={() => void submitItem()}
                    className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                  >
                    Lock in
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => setIndex((i) => Math.max(0, i - 1))}
                      className="rounded-md border border-border px-3 py-2 text-sm"
                    >
                      Previous
                    </button>
                    {index < data.questions.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => {
                          const next = index + 1;
                          setIndex(next);
                          if (data.session.kind === "battle" || data.session.kind === "knockout") {
                            void save({
                              data: { sessionId, answers: answersRef.current, currentIndex: next },
                            });
                          }
                        }}
                        className="rounded-md border border-border px-3 py-2 text-sm"
                      >
                        Next
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => finishMut.mutate()}
                        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                      >
                        Submit
                      </button>
                    )}
                    {data.session.kind === "marathon" ? (
                      <button
                        type="button"
                        onClick={() => {
                          void save({ data: { sessionId, answers, currentIndex: index } });
                          toast.success("Progress saved — resume anytime from Play.");
                          void navigate({ to: "/play" });
                        }}
                        className="rounded-md border border-border px-3 py-2 text-sm"
                      >
                        Save and leave
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </article>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function formatClock(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
