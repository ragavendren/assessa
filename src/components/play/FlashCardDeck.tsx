import { cn } from "@/lib/utils";
import { Check, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export type FlashCard = {
  id: string;
  front: string;
  back: string;
  known?: boolean | null;
};

export function FlashCardDeck({
  cards,
  onMark,
  marking,
}: {
  cards: FlashCard[];
  onMark: (known: boolean, questionId: string) => void;
  marking?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [exitAnim, setExitAnim] = useState<"left" | "right" | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);

  const card = cards[index];
  const knownCount = cards.filter((c) => c.known).length;
  const progress = cards.length ? ((index + (exitAnim ? 1 : 0)) / cards.length) * 100 : 0;

  const sizeToContent = useCallback(() => {
    const wrap = wrapRef.current;
    const face = flipped ? backRef.current : frontRef.current;
    if (!wrap || !face) return;
    wrap.style.height = `${face.scrollHeight}px`;
  }, [flipped]);

  useLayoutEffect(() => {
    sizeToContent();
  }, [sizeToContent, card?.id, card?.front, card?.back]);

  useEffect(() => {
    const faces = [frontRef.current, backRef.current].filter((el): el is HTMLDivElement =>
      Boolean(el),
    );
    if (faces.length === 0) return;
    const observer = new ResizeObserver(() => sizeToContent());
    for (const face of faces) observer.observe(face);
    window.addEventListener("resize", sizeToContent);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sizeToContent);
    };
  }, [sizeToContent, card?.id]);

  const flip = useCallback(() => setFlipped((v) => !v), []);

  const mark = useCallback(
    (known: boolean) => {
      if (!card || marking) return;
      setExitAnim(known ? "right" : "left");
      window.setTimeout(() => {
        onMark(known, card.id);
        setFlipped(false);
        setExitAnim(null);
        setIndex((i) => i + 1);
      }, 280);
    },
    [card, marking, onMark],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!card || marking) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        flip();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        mark(false);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        mark(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, flip, mark, marking]);

  if (!card) {
    return (
      <div className="surface-paper mx-auto max-w-xl rounded-2xl p-8 text-center">
        <Check className="mx-auto h-10 w-10 text-success" />
        <h2 className="mt-3 text-lg font-semibold">Deck complete</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You reviewed {cards.length} cards · {knownCount} marked as known.
        </p>
        <button
          type="button"
          onClick={() => {
            setIndex(0);
            setFlipped(false);
          }}
          className="mt-4 inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
        >
          <RotateCcw className="h-4 w-4" />
          Review again
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {index + 1} / {cards.length}
        </span>
        <span>{knownCount} known</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full bg-accent transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div
        className={cn(
          "transition-transform duration-300",
          exitAnim === "left" && "-translate-x-8 -rotate-6 opacity-0",
          exitAnim === "right" && "translate-x-8 rotate-6 opacity-0",
        )}
      >
        <div className="flash-scene">
          <div
            ref={wrapRef}
            role="button"
            tabIndex={0}
            aria-pressed={flipped}
            aria-label={flipped ? "Show prompt" : "Show explanation"}
            onClick={flip}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                flip();
              }
            }}
            className={cn("flash-card cursor-pointer", flipped && "is-flipped")}
          >
            <div ref={frontRef} className="flash-face flash-face-front">
              <p className="flash-face-kicker">Prompt</p>
              <p className="flash-face-body">{card.front}</p>
            </div>
            <div ref={backRef} className="flash-face flash-face-back">
              <p className="flash-face-kicker">Explanation</p>
              <p className="flash-face-body">{card.back}</p>
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">Tap the card to flip</p>

      <div className="flex justify-center gap-3">
        <button
          type="button"
          disabled={marking}
          onClick={() => mark(false)}
          className="inline-flex items-center gap-2 rounded-full border border-destructive/30 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/5"
        >
          <X className="h-4 w-4" />
          Still learning
        </button>
        <button
          type="button"
          disabled={marking}
          onClick={() => mark(true)}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
        >
          <Check className="h-4 w-4" />I know this
        </button>
      </div>
    </div>
  );
}
