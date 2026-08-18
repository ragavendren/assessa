import { AskBot } from "@/components/help/AskBot";
import { AssessaIcon } from "@/components/icons";
import { TOUR_STORAGE_KEY, tourStepsFor, type TourStep } from "@/lib/help-content";
import { cn } from "@/lib/utils";
import { useRouterState } from "@tanstack/react-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

type HelpContextValue = {
  openFaq: () => void;
  startTour: () => void;
  dismissTourPrompt: () => void;
  showTourPrompt: boolean;
};

const HelpContext = createContext<HelpContextValue | null>(null);

function useHelp() {
  const value = useContext(HelpContext);
  if (!value) throw new Error("useHelp must be used within HelpProvider");
  return value;
}

function tourSeen(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(TOUR_STORAGE_KEY) === "done";
}

function markTourSeen() {
  window.localStorage.setItem(TOUR_STORAGE_KEY, "done");
}

export function HelpProvider({
  children,
  isAdmin,
  playOn,
  profileReady,
}: {
  children: ReactNode;
  isAdmin: boolean;
  playOn: boolean;
  profileReady: boolean;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [faqOpen, setFaqOpen] = useState(false);
  const [tourIndex, setTourIndex] = useState<number | null>(null);
  const [promptDismissed, setPromptDismissed] = useState(false);
  const [seen, setSeen] = useState(true);

  useEffect(() => {
    setSeen(tourSeen());
  }, []);

  const steps = useMemo(() => tourStepsFor({ isAdmin, playOn }), [isAdmin, playOn]);

  const openFaq = useCallback(() => {
    setTourIndex(null);
    setFaqOpen(true);
  }, []);

  const startTour = useCallback(() => {
    setFaqOpen(false);
    setTourIndex(0);
  }, []);

  const finishTour = useCallback(() => {
    markTourSeen();
    setSeen(true);
    setTourIndex(null);
  }, []);

  const dismissTourPrompt = useCallback(() => {
    markTourSeen();
    setSeen(true);
    setPromptDismissed(true);
  }, []);

  const showTourPrompt =
    profileReady &&
    !seen &&
    !promptDismissed &&
    tourIndex === null &&
    (pathname === "/dashboard" || pathname === "/dashboard/");

  const value = useMemo(
    () => ({ openFaq, startTour, dismissTourPrompt, showTourPrompt }),
    [openFaq, startTour, dismissTourPrompt, showTourPrompt],
  );

  return (
    <HelpContext.Provider value={value}>
      {children}
      <AskBot
        open={faqOpen}
        onOpen={openFaq}
        onClose={() => setFaqOpen(false)}
        isAdmin={isAdmin}
        onStartTour={startTour}
      />
      {tourIndex !== null ? (
        <UserTour steps={steps} index={tourIndex} onIndex={setTourIndex} onClose={finishTour} />
      ) : null}
    </HelpContext.Provider>
  );
}

export function HelpButton() {
  const { startTour } = useHelp();

  return (
    <button
      type="button"
      aria-label="Take a tour"
      onClick={startTour}
      className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      <AssessaIcon name="tour" className="h-4 w-4" />
    </button>
  );
}

export function TourPrompt() {
  const { startTour, openFaq, dismissTourPrompt, showTourPrompt } = useHelp();
  if (!showTourPrompt) return null;

  return (
    <section className="surface-paper flex flex-wrap items-start justify-between gap-3 rounded-xl p-4">
      <div className="min-w-0 max-w-xl">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
          <AssessaIcon name="tour" className="h-3.5 w-3.5" />
          Required loop
        </p>
        <h2 className="mt-1 text-sm font-semibold">Know what is mandatory</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Daily Play, Weekly Play, and assigned papers.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={startTour}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
        >
          Take a tour
        </button>
        <button
          type="button"
          onClick={openFaq}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-secondary"
        >
          Ask
        </button>
        <button
          type="button"
          onClick={dismissTourPrompt}
          className="rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          Later
        </button>
      </div>
    </section>
  );
}

type Highlight = { top: number; left: number; width: number; height: number };

function UserTour({
  steps,
  index,
  onIndex,
  onClose,
}: {
  steps: TourStep[];
  index: number;
  onIndex: (next: number) => void;
  onClose: () => void;
}) {
  const step = steps[index];
  const [highlight, setHighlight] = useState<Highlight | null>(null);

  const measure = useCallback(() => {
    if (!step) return;
    if (!step.target) {
      setHighlight(null);
      return;
    }
    const nodes = [...document.querySelectorAll(step.target)];
    const el = nodes.find((node) => {
      const box = node.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    });
    if (!el) {
      setHighlight(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    const pad = 8;
    setHighlight({
      top: Math.max(8, rect.top - pad),
      left: Math.max(8, rect.left - pad),
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    });
  }, [step]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "ArrowRight" && index < steps.length - 1) onIndex(index + 1);
      if (event.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, onClose, onIndex, steps.length]);

  if (!step) return null;

  const last = index === steps.length - 1;
  const tooltipStyle = tooltipPosition(highlight);

  return (
    <div
      className="fixed inset-0 z-[120]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      <div className="absolute inset-0 bg-background/55 backdrop-blur-[1px]" onClick={onClose} />
      {highlight ? (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-primary"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
            boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.45)",
          }}
        />
      ) : null}
      <div
        className="surface-paper absolute z-[121] w-[min(22rem,calc(100vw-2rem))] p-4 shadow-lg"
        style={tooltipStyle}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {index + 1} / {steps.length}
            </p>
            <h2 id="tour-title" className="mt-1 text-sm font-semibold">
              {step.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Close tour"
          >
            <AssessaIcon name="close" className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Skip
          </button>
          <div className="flex gap-2">
            {index > 0 ? (
              <button
                type="button"
                onClick={() => onIndex(index - 1)}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-secondary"
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => (last ? onClose() : onIndex(index + 1))}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
            >
              {last ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function tooltipPosition(highlight: Highlight | null): CSSProperties {
  if (!highlight) {
    return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }
  const placeBelow = highlight.top + highlight.height < window.innerHeight * 0.55;
  const left = Math.min(Math.max(16, highlight.left), window.innerWidth - 16 - 352);
  if (placeBelow) {
    return { top: highlight.top + highlight.height + 12, left };
  }
  return { top: Math.max(16, highlight.top - 12), left, transform: "translateY(-100%)" };
}

export function HelpMenuLink({ onClick }: { onClick: () => void }) {
  const { openFaq } = useHelp();
  return (
    <button
      type="button"
      onClick={() => {
        onClick();
        openFaq();
      }}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      <AssessaIcon name="ask" className="h-4 w-4" />
      Help & Ask
    </button>
  );
}

/** Replay entry used from Play / dashboard copy. */
export function HelpTextLink({ children }: { children: ReactNode }) {
  const { openFaq } = useHelp();
  return (
    <button type="button" onClick={openFaq} className="text-accent underline">
      {children}
    </button>
  );
}
