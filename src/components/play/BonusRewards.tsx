import { cn } from "@/lib/utils";
import { REWARD_TABLE, rewardXp, type RewardCode } from "@/lib/play.math";
import { announceXpGain } from "@/lib/xp-fly";
import { Gift, RotateCw, Sparkles } from "lucide-react";
import { useMemo, useRef, useState } from "react";

export type BonusPrize = { code: RewardCode; label: string };

const SLICE_FILL = [
  ["#f59e0b", "#b45309"],
  ["#fbbf24", "#92400e"],
  ["#a78bfa", "#5b21b6"],
  ["#38bdf8", "#0369a1"],
  ["#34d399", "#047857"],
  ["#fb7185", "#9f1239"],
  ["#818cf8", "#3730a3"],
] as const;

export function BonusRewards({
  onClaim,
  claiming,
}: {
  onClaim: (source: "box" | "wheel") => Promise<BonusPrize>;
  claiming?: boolean;
}) {
  const [pick, setPick] = useState<"wheel" | "box" | null>(null);
  const [prize, setPrize] = useState<BonusPrize | null>(null);
  const originRef = useRef<HTMLDivElement>(null);

  function reveal(row: BonusPrize) {
    setPrize(row);
    const xp = rewardXp(row.code);
    if (xp > 0) announceXpGain(xp, originRef.current);
  }

  if (prize) {
    return (
      <div ref={originRef} className="surface-paper overflow-hidden p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bonus</p>
        <div className="bonus-prize-pop mt-4 rounded-xl border border-amber-400/40 bg-[linear-gradient(165deg,#0f172a_0%,#1e293b_100%)] px-5 py-6 text-center text-white">
          <Sparkles className="mx-auto h-6 w-6 text-amber-300" />
          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-amber-200/80">You won</p>
          <p className="mt-1 font-display text-3xl">{prize.label}</p>
        </div>
      </div>
    );
  }

  return (
    <section ref={originRef} className="surface-paper p-5">
      <h2 className="text-sm font-semibold">Bonus</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick one — the lucky wheel or the mystery box. Both draw from the same prize table.
      </p>
      {!pick ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={claiming}
            onClick={() => setPick("wheel")}
            className="group rounded-xl border border-border bg-secondary/30 p-4 text-left transition-colors hover:border-amber-400/50 hover:bg-amber-500/5"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
              <RotateCw className="h-5 w-5" />
            </span>
            <p className="mt-3 font-semibold">Lucky wheel</p>
            <p className="mt-1 text-xs text-muted-foreground">Spin and watch it land on a bonus.</p>
          </button>
          <button
            type="button"
            disabled={claiming}
            onClick={() => setPick("box")}
            className="group rounded-xl border border-border bg-secondary/30 p-4 text-left transition-colors hover:border-violet-400/50 hover:bg-violet-500/5"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/15 text-violet-600">
              <Gift className="h-5 w-5" />
            </span>
            <p className="mt-3 font-semibold">Mystery box</p>
            <p className="mt-1 text-xs text-muted-foreground">Shake it open for a hidden prize.</p>
          </button>
        </div>
      ) : pick === "wheel" ? (
        <LuckyWheel claiming={claiming} onSpin={() => onClaim("wheel")} onLanded={reveal} />
      ) : (
        <MysteryBox claiming={claiming} onOpen={() => onClaim("box")} onLanded={reveal} />
      )}
    </section>
  );
}

function LuckyWheel({
  onSpin,
  onLanded,
  claiming,
}: {
  onSpin: () => Promise<BonusPrize>;
  onLanded: (prize: BonusPrize) => void;
  claiming?: boolean;
}) {
  const slices = REWARD_TABLE;
  const n = slices.length;
  const slice = 360 / n;
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState<BonusPrize | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const rotationRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const paths = useMemo(() => {
    return slices.map((row, i) => {
      const a0 = (i / n) * 2 * Math.PI - Math.PI / 2;
      const a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2;
      const r = 96;
      const x0 = 100 + r * Math.cos(a0);
      const y0 = 100 + r * Math.sin(a0);
      const x1 = 100 + r * Math.cos(a1);
      const y1 = 100 + r * Math.sin(a1);
      const mid = a0 + (a1 - a0) / 2;
      const labelR = 62;
      return {
        d: `M 100 100 L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`,
        labelX: 100 + labelR * Math.cos(mid),
        labelY: 100 + labelR * Math.sin(mid),
        // Keep text upright-ish along the radius so names stay readable while spinning.
        rotate: (mid * 180) / Math.PI + 90,
        short: shortenWheelLabel(row.label, 11),
        full: row.label,
        row,
        fill: SLICE_FILL[i % SLICE_FILL.length]!,
      };
    });
  }, [n, slices]);

  function sliceAtRotation(deg: number) {
    const normalized = ((-deg % 360) + 360) % 360;
    const index = Math.floor(normalized / slice) % n;
    return slices[index] ?? slices[0]!;
  }

  function animateTo(target: number, durationMs: number, onDone: () => void) {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    const from = rotationRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = from + (target - from) * eased;
      rotationRef.current = value;
      setRotation(value);
      setPreview(sliceAtRotation(value).label);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        onDone();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  async function spin() {
    if (spinning || claiming) return;
    setSpinning(true);
    setLanded(null);
    try {
      const prize = await onSpin();
      const index = Math.max(
        0,
        slices.findIndex((row) => row.code === prize.code),
      );
      const target = rotationRef.current + 360 * 6 + (360 - (index + 0.5) * slice);
      animateTo(target, 4200, () => {
        setLanded(prize);
        setPreview(prize.label);
        setSpinning(false);
        onLanded(prize);
      });
    } catch {
      setSpinning(false);
      setPreview(null);
    }
  }

  return (
    <div className="mt-5 flex flex-col items-center">
      <div className="relative">
        <div className="lucky-pointer" aria-hidden />
        <div
          className="lucky-wheel relative h-[300px] w-[300px] rounded-full"
          style={{ transform: `rotate(${rotation}deg)`, transition: "none" }}
        >
          <svg viewBox="0 0 200 200" className="h-full w-full drop-shadow-xl">
            <defs>
              {paths.map((path, i) => (
                <linearGradient
                  key={path.row.code}
                  id={`wheel-s-${i}`}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor={path.fill[0]} />
                  <stop offset="100%" stopColor={path.fill[1]} />
                </linearGradient>
              ))}
              <radialGradient id="wheel-hub" cx="35%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#fef3c7" />
                <stop offset="55%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#92400e" />
              </radialGradient>
              <filter id="wheel-label-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow
                  dx="0"
                  dy="1"
                  stdDeviation="1.2"
                  floodColor="#000"
                  floodOpacity="0.55"
                />
              </filter>
            </defs>
            <circle cx="100" cy="100" r="99" fill="#0f172a" />
            {paths.map((path, i) => (
              <g key={path.row.code}>
                <path d={path.d} fill={`url(#wheel-s-${i})`} stroke="#0f172a" strokeWidth="1.2" />
                <text
                  x={path.labelX}
                  y={path.labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#fff"
                  fontSize="8.5"
                  fontWeight="800"
                  letterSpacing="0.02em"
                  filter="url(#wheel-label-shadow)"
                  transform={`rotate(${path.rotate} ${path.labelX} ${path.labelY})`}
                >
                  {path.short}
                </text>
              </g>
            ))}
            <circle
              cx="100"
              cy="100"
              r="20"
              fill="url(#wheel-hub)"
              stroke="#fef3c7"
              strokeWidth="2"
            />
            <text
              x="100"
              y="100"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#451a03"
              fontSize="7"
              fontWeight="800"
            >
              SPIN
            </text>
          </svg>
        </div>
      </div>

      <div
        className={cn(
          "mt-4 min-h-10 rounded-full border px-4 py-2 text-center text-sm font-semibold tabular-nums transition-colors",
          spinning
            ? "border-amber-400/50 bg-amber-500/15 text-amber-900 dark:text-amber-100"
            : landed
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
              : "border-border bg-secondary/50 text-muted-foreground",
        )}
      >
        {spinning && preview
          ? `Passing · ${preview}`
          : landed
            ? `Landed · ${landed.label}`
            : "Prize names stay on the wheel — spin to land one"}
      </div>

      <button
        type="button"
        disabled={spinning || claiming || Boolean(landed)}
        onClick={() => void spin()}
        className="mt-4 rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-amber-950 disabled:opacity-60"
      >
        {spinning && !landed ? "Spinning…" : landed ? "Landed" : "Spin the wheel"}
      </button>
    </div>
  );
}

function shortenWheelLabel(label: string, max: number) {
  const trimmed = label.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(1, max - 1))}…`;
}

function MysteryBox({
  onOpen,
  onLanded,
  claiming,
}: {
  onOpen: () => Promise<BonusPrize>;
  onLanded: (prize: BonusPrize) => void;
  claiming?: boolean;
}) {
  const [phase, setPhase] = useState<"idle" | "shake" | "open">("idle");
  const [prize, setPrize] = useState<BonusPrize | null>(null);

  async function open() {
    if (phase !== "idle") return;
    setPhase("shake");
    try {
      const row = await onOpen();
      window.setTimeout(() => {
        setPrize(row);
        setPhase("open");
      }, 900);
      window.setTimeout(() => onLanded(row), 2400);
    } catch {
      setPhase("idle");
    }
  }

  return (
    <div className="mt-5 flex flex-col items-center">
      <div
        className={cn(
          "mystery-stage",
          phase === "shake" && "mystery-shake",
          phase === "open" && "mystery-open",
        )}
      >
        <svg viewBox="0 0 220 180" className="h-44 w-56">
          <defs>
            <linearGradient id="box-body" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="55%" stopColor="#4c1d95" />
              <stop offset="100%" stopColor="#1e1b4b" />
            </linearGradient>
            <linearGradient id="box-lid" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#c4b5fd" />
              <stop offset="45%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#4c1d95" />
            </linearGradient>
            <linearGradient id="box-gold" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#fef3c7" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
            <radialGradient id="box-glow" cx="50%" cy="40%" r="50%">
              <stop offset="0%" stopColor="#fde68a" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
            </radialGradient>
          </defs>
          {phase === "open" ? (
            <ellipse cx="110" cy="92" rx="70" ry="28" fill="url(#box-glow)" />
          ) : null}
          <g className="mystery-body">
            <path d="M28 86h164l-10 62H38z" fill="url(#box-body)" />
            <path d="M28 86h164v14H28z" fill="#2e1065" opacity="0.45" />
            <rect x="102" y="98" width="16" height="28" rx="3" fill="url(#box-gold)" />
            <circle cx="110" cy="112" r="5" fill="#fef3c7" />
            <path d="M38 148h144l-6 10H44z" fill="#1e1b4b" />
          </g>
          <g className="mystery-lid">
            <path d="M22 86 L110 48 L198 86 L188 86 L110 56 L32 86 Z" fill="url(#box-lid)" />
            <path d="M32 86h156v12H32z" fill="url(#box-gold)" />
            <circle cx="110" cy="78" r="8" fill="#fef3c7" stroke="#b45309" strokeWidth="2" />
          </g>
        </svg>
        {phase === "open" && prize ? (
          <p className="bonus-prize-pop mt-1 text-center font-display text-xl">{prize.label}</p>
        ) : null}
      </div>
      <button
        type="button"
        disabled={phase !== "idle" || claiming}
        onClick={() => void open()}
        className="mt-3 rounded-full bg-violet-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {phase === "shake" || claiming ? "Opening…" : phase === "open" ? "Opened" : "Open the box"}
      </button>
    </div>
  );
}
