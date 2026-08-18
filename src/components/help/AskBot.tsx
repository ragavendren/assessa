import { BrandMark } from "@/components/BrandMark";
import { AssessaIcon } from "@/components/icons";
import {
  FAQ_TOPIC_PROMPTS,
  faqCategories,
  faqItemsFor,
  faqItemsInTopic,
  relatedFaqItems,
  type FaqItem,
} from "@/lib/help-content";
import { cn } from "@/lib/utils";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

type ChatLine =
  { id: string; role: "bot"; text: string } | { id: string; role: "user"; text: string };

function greeting(): ChatLine {
  return {
    id: "hello",
    role: "bot",
    text: "Pick a topic. I’ll answer from that set, then offer related questions.",
  };
}

export function AskBot({
  open,
  onClose,
  onOpen,
  isAdmin,
  onStartTour,
}: {
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
  isAdmin: boolean;
  onStartTour: () => void;
}) {
  const items = faqItemsFor(isAdmin);
  const topics = faqCategories(items);
  const titleId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<ChatLine[]>([greeting()]);
  const [topic, setTopic] = useState<string | null>(null);
  const [asked, setAsked] = useState<string[]>([]);
  const [rendered, setRendered] = useState(open);
  const [entered, setEntered] = useState(open);
  const seq = useRef(0);

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
    setLines([greeting()]);
    setTopic(null);
    setAsked([]);
    seq.current = 0;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [open, lines, topic, asked]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function push(line: Omit<ChatLine, "id">) {
    seq.current += 1;
    setLines((current) => [...current, { ...line, id: `m-${seq.current}` }]);
  }

  function pickTopic(next: string) {
    setTopic(next);
    push({ role: "user", text: next });
    push({
      role: "bot",
      text: FAQ_TOPIC_PROMPTS[next] ?? `Questions about ${next}.`,
    });
  }

  function pickQuestion(item: FaqItem) {
    setTopic(item.category);
    setAsked((current) => (current.includes(item.id) ? current : [...current, item.id]));
    push({ role: "user", text: item.question });
    push({ role: "bot", text: item.answer });
  }

  function resetChat() {
    setLines([greeting()]);
    setTopic(null);
    setAsked([]);
  }

  const topicQuestions = topic ? faqItemsInTopic(items, topic) : [];
  const lastAsked = asked.length ? items.find((item) => item.id === asked[asked.length - 1]) : null;
  const related = lastAsked ? relatedFaqItems(lastAsked, items) : [];
  const remaining = topicQuestions.filter((item) => !asked.includes(item.id));
  const relatedOpen = related.filter((item) => !asked.includes(item.id));
  const questionTags = lastAsked && relatedOpen.length ? relatedOpen : remaining;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex flex-col items-end gap-3">
      {rendered ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={cn(
            "pointer-events-auto flex h-[min(34rem,calc(100dvh-6.5rem))] w-[min(22.5rem,calc(100vw-2rem))] origin-bottom-right flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lift transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            entered
              ? "translate-y-0 scale-100 opacity-100"
              : "pointer-events-none translate-y-3 scale-95 opacity-0",
          )}
        >
          <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex min-w-0 items-center gap-2.5">
              <BrandMark
                showWordmark={false}
                markClassName="h-8 w-8 rounded-[0.5rem] shadow-none"
              />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                  Ask Assessa
                </p>
                <h2 id={titleId} className="mt-0.5 truncate text-sm font-semibold">
                  {topic ?? "Choose a topic"}
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={resetChat}
                className="rounded-md p-1.5 text-primary-foreground/80 hover:bg-white/10 hover:text-primary-foreground"
                aria-label="Start over"
              >
                <AssessaIcon name="reset" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1.5 text-primary-foreground/80 hover:bg-white/10 hover:text-primary-foreground"
                aria-label="Close Ask"
              >
                <AssessaIcon name="close" className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div
            ref={listRef}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-background px-3 py-3"
          >
            {lines.map((line) => (
              <p
                key={line.id}
                className={cn(
                  "max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                  line.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "border border-border bg-card text-foreground",
                )}
              >
                {line.text}
              </p>
            ))}
          </div>

          <footer className="shrink-0 space-y-2.5 border-t border-border bg-card px-3 py-3">
            <div className="flex flex-wrap gap-1.5">
              {topics.map((name) => (
                <Chip key={name} active={topic === name} onClick={() => pickTopic(name)}>
                  {name}
                </Chip>
              ))}
              <Chip
                onClick={() => {
                  onClose();
                  onStartTour();
                }}
              >
                <AssessaIcon name="tour" className="h-3 w-3" />
                Tour
              </Chip>
            </div>
            {topic && questionTags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 border-t border-border pt-2">
                {questionTags.map((item) => (
                  <Chip key={item.id} tone="question" onClick={() => pickQuestion(item)}>
                    {item.tag}
                  </Chip>
                ))}
              </div>
            ) : null}
          </footer>
        </div>
      ) : null}

      <button
        type="button"
        data-tour="help"
        aria-label={open ? "Close Ask" : "Ask Assessa"}
        aria-expanded={open}
        onClick={() => (open ? onClose() : onOpen())}
        className="pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-105 hover:bg-primary/90 active:scale-95"
      >
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            open ? "scale-50 rotate-45 opacity-0" : "scale-100 rotate-0 opacity-100",
          )}
        >
          <BrandMark showWordmark={false} markClassName="h-8 w-8 rounded-[0.5rem] shadow-none" />
        </span>
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            open ? "scale-100 rotate-0 opacity-100" : "scale-50 -rotate-45 opacity-0",
          )}
        >
          <AssessaIcon name="close" className="h-5 w-5" />
        </span>
      </button>
    </div>
  );
}

function Chip({
  children,
  onClick,
  active,
  tone = "topic",
}: {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  tone?: "topic" | "question";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        tone === "question" && "border-border bg-background text-foreground hover:bg-secondary",
        tone === "topic" &&
          !active &&
          "border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground",
        tone === "topic" && active && "border-primary bg-primary text-primary-foreground",
      )}
    >
      {children}
    </button>
  );
}
