import { AssessaIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

type SlideOverProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  size?: "md" | "lg" | "xl";
};

const SIZE_CLASS = {
  md: "max-w-md",
  lg: "max-w-xl",
  xl: "max-w-3xl",
} as const;

/** Right-edge sheet for configuration forms. */
export function SlideOver({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  size = "lg",
}: SlideOverProps) {
  const titleId = useId();
  const descriptionId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [rendered, setRendered] = useState(open);
  const [entered, setEntered] = useState(open);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setEntered(true));
      });
      return () => window.cancelAnimationFrame(frame);
    }
    setEntered(false);
    const timer = window.setTimeout(() => setRendered(false), 280);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const root = panelRef.current;
    const preferred =
      root?.querySelector<HTMLElement>("[autofocus]") ??
      root?.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])',
      );
    if (!preferred) closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!rendered) return null;

  return (
    <div className="fixed inset-0 z-[105]" role="presentation">
      <button
        type="button"
        aria-label="Close panel"
        className={cn(
          "absolute inset-0 bg-ink/40 backdrop-blur-[2px] transition-opacity duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          entered ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          "absolute inset-y-0 right-0 flex w-full flex-col border-l border-border bg-card shadow-lift transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          entered ? "translate-x-0" : "translate-x-full",
          SIZE_CLASS[size],
          className,
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-xl text-foreground">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Close"
          >
            <AssessaIcon name="close" className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <footer className="shrink-0 border-t border-border px-5 py-3">{footer}</footer>
        ) : null}
      </aside>
    </div>
  );
}
