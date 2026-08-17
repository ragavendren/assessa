import { useMe } from "@/hooks/use-me";
import { cn } from "@/lib/utils";
import { onXpGain } from "@/lib/xp-fly";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Flyer = {
  id: number;
  amount: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
};

export function XpHud() {
  const { data } = useMe();
  const queryClient = useQueryClient();
  const chipRef = useRef<HTMLDivElement>(null);
  const shownRef = useRef(0);
  const [shown, setShown] = useState(0);
  const [ready, setReady] = useState(false);
  const [pop, setPop] = useState(false);
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const serverXp = data?.level.xp ?? 0;

  useEffect(() => {
    shownRef.current = shown;
  }, [shown]);

  useEffect(() => {
    if (!ready) {
      setShown(serverXp);
      shownRef.current = serverXp;
      if (data) setReady(true);
      return;
    }
    if (serverXp < shownRef.current) {
      setShown(serverXp);
      return;
    }
    if (serverXp > shownRef.current && serverXp - shownRef.current <= 2) {
      setShown(serverXp);
    }
  }, [serverXp, data, ready]);

  useEffect(() => {
    return onXpGain(({ amount, origin }) => {
      const target = chipRef.current?.getBoundingClientRect();
      const fromX = origin ? origin.left + origin.width / 2 : window.innerWidth / 2;
      const fromY = origin ? origin.top + origin.height / 2 : window.innerHeight * 0.42;
      const toX = target ? target.left + target.width / 2 : fromX;
      const toY = target ? target.top + target.height / 2 : fromY;
      const id = Date.now() + Math.random();
      setFlyers((prev) => [
        ...prev,
        { id, amount, x: fromX, y: fromY, dx: toX - fromX, dy: toY - fromY },
      ]);
      window.setTimeout(() => {
        setFlyers((prev) => prev.filter((row) => row.id !== id));
        const start = shownRef.current;
        const end = start + amount;
        const started = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - started) / 520);
          const eased = 1 - (1 - t) ** 3;
          setShown(Math.round(start + (end - start) * eased));
          if (t < 1) requestAnimationFrame(tick);
          else {
            setPop(true);
            window.setTimeout(() => setPop(false), 420);
          }
        };
        requestAnimationFrame(tick);
        void queryClient.invalidateQueries({ queryKey: ["me"] });
      }, 720);
    });
  }, [queryClient]);

  if (!data) return null;

  return (
    <>
      <div ref={chipRef} className="relative">
        <Link
          id="xp-nav-chip"
          to="/achievements"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/70 px-2.5 py-1 text-xs font-semibold tabular-nums",
            pop && "xp-chip-pop",
          )}
          aria-label={`${shown.toLocaleString()} XP`}
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span>{shown.toLocaleString()}</span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            XP
          </span>
        </Link>
      </div>
      {flyers.map((flyer) => (
        <span
          key={flyer.id}
          className="xp-flyer pointer-events-none fixed z-[80] rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-950 shadow-lg"
          style={{
            left: flyer.x,
            top: flyer.y,
            ["--xp-dx" as string]: `${flyer.dx}px`,
            ["--xp-dy" as string]: `${flyer.dy}px`,
          }}
        >
          +{flyer.amount} XP
        </span>
      ))}
    </>
  );
}
