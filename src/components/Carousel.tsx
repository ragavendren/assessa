import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type CarouselProps = {
  children: ReactNode;
  className?: string;
  /** Tailwind width class for each slide, e.g. "w-[min(100%,18rem)]" */
  itemClassName?: string;
  label?: string;
  /** Auto-advance interval in ms. Set false to disable. Default 4200. */
  autoPlay?: number | false;
};

export function Carousel({
  children,
  className,
  itemClassName = "w-[min(100%,17.5rem)]",
  label = "Carousel",
  autoPlay = 4200,
}: CarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [paused, setPaused] = useState(false);
  const items = Children.toArray(children);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });
    const resize = new ResizeObserver(updateArrows);
    resize.observe(el);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      resize.disconnect();
    };
  }, [items.length, updateArrows]);

  function scrollByPage(direction: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    const step = Math.max(220, el.clientWidth * 0.75);
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 12;
    if (direction === 1 && atEnd) {
      el.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }
    if (direction === -1 && el.scrollLeft <= 8) {
      el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
      return;
    }
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  useEffect(() => {
    if (!autoPlay || items.length < 2 || paused) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const id = window.setInterval(() => {
      const el = scrollerRef.current;
      if (!el) return;
      // Only auto-scroll when content overflows
      if (el.scrollWidth <= el.clientWidth + 8) return;
      scrollByPage(1);
    }, autoPlay);

    return () => window.clearInterval(id);
  }, [autoPlay, items.length, paused]);

  return (
    <div
      className={cn("relative", className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
    >
      <div className="mb-2 flex justify-end gap-1.5">
        <button
          type="button"
          aria-label={`Previous ${label}`}
          disabled={!canPrev && !canNext}
          onClick={() => scrollByPage(-1)}
          className="rounded-md border border-border bg-card p-1.5 text-muted-foreground transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-x-0.5 hover:border-accent/40 hover:text-foreground active:scale-95 disabled:opacity-30 disabled:hover:translate-x-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={`Next ${label}`}
          disabled={!canPrev && !canNext}
          onClick={() => scrollByPage(1)}
          className="rounded-md border border-border bg-card p-1.5 text-muted-foreground transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:translate-x-0.5 hover:border-accent/40 hover:text-foreground active:scale-95 disabled:opacity-30 disabled:hover:translate-x-0"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="region"
        aria-label={label}
        aria-roledescription="carousel"
      >
        {items.map((child, index) => (
          <div
            key={index}
            className={cn("animate-dash-slide shrink-0 snap-start", itemClassName)}
            style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}
