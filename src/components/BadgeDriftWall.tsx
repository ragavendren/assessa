import { BadgeMark } from "@/components/BadgeMark";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

type DriftBadge = {
  icon: string;
  name?: string;
  code?: string;
};

type BadgeDriftWallProps = {
  badges: DriftBadge[];
  className?: string;
  /** Max unique icons rendered (keeps motion cheap). */
  limit?: number;
};

/** Centered decorative badge float for the Assessa Yourself hero. */
export function BadgeDriftWall({ badges, className, limit = 10 }: BadgeDriftWallProps) {
  const icons = useMemo(() => badges.filter((b) => b.icon).slice(0, limit), [badges, limit]);

  if (icons.length === 0) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute left-1/2 top-1/2 flex h-[4.75rem] w-[min(78%,32rem)] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-2.5 overflow-hidden sm:h-[5.5rem] sm:gap-3",
        className,
      )}
      aria-hidden
    >
      <div className="absolute inset-y-0 left-0 z-[1] w-8 bg-gradient-to-r from-card to-transparent sm:w-10" />
      <div className="absolute inset-y-0 right-0 z-[1] w-8 bg-gradient-to-l from-card to-transparent sm:w-10" />
      {icons.map((badge, index) => (
        <span
          key={`${badge.code ?? badge.icon}-${index}`}
          className={cn(
            "relative z-0 overflow-hidden rounded-md",
            index % 2 === 0 ? "animate-dash-float" : "animate-dash-float-alt",
          )}
          style={{ animationDelay: `${index * 0.45}s` }}
        >
          <BadgeMark
            icon={badge.icon}
            size="sm"
            className="border-0 bg-transparent opacity-55 shadow-none [&>svg]:overflow-hidden sm:opacity-65"
            {...(badge.code ? { code: badge.code } : {})}
            {...(badge.name ? { name: badge.name } : {})}
          />
        </span>
      ))}
    </div>
  );
}
