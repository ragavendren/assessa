import { BadgeMark } from "@/components/BadgeMark";
import type { BadgeTrack } from "@/components/badges";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef } from "react";

type DriftBadge = {
  icon: string;
  name?: string;
  code?: string;
  track?: string;
};

type BadgeDriftWallProps = {
  badges: DriftBadge[];
  className?: string;
  limit?: number;
};

const BADGE = 48;
const STACK_DX = 9;
const STACK_DY = 6;
const CROSS_SEC = 2.35;
const PAUSE_SEC = 0.55;

type Sim = {
  left: number[];
  right: number[];
  traveler: number | null;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  t: number;
  dir: 1 | -1;
  wait: number;
  clash: number[];
};

function asTrack(value: string | undefined): BadgeTrack {
  if (
    value === "beginner" ||
    value === "intermediate" ||
    value === "expertise" ||
    value === "elite"
  ) {
    return value;
  }
  return "intermediate";
}

function ease(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Shuttle deck: stack left, send one across, stack right, then reverse. */
export function BadgeDriftWall({ badges, className, limit = 6 }: BadgeDriftWallProps) {
  const packed = JSON.stringify(
    badges
      .filter((badge) => badge.icon)
      .slice(0, limit)
      .map((badge) => ({
        icon: badge.icon,
        ...(badge.name ? { name: badge.name } : {}),
        ...(badge.code ? { code: badge.code } : {}),
        ...(badge.track ? { track: badge.track } : {}),
      })),
  );

  const source = useMemo(() => JSON.parse(packed) as DriftBadge[], [packed]);

  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const simRef = useRef<Sim | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    const root = rootRef.current;
    if (!root || source.length === 0) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const measure = () => {
      sizeRef.current = { w: root.clientWidth, h: root.clientHeight };
    };

    const boot = () => {
      measure();
      simRef.current = {
        left: source.map((_, index) => index),
        right: [],
        traveler: null,
        fromX: 0,
        fromY: 0,
        toX: 0,
        toY: 0,
        t: 0,
        dir: 1,
        wait: PAUSE_SEC,
        clash: source.map(() => 0),
      };
      paint(itemRefs.current, source, simRef.current, sizeRef.current);
    };

    boot();
    if (reduced) return;

    const observer = new ResizeObserver(() => {
      measure();
      const sim = simRef.current;
      if (!sim) return;
      paint(itemRefs.current, source, sim, sizeRef.current);
    });
    observer.observe(root);

    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const sim = simRef.current;
      if (sim && sizeRef.current.w >= BADGE * 2.4) {
        step(sim, source, sizeRef.current, dt);
        paint(itemRefs.current, source, sim, sizeRef.current);
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [source]);

  if (source.length === 0) return null;

  return (
    <div
      ref={rootRef}
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden
    >
      {source.map((badge, index) => (
        <span
          key={`${badge.code ?? badge.icon}-${index}`}
          ref={(node) => {
            itemRefs.current[index] = node;
          }}
          className="absolute left-0 top-0 will-change-transform"
        >
          <BadgeMark
            icon={badge.icon}
            size="sm"
            track={asTrack(badge.track)}
            className="opacity-80 shadow-none"
            {...(badge.code ? { code: badge.code } : {})}
            {...(badge.name ? { name: badge.name } : {})}
          />
        </span>
      ))}
    </div>
  );
}

function stackPoint(side: 1 | -1, depth: number, count: number, size: { w: number; h: number }) {
  const inset = BADGE / 2 + 6;
  const x = side === 1 ? inset + depth * STACK_DX : size.w - inset - depth * STACK_DX;
  const y = size.h / 2 + (depth - (count - 1) / 2) * STACK_DY;
  return { x, y };
}

function step(sim: Sim, badges: DriftBadge[], size: { w: number; h: number }, dt: number) {
  for (let i = 0; i < sim.clash.length; i += 1) {
    sim.clash[i] = Math.max(0, (sim.clash[i] ?? 0) - dt * 1.8);
  }

  if (sim.traveler != null) {
    sim.t = Math.min(1, sim.t + dt / CROSS_SEC);
    if (sim.t < 1) return;
    const arrived = sim.traveler;
    const dest = sim.dir === 1 ? sim.right : sim.left;
    const top = dest[dest.length - 1];
    dest.push(arrived);
    if (top != null && asTrack(badges[arrived]?.track) !== asTrack(badges[top]?.track)) {
      sim.clash[arrived] = 1;
      sim.clash[top] = 1;
    }
    sim.traveler = null;
    sim.t = 0;
    sim.wait = PAUSE_SEC;
    if ((sim.dir === 1 ? sim.left : sim.right).length === 0) {
      sim.dir = sim.dir === 1 ? -1 : 1;
      sim.wait = PAUSE_SEC * 1.4;
    }
    return;
  }

  sim.wait -= dt;
  if (sim.wait > 0) return;

  const sourceDeck = sim.dir === 1 ? sim.left : sim.right;
  const destDeck = sim.dir === 1 ? sim.right : sim.left;
  if (sourceDeck.length === 0) {
    sim.dir = sim.dir === 1 ? -1 : 1;
    sim.wait = PAUSE_SEC;
    return;
  }

  const index = sourceDeck.pop()!;
  const from = stackPoint(sim.dir === 1 ? 1 : -1, sourceDeck.length, sourceDeck.length + 1, size);
  const to = stackPoint(sim.dir === 1 ? -1 : 1, destDeck.length, destDeck.length + 1, size);
  sim.traveler = index;
  sim.fromX = from.x;
  sim.fromY = from.y;
  sim.toX = to.x;
  sim.toY = to.y;
  sim.t = 0;
}

function paint(
  nodes: Array<HTMLSpanElement | null>,
  badges: DriftBadge[],
  sim: Sim,
  size: { w: number; h: number },
) {
  const place = (index: number, x: number, y: number, traveling: boolean) => {
    const node = nodes[index];
    if (!node) return;
    const clash = sim.clash[index] ?? 0;
    const scale = (traveling ? 1.04 : 1) + clash * 0.22;
    const rotate = clash * 12;
    node.style.transform = `translate(${x - BADGE / 2}px, ${y - BADGE / 2}px) scale(${scale}) rotate(${rotate}deg)`;
    node.style.zIndex = traveling ? "8" : String(2 + Math.round(x / 10));
    node.style.filter = clash > 0.35 ? "drop-shadow(0 0 8px rgba(229,166,59,0.5))" : "none";
    node.style.visibility = size.w < BADGE * 2.4 ? "hidden" : "visible";
  };

  const layoutDeck = (deck: number[], side: 1 | -1) => {
    deck.forEach((index, depth) => {
      const point = stackPoint(side, depth, deck.length, size);
      place(index, point.x, point.y, false);
    });
  };

  layoutDeck(sim.left, 1);
  layoutDeck(sim.right, -1);

  if (sim.traveler == null) return;
  const k = ease(sim.t);
  const x = sim.fromX + (sim.toX - sim.fromX) * k;
  const y = sim.fromY + (sim.toY - sim.fromY) * k - Math.sin(sim.t * Math.PI) * 7;
  place(sim.traveler, x, y, true);
}
