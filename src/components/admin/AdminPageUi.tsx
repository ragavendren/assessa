import { HelpTip } from "@/components/admin/pool/QuestionBankUi";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function AdminPageHeader({
  eyebrow,
  title,
  summary,
  help,
  action,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  help?: { label: string; body: ReactNode };
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex w-full min-w-0 flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 max-w-2xl">
        <p className="text-hairline text-muted-foreground">{eyebrow}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          {help ? <HelpTip label={help.label}>{help.body}</HelpTip> : null}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{summary}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function AdminPanel({
  title,
  description,
  help,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  help?: { label: string; body: ReactNode };
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface-paper flex min-w-0 flex-col p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {help ? <HelpTip label={help.label}>{help.body}</HelpTip> : null}
          </div>
          {description ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

export function StatusPill({
  tone = "neutral",
  children,
}: {
  tone?: "live" | "draft" | "admin" | "neutral" | "danger" | "success";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        tone === "live" && "bg-success/15 text-success",
        tone === "success" && "bg-success/15 text-success",
        tone === "draft" && "bg-secondary text-muted-foreground",
        tone === "admin" && "bg-primary/10 text-foreground",
        tone === "neutral" && "bg-secondary text-muted-foreground",
        tone === "danger" && "bg-destructive/12 text-destructive",
      )}
    >
      {children}
    </span>
  );
}

export function ResultCount({
  shown,
  total,
  noun,
}: {
  shown: number;
  total: number;
  noun: string;
}) {
  return (
    <p className="text-xs text-muted-foreground">
      Showing <span className="font-medium text-foreground tabular-nums">{shown}</span> of{" "}
      <span className="font-medium text-foreground tabular-nums">{total}</span> {noun}
    </p>
  );
}

export function AdminAccessDenied() {
  return (
    <div className="surface-paper p-8 text-center">
      <p className="font-display text-xl">Administrator access required</p>
      <p className="mt-2 text-sm text-muted-foreground">
        This area is limited to platform administrators.
      </p>
    </div>
  );
}

export function AdminEmpty({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-secondary/20 px-3 py-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      {body ? <p className="mt-1 text-sm text-muted-foreground">{body}</p> : null}
    </div>
  );
}

export function RankMark({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
        rank === 1 && "bg-amber-500/20 text-amber-800 dark:text-amber-200",
        rank === 2 && "bg-slate-400/25 text-slate-700 dark:text-slate-200",
        rank === 3 && "bg-orange-500/20 text-orange-800 dark:text-orange-200",
        rank > 3 && "bg-secondary text-muted-foreground",
      )}
    >
      {rank}
    </span>
  );
}
