import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
  wordmarkClassName?: string;
};

/** Assessa logo mark + optional wordmark. */
export function BrandMark({
  className,
  markClassName,
  showWordmark = true,
  wordmarkClassName,
}: BrandMarkProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "relative flex h-8 w-8 shrink-0 overflow-hidden rounded-[0.55rem] shadow-ink",
          markClassName,
        )}
        aria-hidden
      >
        <svg viewBox="0 0 64 64" className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" rx="14" fill="#2A2420" />
          <path
            d="M32 12.5L18.5 48h7.2l2.55-7.1h7.5L38.3 48h7.2L32 12.5zm0 13.1l2.7 7.6h-5.4L32 25.6z"
            fill="#F7F3EA"
          />
          <path
            d="M41.2 41.8l4.1-4.1 2.2 2.2-6.3 6.3-3.5-3.5 2.2-2.2 1.3 1.3z"
            fill="#E5A63B"
          />
        </svg>
      </span>
      {showWordmark ? (
        <span className={cn("font-display text-lg tracking-tight text-foreground", wordmarkClassName)}>
          Assessa
        </span>
      ) : null}
    </span>
  );
}
