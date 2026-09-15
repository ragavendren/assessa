import type { PulseSlideInput } from "@/lib/play.pulse";
import { cn } from "@/lib/utils";

const TYPE_HINT: Record<PulseSlideInput["type"], string> = {
  mcq: "Single choice",
  multi: "Select all that apply",
  text: "Open text",
  rating: "Rating",
  matrix: "Matrix grid",
  section: "Section",
};

/**
 * Read-only participant UI mock — same controls as the live answer screen.
 */
export function PulseSlidePreview({
  slide,
  index,
  total,
  className,
}: {
  slide: PulseSlideInput;
  index: number;
  total: number;
  className?: string;
}) {
  const options = (slide.options ?? []).map((o) => o.trim()).filter(Boolean);
  const ratingMax = slide.ratingMax ?? (slide.type === "rating" ? 10 : 5);
  const prompt = slide.prompt.trim() || "Question prompt…";
  const hasOther = options.some((o) => /^other\b/i.test(o));

  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-teal-600/30 bg-gradient-to-br from-secondary/40 via-background to-teal-500/5 p-3",
        className,
      )}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-300">
          Participant preview
        </p>
        <p className="text-[10px] text-muted-foreground">
          Slide {index + 1}/{total} · {TYPE_HINT[slide.type]}
        </p>
      </div>

      <div
        className="pointer-events-none select-none space-y-3 rounded-2xl border border-border bg-card p-3 shadow-sm"
        aria-hidden
      >
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Slide {index + 1} · {slide.type}
        </p>
        <p className="text-sm font-semibold leading-snug">{prompt}</p>
        {slide.imageUrl?.trim() ? (
          <img
            src={slide.imageUrl.trim()}
            alt=""
            className="max-h-36 w-full rounded-xl object-cover"
          />
        ) : null}

        {slide.type === "section" ? (
          <span className="inline-flex rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
            Continue
          </span>
        ) : null}

        {slide.type === "mcq" ? (
          options.length ? (
            <ul className="space-y-1.5">
              {options.map((opt, i) => (
                <li
                  key={`${opt}-${i}`}
                  className="rounded-xl border border-border px-3 py-2 text-left text-xs"
                >
                  {opt}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-amber-700 dark:text-amber-300">Add at least two options.</p>
          )
        ) : null}

        {slide.type === "multi" ? (
          options.length ? (
            <div className="space-y-2">
              <ul className="space-y-1.5">
                {options.map((opt, i) => (
                  <li
                    key={`${opt}-${i}`}
                    className="flex items-start gap-2 rounded-xl border border-border px-3 py-2 text-xs"
                  >
                    <span className="mt-0.5 inline-block h-3.5 w-3.5 shrink-0 rounded border border-border" />
                    <span>{opt}</span>
                  </li>
                ))}
              </ul>
              {hasOther ? (
                <div className="h-8 rounded-md border border-dashed border-border bg-secondary/30 px-2 text-[10px] leading-8 text-muted-foreground">
                  Please specify…
                </div>
              ) : null}
              <span className="inline-flex rounded-md bg-primary px-2.5 py-1 text-[10px] font-medium text-primary-foreground">
                Submit selections
              </span>
            </div>
          ) : (
            <p className="text-xs text-amber-700 dark:text-amber-300">Add at least two options.</p>
          )
        ) : null}

        {slide.type === "rating" ? (
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: ratingMax }, (_, i) => i + 1).map((n) => (
              <span
                key={n}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-xs font-semibold"
              >
                {n}
              </span>
            ))}
          </div>
        ) : null}

        {slide.type === "matrix" ? (
          options.length ? (
            <div className="space-y-3">
              {options.map((row, rowIndex) => (
                <div key={`${row}-${rowIndex}`}>
                  <p className="mb-1.5 text-xs font-medium">{row}</p>
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: ratingMax }, (_, i) => i + 1).map((n) => (
                      <span
                        key={n}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-[10px] font-semibold"
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <span className="inline-flex rounded-md bg-primary px-2.5 py-1 text-[10px] font-medium text-primary-foreground">
                Submit ratings
              </span>
            </div>
          ) : (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Add at least two matrix rows.
            </p>
          )
        ) : null}

        {slide.type === "text" ? (
          <div className="space-y-2">
            <div className="min-h-[3.5rem] rounded-md border border-border bg-secondary/20 px-2 py-2 text-[10px] text-muted-foreground">
              Type your response…
            </div>
            <span className="inline-flex rounded-md bg-primary px-2.5 py-1 text-[10px] font-medium text-primary-foreground">
              Submit
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
