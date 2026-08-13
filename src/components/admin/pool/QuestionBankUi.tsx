import { cn } from "@/lib/utils";
import { CircleHelp } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

type HelpTipProps = {
  label: string;
  children: ReactNode;
  className?: string;
  side?: "left" | "right";
};

/** Accessible inline help control — click/focus to reveal guidance. */
export function HelpTip({ label, children, className, side = "right" }: HelpTipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={rootRef} className={cn("relative inline-flex align-middle", className)}>
      <button
        type="button"
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors",
          "hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open && "bg-secondary text-foreground",
        )}
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        <CircleHelp className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open ? (
        <span
          id={id}
          role="note"
          className={cn(
            "absolute z-30 mt-1 w-72 max-w-[calc(100vw-2.5rem)] rounded-md border border-border bg-card p-3 text-left text-xs leading-relaxed text-muted-foreground shadow-md",
            "top-full",
            side === "right" ? "right-0" : "left-0",
          )}
        >
          <span className="mb-1 block font-medium text-foreground">{label}</span>
          {children}
        </span>
      ) : null}
    </span>
  );
}

export function FieldLabel({
  children,
  help,
  htmlFor,
}: {
  children: ReactNode;
  help?: { label: string; body: ReactNode };
  htmlFor?: string;
}) {
  return (
    <span className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
      <label htmlFor={htmlFor} className="cursor-pointer">
        {children}
      </label>
      {help ? <HelpTip label={help.label}>{help.body}</HelpTip> : null}
    </span>
  );
}

export function QuestionBankPageHeader({
  title,
  summary,
  help,
  action,
}: {
  title: string;
  summary?: string;
  help?: { label: string; body: ReactNode };
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex w-full min-w-0 flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 max-w-2xl">
        <p className="text-hairline text-muted-foreground">Question bank</p>
        <div className="mt-0.5 flex items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {help ? <HelpTip label={help.label}>{help.body}</HelpTip> : null}
        </div>
        {summary ? (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{summary}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function QuestionBankWorkflow({
  steps,
  current,
}: {
  steps: Array<{ label: string; hint: string }>;
  current: number;
}) {
  return (
    <ol className="mb-4 flex flex-wrap gap-1.5">
      {steps.map((step, index) => {
        const active = index === current;
        const done = index < current;
        return (
          <li
            key={step.label}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs",
              active
                ? "border-primary/40 bg-primary/5 font-semibold"
                : done
                  ? "border-border bg-secondary/40 text-muted-foreground"
                  : "border-border bg-card text-muted-foreground",
            )}
            title={step.hint}
          >
            <span className="tabular-nums text-[10px] uppercase tracking-wide opacity-70">
              {index + 1}.
            </span>{" "}
            {step.label}
          </li>
        );
      })}
    </ol>
  );
}

export function Panel({
  title,
  description,
  help,
  children,
  className,
  action,
}: {
  title: string;
  description?: string;
  help?: { label: string; body: ReactNode };
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={cn("surface-paper flex flex-col p-4", className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {help ? <HelpTip label={help.label}>{help.body}</HelpTip> : null}
          </div>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

export const QUESTION_BANK_STEPS = [
  { label: "Courses", hint: "Container for pools & blueprints" },
  { label: "Pools", hint: "Import reusable question bank" },
  { label: "Blueprints", hint: "Topic weightage & difficulty mix" },
  { label: "Series", hint: "Optional reuse policy grouping" },
] as const;
