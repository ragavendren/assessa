import { Heart, Sparkles, Trophy, Zap } from "lucide-react";
import type { ReactNode } from "react";

export function SurvivalOutcomeHero({
  survived,
  reached,
  correctCount,
  livesLeft,
  score,
}: {
  survived: boolean;
  reached: number;
  correctCount: number;
  livesLeft: number | null;
  score: number;
}) {
  if (survived) {
    return (
      <header className="survival-hero survival-hero-win overflow-hidden rounded-2xl p-8 text-center">
        <div className="survival-burst" aria-hidden />
        <Sparkles className="survival-pop mx-auto h-10 w-10 text-amber-500" />
        <p className="survival-rise mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">
          You survived
        </p>
        <h1
          className="survival-rise mt-2 font-display text-3xl md:text-4xl"
          style={{ animationDelay: "80ms" }}
        >
          Unstoppable
        </h1>
        <p
          className="survival-rise mx-auto mt-2 max-w-md text-sm text-muted-foreground"
          style={{ animationDelay: "140ms" }}
        >
          You cleared the run with lives to spare. That streak is yours — keep it going.
        </p>
        <dl
          className="survival-rise mt-6 grid grid-cols-3 gap-3 text-sm"
          style={{ animationDelay: "200ms" }}
        >
          <Stat label="Score" value={String(score)} />
          <Stat label="Cleared" value={String(reached)} />
          <Stat
            label="Lives"
            value={livesLeft != null ? String(livesLeft) : "—"}
            icon={<Heart className="h-3.5 w-3.5 fill-destructive text-destructive" />}
          />
        </dl>
      </header>
    );
  }

  return (
    <header className="survival-hero survival-hero-lose overflow-hidden rounded-2xl p-8 text-center">
      <div className="survival-ember" aria-hidden />
      <Zap className="survival-pop mx-auto h-10 w-10 text-destructive" />
      <p className="survival-rise mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-destructive">
        Out of lives
      </p>
      <h1
        className="survival-rise mt-2 font-display text-3xl md:text-4xl"
        style={{ animationDelay: "80ms" }}
      >
        You made it {reached} deep
      </h1>
      <p
        className="survival-rise mx-auto mt-2 max-w-md text-sm text-muted-foreground"
        style={{ animationDelay: "140ms" }}
      >
        {encouragement(reached, correctCount)} The questions below are only the ones you faced —
        study them, then go again.
      </p>
      <dl
        className="survival-rise mt-6 grid grid-cols-3 gap-3 text-sm"
        style={{ animationDelay: "200ms" }}
      >
        <Stat label="Score" value={String(score)} />
        <Stat label="Attempted" value={String(reached)} />
        <Stat label="Correct" value={String(correctCount)} />
      </dl>
    </header>
  );
}

export function SurvivalLifeLostBanner({
  livesLeft,
  explanation,
  onContinue,
}: {
  livesLeft: number;
  explanation?: string;
  onContinue: () => void;
}) {
  return (
    <div className="survival-hero survival-hero-lose rounded-xl p-5 text-center">
      <Heart className="survival-pop mx-auto h-8 w-8 fill-destructive text-destructive" />
      <p className="mt-2 text-sm font-semibold text-destructive">Life used</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {livesLeft === 1
          ? "Last life — make it count."
          : `${livesLeft} ${livesLeft === 1 ? "life" : "lives"} left. Shake it off and keep climbing.`}
      </p>
      {explanation ? <p className="mt-2 text-xs text-muted-foreground">{explanation}</p> : null}
      <button
        type="button"
        onClick={onContinue}
        className="mt-4 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
      >
        Continue
      </button>
    </div>
  );
}

export function SurvivalHitBanner({
  streak,
  onContinue,
}: {
  streak: number;
  onContinue: () => void;
}) {
  return (
    <div className="survival-hero survival-hero-win rounded-xl p-5 text-center">
      <Trophy className="survival-pop mx-auto h-8 w-8 text-amber-500" />
      <p className="mt-2 text-sm font-semibold text-amber-800">Clean hit</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {streak > 1 ? `${streak} in a row. You’re in rhythm.` : "Yes. Stack another one."}
      </p>
      <button
        type="button"
        onClick={onContinue}
        className="mt-4 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
      >
        Next question
      </button>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="rounded-lg bg-background/70 px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 inline-flex items-center justify-center gap-1 text-lg font-semibold tabular-nums">
        {icon}
        {value}
      </dd>
    </div>
  );
}

function encouragement(reached: number, correct: number) {
  if (reached >= 20) return "That’s a serious run.";
  if (reached >= 10) return "Solid depth — you’re learning the pattern.";
  if (correct >= 3) return "You already have the instincts.";
  return "First lives go fast. The next run will be cleaner.";
}

export function survivalSurvived(status: string, livesLeft: number | null) {
  return status !== "game_over" && (livesLeft == null || livesLeft > 0);
}
