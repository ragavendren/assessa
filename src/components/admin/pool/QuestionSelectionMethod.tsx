type Method = "upload" | "question_pool";

type Props = {
  value: Method;
  onChange: (value: Method) => void;
  disabled?: boolean;
};

export function QuestionSelectionMethod({ value, onChange, disabled }: Props) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-foreground">Question selection method</legend>
      <p className="text-xs text-muted-foreground">
        Upload/Manual keeps the existing CSV and builder. Question Pool uses a course blueprint to
        generate a paper from a bank.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {(
          [
            {
              id: "upload" as const,
              title: "Upload / Manual",
              body: "CSV import or build questions in the editor (default).",
            },
            {
              id: "question_pool" as const,
              title: "Question Pool / Blueprint",
              body: "Pick course, pool, and blueprint; generate a balanced paper.",
            },
          ] as const
        ).map((option) => (
          <label
            key={option.id}
            className={
              "flex cursor-pointer flex-col gap-1 rounded-md border px-3 py-3 text-sm transition-colors " +
              (value === option.id
                ? "border-primary bg-accent/10"
                : "border-border bg-card hover:bg-secondary/50") +
              (disabled ? " opacity-60" : "")
            }
          >
            <span className="flex items-center gap-2 font-medium">
              <input
                type="radio"
                name="question_selection_method"
                className="accent-primary"
                checked={value === option.id}
                disabled={disabled}
                onChange={() => onChange(option.id)}
              />
              {option.title}
            </span>
            <span className="pl-6 text-xs text-muted-foreground">{option.body}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
