import { PageLoader, ScorePill } from "@/components/platform";
import { formatDuration } from "@/lib/gamification";
import { getResult } from "@/lib/platform.functions";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/results/$attemptId")({
  head: () => ({
    meta: [
      { title: "Your result — Assessa" },
      {
        name: "description",
        content:
          "Score, pass status, XP earned, badges unlocked and answer review for your attempt.",
      },
      { property: "og:title", content: "Your result — Assessa" },
      {
        property: "og:description",
        content: "Your assessment score, XP and badges.",
      },
    ],
  }),
  component: ResultPage,
});

function ResultPage() {
  const { attemptId } = Route.useParams();
  const fetchResult = useServerFn(getResult);
  const { data, isPending, error } = useQuery({
    queryKey: ["result", attemptId],
    queryFn: () => fetchResult({ data: { attemptId } }),
    retry: false,
  });

  if (isPending) return <PageLoader />;
  if (error || !data) {
    return (
      <div className="surface-paper p-8 text-center">
        <p className="font-display text-xl">Result unavailable</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "This result could not be loaded."}
        </p>
      </div>
    );
  }

  const { attempt, exam } = data;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="surface-paper p-7 text-center">
        <p className="text-hairline text-muted-foreground">{exam.title}</p>
        <p
          className={cn(
            "mt-3 font-display text-6xl",
            attempt.passed ? "text-success" : "text-destructive",
          )}
        >
          {attempt.score}%
        </p>
        <p className="mt-2">
          <ScorePill score={attempt.score} passed={attempt.passed} />
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          {attempt.correctCount} of {attempt.total} correct · pass mark {exam.passMark}% ·{" "}
          {formatDuration(attempt.durationSeconds)}
          {data.rank ? ` · rank #${data.rank.rank} of ${data.rank.total}` : ""}
        </p>
      </div>

      {data.gains.length > 0 ? (
        <div className="surface-paper p-5">
          <p className="text-hairline text-muted-foreground">XP earned</p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {data.gains.map((gain) => (
              <li key={gain.label} className="flex justify-between">
                <span>{gain.label}</span>
                <span className="font-semibold text-accent">+{gain.points} XP</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Level {data.level.level} · {data.level.name} ·{" "}
            {data.level.nextLevel
              ? `${data.level.xpToNext} XP to Level ${data.level.nextLevel}`
              : "Max level"}
          </p>
        </div>
      ) : null}

      {data.newBadges.length > 0 ? (
        <div className="surface-paper p-5">
          <p className="text-hairline text-muted-foreground">New badges unlocked</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {data.newBadges.map((badge) => (
              <div key={badge.code} className="flex items-start gap-3 rounded-md bg-secondary p-3">
                <span className="text-2xl">{badge.icon}</span>
                <div>
                  <p className="font-medium">{badge.name}</p>
                  <p className="text-xs text-muted-foreground">{badge.description}</p>
                  <p className="mt-1 text-xs font-semibold text-accent">+{badge.xp} XP</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {data.review.length > 0 ? (
        <div className="space-y-3">
          <p className="text-hairline text-muted-foreground">Answer review</p>
          {data.review.map((item, index) => (
            <article key={item.id} className="surface-paper p-5">
              <p className="text-xs text-muted-foreground">
                Question {index + 1} · {item.subtopic}
              </p>
              <h3 className="mt-1.5 font-medium">{item.prompt}</h3>
              <ul className="mt-3 space-y-1.5 text-sm">
                {item.options.map((option, optionIndex) => {
                  const correct = optionIndex === item.correctIndex;
                  const given = optionIndex === item.givenIndex;
                  return (
                    <li
                      key={optionIndex}
                      className={cn(
                        "rounded-md border p-2.5",
                        correct
                          ? "border-success/40 bg-success/10"
                          : given
                            ? "border-destructive/40 bg-destructive/10"
                            : "border-border",
                      )}
                    >
                      {option}
                      {correct ? <span className="ml-2 text-xs text-success">correct</span> : null}
                      {given && !correct ? (
                        <span className="ml-2 text-xs text-destructive">your answer</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {item.explanation ? (
                <p className="mt-3 text-sm text-muted-foreground">{item.explanation}</p>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Answer review is disabled for this assessment mode.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          to="/exams"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Back to my exams
        </Link>
        {exam.enableLeaderboard ? (
          <Link
            to="/leaderboard"
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-secondary"
          >
            View leaderboard
          </Link>
        ) : null}
      </div>
    </div>
  );
}
