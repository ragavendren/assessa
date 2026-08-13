import { LayoutGrid, Rows3, Table2 } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type ListViewMode = "grid" | "table" | "stack";

const VIEW_OPTIONS: { value: ListViewMode; label: string; icon: typeof LayoutGrid }[] = [
  { value: "grid", label: "Cards", icon: LayoutGrid },
  { value: "table", label: "Table", icon: Table2 },
  { value: "stack", label: "Single", icon: Rows3 },
];

export function useListViewMode(storageKey: string, fallback: ListViewMode = "grid") {
  const [view, setView] = useState<ListViewMode>(fallback);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(`assessa:list-view:${storageKey}`);
      if (stored === "grid" || stored === "table" || stored === "stack") setView(stored);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  function setViewMode(next: ListViewMode) {
    setView(next);
    try {
      window.localStorage.setItem(`assessa:list-view:${storageKey}`, next);
    } catch {
      /* ignore */
    }
  }

  return [view, setViewMode] as const;
}

export type ListFilterOption<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

type ListToolbarProps<T extends string> = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ListFilterOption<T>[];
  filter: T;
  onFilterChange: (value: T) => void;
  view: ListViewMode;
  onViewChange: (value: ListViewMode) => void;
  trailing?: ReactNode;
};

export function ListToolbar<T extends string>({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  filters,
  filter,
  onFilterChange,
  view,
  onViewChange,
  trailing,
}: ListToolbarProps<T>) {
  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          className="field w-full min-w-0 sm:max-w-md"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label="Search list"
        />
        <div className="flex flex-wrap items-center gap-2">
          {trailing}
          <div
            className="inline-flex rounded-[var(--radius-md)] border border-border bg-card p-0.5"
            role="group"
            aria-label="View mode"
          >
            {VIEW_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  title={option.label}
                  aria-label={option.label}
                  aria-pressed={view === option.value}
                  onClick={() => onViewChange(option.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-[calc(var(--radius-md)-2px)] px-2.5 py-1.5 text-xs font-medium transition-colors",
                    view === option.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {filters && filters.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {filters.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onFilterChange(option.value)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm transition-colors",
                filter === option.value
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
              {typeof option.count === "number" ? (
                <span className="ml-1.5 tabular-nums opacity-70">{option.count}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function listViewClass(view: ListViewMode) {
  if (view === "grid") return "grid min-w-0 gap-4 md:grid-cols-2";
  if (view === "stack") return "grid min-w-0 gap-4 grid-cols-1";
  return "hidden";
}
