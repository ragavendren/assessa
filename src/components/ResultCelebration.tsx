import { cn } from "@/lib/utils";

/** Full-screen overlay while an assessment is being scored. */
export function SubmitScoringOverlay({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-background/85 p-6 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="animate-brand-rise surface-paper w-full max-w-sm p-8 text-center shadow-lg">
        <div className="relative mx-auto mb-6 h-24 w-24">
          <div className="absolute inset-0 rounded-full border-4 border-accent/20" />
          <div className="absolute inset-0 animate-scoring-spin rounded-full border-4 border-transparent border-t-accent" />
          <div className="absolute inset-3 animate-scoring-pulse rounded-full bg-accent/15" />
          <span className="absolute inset-0 flex items-center justify-center text-3xl" aria-hidden>
            📝
          </span>
        </div>
        <p className="font-display text-2xl">Scoring your attempt</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Checking answers, tallying XP, and unlocking any new badges…
        </p>
        <div className="mx-auto mt-5 flex max-w-[12rem] justify-center gap-1.5">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="h-2 w-2 animate-scoring-dot rounded-full bg-accent"
              style={{ animationDelay: `${dot * 160}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

type ResultCelebrationProps = {
  passed: boolean;
  score: number;
  title?: string;
};

/** Gamified success / encouragement visual for the results reveal. */
export function ResultCelebration({ passed, score, title }: ResultCelebrationProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-lg)] border p-6 text-center md:p-8",
        passed
          ? "border-success/30 bg-[color-mix(in_oklab,var(--color-paper)_88%,var(--color-success)_12%)]"
          : "border-destructive/25 bg-[color-mix(in_oklab,var(--color-paper)_90%,var(--color-destructive)_10%)]",
      )}
    >
      {passed ? <ConfettiBurst /> : null}

      <div className="relative z-10 mx-auto mb-4 flex h-36 w-36 items-center justify-center md:h-44 md:w-44">
        {passed ? <SuccessIllustration /> : <EncourageIllustration />}
      </div>

      <p className="relative z-10 text-hairline text-muted-foreground">
        {title ?? "Assessment result"}
      </p>
      <p
        className={cn(
          "relative z-10 mt-2 animate-result-score font-display text-6xl md:text-7xl",
          passed ? "text-success" : "text-destructive",
        )}
      >
        {score}%
      </p>
      <p className="relative z-10 mt-3 font-display text-2xl">
        {passed ? "Well done — you passed!" : "Not this time — keep going"}
      </p>
      <p className="relative z-10 mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {passed
          ? "Great work. Review your answers, claim your XP, and climb the leaderboard."
          : "Every attempt builds mastery. Review the feedback, retake when ready, and unlock the next badge."}
      </p>
    </div>
  );
}

function ConfettiBurst() {
  const pieces = Array.from({ length: 18 }, (_, i) => i);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((i) => (
        <span
          key={i}
          className="absolute top-0 h-2 w-2 animate-confetti-fall rounded-sm"
          style={{
            left: `${6 + ((i * 17) % 88)}%`,
            animationDelay: `${(i % 9) * 0.08}s`,
            background:
              i % 3 === 0
                ? "var(--color-accent)"
                : i % 3 === 1
                  ? "var(--color-success)"
                  : "var(--color-primary)",
            transform: `rotate(${i * 24}deg)`,
          }}
        />
      ))}
    </div>
  );
}

function SuccessIllustration() {
  return (
    <svg viewBox="0 0 160 160" className="h-full w-full animate-result-float" aria-hidden>
      <circle cx="80" cy="80" r="64" className="fill-success/15" />
      <circle
        cx="80"
        cy="80"
        r="48"
        className="animate-result-ring fill-none stroke-success/40"
        strokeWidth="4"
      />
      <path
        d="M52 82 L72 102 L112 58"
        className="animate-result-check fill-none stroke-success"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="34" cy="42" r="5" className="animate-result-spark fill-accent" />
      <circle
        cx="128"
        cy="48"
        r="4"
        className="animate-result-spark fill-success"
        style={{ animationDelay: "0.2s" }}
      />
      <circle
        cx="122"
        cy="116"
        r="6"
        className="animate-result-spark fill-accent"
        style={{ animationDelay: "0.35s" }}
      />
      <text x="80" y="148" textAnchor="middle" className="fill-success text-[18px] font-bold">
        ★
      </text>
    </svg>
  );
}

function EncourageIllustration() {
  return (
    <svg viewBox="0 0 160 160" className="h-full w-full animate-result-float" aria-hidden>
      <circle cx="80" cy="80" r="64" className="fill-destructive/10" />
      <circle cx="80" cy="80" r="48" className="fill-none stroke-destructive/35" strokeWidth="4" />
      <circle cx="62" cy="72" r="5" className="fill-foreground/70" />
      <circle cx="98" cy="72" r="5" className="fill-foreground/70" />
      <path
        d="M58 104 Q80 90 102 104"
        className="fill-none stroke-foreground/60"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M118 42 L132 28 M132 42 L118 28"
        className="animate-result-retry fill-none stroke-accent"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <text x="80" y="148" textAnchor="middle" className="fill-accent text-[16px] font-semibold">
        Try again
      </text>
    </svg>
  );
}
