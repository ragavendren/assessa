import { cn } from "@/lib/utils";

export function isOptionSelected(value: number | number[] | undefined, optionIndex: number) {
  if (Array.isArray(value)) return value.includes(optionIndex);
  return value === optionIndex;
}

export function toggleAnswer(
  current: number | number[] | undefined,
  optionIndex: number,
  multiSelect: boolean,
) {
  if (!multiSelect) return optionIndex;
  const selected = Array.isArray(current) ? current : typeof current === "number" ? [current] : [];
  return selected.includes(optionIndex)
    ? selected.filter((value) => value !== optionIndex)
    : [...selected, optionIndex].sort((a, b) => a - b);
}

export function PlayOptions({
  options,
  multiSelect,
  value,
  onChange,
  disabled,
  reveal,
  correctIndexes,
}: {
  options: string[];
  multiSelect: boolean;
  value: number | number[] | undefined;
  onChange: (next: number | number[]) => void;
  disabled?: boolean;
  reveal?: boolean;
  correctIndexes?: number[];
}) {
  const correct = new Set(correctIndexes ?? []);
  return (
    <div className="mt-6 space-y-3" role={multiSelect ? "group" : "radiogroup"}>
      {options.map((option, optionIndex) => {
        const selected = isOptionSelected(value, optionIndex);
        const isCorrect = correct.has(optionIndex);
        return (
          <button
            key={optionIndex}
            type="button"
            disabled={disabled}
            role={multiSelect ? "checkbox" : "radio"}
            aria-checked={selected}
            onClick={() => onChange(toggleAnswer(value, optionIndex, multiSelect))}
            className={cn(
              "flex w-full min-h-12 items-start gap-3 rounded-xl border-2 px-4 py-3 text-left text-sm transition-colors disabled:opacity-70",
              reveal && isCorrect
                ? "border-success/50 bg-success/10"
                : selected
                  ? "border-accent bg-accent/12"
                  : "border-border bg-card hover:bg-secondary/40",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border-2 text-xs font-bold",
                multiSelect ? "rounded-md" : "rounded-full",
                selected ? "border-accent bg-accent text-accent-foreground" : "border-border",
              )}
            >
              {String.fromCharCode(65 + optionIndex)}
            </span>
            {option}
          </button>
        );
      })}
    </div>
  );
}
