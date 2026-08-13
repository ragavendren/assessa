import type { Shortage } from "@/lib/question-selection.math";
import { Link } from "@tanstack/react-router";

type Props = {
  shortages: Shortage[];
  poolId: string | null;
  onAllowPreviouslyUsed: () => void;
  onCancel: () => void;
};

export function QuestionAvailability({
  shortages,
  poolId,
  onAllowPreviouslyUsed,
  onCancel,
}: Props) {
  if (shortages.length === 0) return null;
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
      <p className="text-sm font-medium text-destructive">Not enough eligible questions</p>
      <p className="mt-1 text-xs text-muted-foreground">
        The pool cannot fill this blueprint without underfilling. Add questions or relax reuse.
      </p>
      <ul className="mt-3 space-y-1 text-sm">
        {shortages.map((s, i) => (
          <li key={`${s.topic}-${s.difficulty}-${i}`} className="tabular-nums">
            <span className="font-medium">{s.topic}</span>
            {s.subtopic ? ` · ${s.subtopic}` : ""} · {s.difficulty}: need {s.required}, have{" "}
            {s.available} (short {s.shortage})
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onAllowPreviouslyUsed}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Allow previously used
        </button>
        {poolId ? (
          <Link
            to="/admin/pools"
            search={{ poolId }}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
          >
            Add pool questions
          </Link>
        ) : null}
      </div>
    </div>
  );
}
