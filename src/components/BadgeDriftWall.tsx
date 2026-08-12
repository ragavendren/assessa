import { cn } from "@/lib/utils";
import { useMemo } from "react";

type DriftBadge = {
  icon: string;
  name?: string;
};

type BadgeDriftWallProps = {
  badges: DriftBadge[];
  className?: string;
  /** Max icons rendered (keeps motion cheap). */
  limit?: number;
};

/** Centered decorative badge drift for the Assessa Yourself hero. */
export function BadgeDriftWall({ badges, className, limit = 10 }: BadgeDriftWallProps) {
  const icons = useMemo(() => {
    const source = badges.filter((b) => b.icon).slice(0, limit);
    if (source.length === 0) return [];
    while (source.length < Math.min(6, limit) && source.length > 0) {
      source.push(...source.slice(0, Math.min(3, source.length)));
    }
    return source.slice(0, limit);
  }, [badges, limit]);

  if (icons.length === 0) return null;

  const loop = [...icons, ...icons];

  return (
    <div
      className={cn(
        "pointer-events-none absolute left-1/2 top-1/2 h-[4.75rem] w-[min(70%,28rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden sm:h-[5.25rem]",
        className,
      )}
      aria-hidden
    >
      <div className="absolute inset-y-0 left-0 z-[1] w-10 bg-gradient-to-r from-card to-transparent" />
      <div className="absolute inset-y-0 right-0 z-[1] w-10 bg-gradient-to-l from-card to-transparent" />
      <div className="absolute inset-y-0 left-0 right-0 flex items-center opacity-45 sm:opacity-55">
        <div
          className="flex w-max gap-3 will-change-transform animate-badge-drift-left"
          style={{ animationDuration: "28s" }}
        >
          {loop.map((badge, index) => (
            <span
              key={`${badge.icon}-${index}`}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card/85 text-lg shadow-sm backdrop-blur-[1px]"
              title={badge.name}
            >
              {badge.icon}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
