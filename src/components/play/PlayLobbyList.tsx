import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export type PlayLobbyListItem = {
  id: string;
  title: string;
  meta: string;
  statusLabel: string;
  statusTone?: "live" | "lobby" | "done" | "neutral";
  to: string;
  params?: Record<string, string>;
  search?: Record<string, string | undefined>;
};

/** Shared joinable-event list for Live Arena, Escape, Knockout, etc. */
export function PlayLobbyList({
  title,
  blurb,
  backTo = "/play",
  backLabel = "Play",
  empty,
  items,
  headerAction,
}: {
  title: string;
  blurb: string;
  backTo?: string;
  backLabel?: string;
  empty: string;
  items: PlayLobbyListItem[];
  headerAction?: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <Link to={backTo as "/play"} className="text-xs text-accent underline">
        {backLabel}
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">{title}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{blurb}</p>
        </div>
        {headerAction}
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">{empty}</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                to={item.to as "/play/arena/$arenaId"}
                {...(item.params ? { params: item.params as { arenaId: string } } : {})}
                {...(item.search ? { search: item.search as { courseId: string } } : {})}
                className="block h-full rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/35 hover:bg-secondary/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium leading-snug">{item.title}</p>
                  <StatusChip tone={item.statusTone ?? "neutral"}>{item.statusLabel}</StatusChip>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{item.meta}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusChip({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "live" | "lobby" | "done" | "neutral";
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tone === "lobby" && "bg-teal-500/15 text-teal-800 dark:text-teal-200",
        tone === "live" && "bg-amber-500/15 text-amber-900 dark:text-amber-200",
        tone === "done" && "bg-secondary text-muted-foreground",
        tone === "neutral" && "bg-secondary text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}
