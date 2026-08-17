import { PlayOptions } from "@/components/play/PlayOptions";
import { BonusRewards } from "@/components/play/BonusRewards";
import { SurvivalOutcomeHero, survivalSurvived } from "@/components/play/SurvivalOutcome";
import { MasteryBar, PageLoader } from "@/components/platform";
import { formatDuration } from "@/lib/gamification";
import { beginPlay, claimPlayReward, getPlayResult } from "@/lib/play.functions";
import { PLAY_KIND_META, type RewardCode } from "@/lib/play.math";
import { cn } from "@/lib/utils";
import { flyXpOnce } from "@/lib/xp-fly";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/play/results/$sessionId")({
  head: () => ({
    meta: [{ title: "Challenge result — Assessa" }],
  }),
  component: PlayResultPage,
});

function PlayResultPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const fetchResult = useServerFn(getPlayResult);
  const claim = useServerFn(claimPlayReward);
  const start = useServerFn(beginPlay);
  const { data, isPending, error } = useQuery({
    queryKey: ["play-result", sessionId],
    queryFn: () => fetchResult({ data: { sessionId } }),
  });
  const xpOriginRef = useRef<HTMLParagraphElement>(null);
  const claimMut = useMutation({
    mutationFn: (source: "box" | "wheel") => claim({ data: { sessionId, source } }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Already claimed"),
  });
  const replayMut = useMutation({
    mutationFn: () => start({ data: { kind: "survival" } }),
    onSuccess: (result) =>
      navigate({ to: "/play/session/$sessionId", params: { sessionId: result.sessionId } }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not restart"),
  });

  useEffect(() => {
    if (!data?.xp) return;
    const id = window.setTimeout(
      () => flyXpOnce(`play:${sessionId}`, data.xp, xpOriginRef.current),
      280,
    );
    return () => window.clearTimeout(id);
  }, [data?.xp, sessionId]);

  if (isPending) return <PageLoader label="Loading result…" />;
  if (error || !data) {
    return (
      <p className="text-sm text-muted-foreground">
        {error instanceof Error ? error.message : "Result unavailable."}
      </p>
    );
  }

  const meta = PLAY_KIND_META[data.kind];
  const isSurvival = data.kind === "survival";
  const survived = survivalSurvived(data.status, data.livesLeft);
  const pct = data.questionCount ? Math.round((data.correctCount / data.questionCount) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {isSurvival ? (
        <SurvivalOutcomeHero
          survived={survived}
          reached={data.questionCount}
          correctCount={data.correctCount}
          livesLeft={data.livesLeft}
          score={data.score}
        />
      ) : (
        <header className="surface-paper p-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{meta.label}</p>
          <h1 className="mt-1 font-display text-3xl tabular-nums">{data.score}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.correctCount}/{data.questionCount} correct ({pct}%)
            {data.timeBonus ? ` · +${data.timeBonus} time bonus` : ""}
            {data.dailyStreak ? ` · ${data.dailyStreak} day streak` : ""}
            {data.weeklyRank ? ` · weekly rank #${data.weeklyRank}` : ""}
          </p>
          <p ref={xpOriginRef} className="mt-2 text-sm">
            +{data.xp} XP · {formatDuration(data.durationSeconds)}
          </p>
          {data.badges.length > 0 ? (
            <p className="mt-2 text-sm">Badges: {data.badges.map((b) => b.name).join(", ")}</p>
          ) : null}
        </header>
      )}

      {isSurvival ? (
        <p ref={xpOriginRef} className="text-center text-sm text-muted-foreground">
          +{data.xp} XP · {formatDuration(data.durationSeconds)}
          {data.badges.length > 0 ? ` · ${data.badges.map((b) => b.name).join(", ")}` : ""}
        </p>
      ) : null}

      {data.domains.length > 0 ? (
        <section className="surface-paper space-y-3 p-5">
          <h2 className="text-sm font-semibold">Career readiness</h2>
          {data.domains.map((domain) => (
            <MasteryBar key={domain.topic} label={domain.topic} value={domain.mastery} />
          ))}
        </section>
      ) : null}

      {data.rewardEligible ? (
        <BonusRewards
          claiming={claimMut.isPending}
          onClaim={async (source) => {
            const row = await claimMut.mutateAsync(source);
            return { code: row.code as RewardCode, label: row.label };
          }}
        />
      ) : null}

      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">{isSurvival ? "Questions you faced" : "Review"}</h2>
          <p className="text-xs text-muted-foreground">
            {data.correctCount} correct · {data.questionCount} attempted
          </p>
        </div>
        {data.review.map((item, i) => (
          <details
            key={item.id}
            className="surface-paper p-4"
            open={isSurvival && !item.correct && i === data.review.length - 1}
          >
            <summary
              className={cn(
                "cursor-pointer text-sm font-medium",
                item.correct ? "text-success" : "text-destructive",
              )}
            >
              {i + 1}. {item.prompt}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {item.correct ? "Correct" : "Missed"}
              </span>
            </summary>
            <PlayOptions
              options={item.options}
              multiSelect={item.multiSelect}
              value={item.givenIndexes}
              onChange={() => undefined}
              disabled
              reveal
              correctIndexes={item.correctIndexes}
            />
            {item.explanation ? (
              <p className="mt-2 text-xs text-muted-foreground">{item.explanation}</p>
            ) : null}
          </details>
        ))}
      </section>

      <div className="flex flex-wrap gap-3">
        {isSurvival ? (
          <button
            type="button"
            disabled={replayMut.isPending}
            onClick={() => replayMut.mutate()}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            {survived ? "Run it back" : "Try again"}
          </button>
        ) : null}
        <Link
          to="/play"
          className="inline-flex items-center rounded-md border border-border px-3 py-2 text-sm"
        >
          Back to Play
        </Link>
      </div>
    </div>
  );
}
