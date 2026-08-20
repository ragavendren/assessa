import { UserAvatar } from "@/components/UserAvatar";
import { splitArenaTeams, spinArenaParticipant } from "@/lib/play.functions";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Person = {
  userId: string;
  name: string;
  email: string;
  avatarId?: string | null;
  online?: boolean;
  presence?: "online" | "offline";
  teamId?: string;
  teamName?: string;
  inArena?: boolean;
};

const WHEEL_COLORS = [
  ["#f59e0b", "#b45309"],
  ["#10b981", "#047857"],
  ["#3b82f6", "#1d4ed8"],
  ["#a855f7", "#6b21a8"],
  ["#ef4444", "#991b1b"],
  ["#14b8a6", "#0f766e"],
  ["#f97316", "#c2410c"],
  ["#6366f1", "#3730a3"],
] as const;

export function ArenaHostLobbyTools({
  arenaId,
  participants,
  directory,
}: {
  arenaId: string;
  participants: Person[];
  directory: Person[];
}) {
  const queryClient = useQueryClient();
  const spinFn = useServerFn(spinArenaParticipant);
  const splitFn = useServerFn(splitArenaTeams);
  const [source, setSource] = useState<"lobby" | "all">("lobby");
  const [teamCount, setTeamCount] = useState(4);
  const [perTeam, setPerTeam] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [picked, setPicked] = useState<Person | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const rotationRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const pool = source === "lobby" ? participants : directory;
  const onlineCount = pool.filter((row) => row.online).length;
  const n = Math.max(1, pool.length);
  const slice = 360 / n;

  useEffect(() => {
    setPicked(null);
    setPreviewName(null);
  }, [source]);

  const slices = useMemo(() => {
    if (pool.length === 0) return [];
    return pool.map((person, i) => {
      const a0 = (i / n) * 2 * Math.PI - Math.PI / 2;
      const a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2;
      const r = 96;
      const x0 = 100 + r * Math.cos(a0);
      const y0 = 100 + r * Math.sin(a0);
      const x1 = 100 + r * Math.cos(a1);
      const y1 = 100 + r * Math.sin(a1);
      const mid = a0 + (a1 - a0) / 2;
      const labelR = pool.length > 10 ? 58 : 64;
      const fill = WHEEL_COLORS[i % WHEEL_COLORS.length]!;
      return {
        person,
        d: `M 100 100 L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`,
        labelX: 100 + labelR * Math.cos(mid),
        labelY: 100 + labelR * Math.sin(mid),
        rotate: (mid * 180) / Math.PI + 90,
        short: shortenName(person.name, pool.length > 12 ? 8 : 12),
        fill,
      };
    });
  }, [pool, n]);

  function personAtRotation(deg: number) {
    if (pool.length === 0) return null;
    const normalized = ((-deg % 360) + 360) % 360;
    const index = Math.floor(normalized / slice) % pool.length;
    return pool[index] ?? null;
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
      const under = personAtRotation(value);
      if (under) setPreviewName(under.name);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else {
        rafRef.current = null;
        onDone();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  const spinMut = useMutation({
    mutationFn: () => spinFn({ data: { arenaId, source } }),
    onSuccess: (result) => {
      const index = Math.max(
        0,
        pool.findIndex((row) => row.userId === result.userId),
      );
      const turns = 5 + Math.floor(Math.random() * 3);
      const target = rotationRef.current + turns * 360 + (360 - (index + 0.5) * slice);
      setSpinning(true);
      setPicked(null);
      animateTo(target, 3200, () => {
        setPicked({
          userId: result.userId,
          name: result.name,
          email: result.email,
          avatarId: result.avatarId,
        });
        setPreviewName(result.name);
        setSpinning(false);
        toast.success(`Spun: ${result.name}`);
      });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Spin failed"),
  });

  const splitMut = useMutation({
    mutationFn: () =>
      splitFn({
        data: {
          arenaId,
          teamCount,
          perTeam: perTeam > 0 ? perTeam : null,
          source,
        },
      }),
    onSuccess: (result) => {
      toast.success(`Assigned ${result.assigned} people across ${result.teams.length} teams`);
      void queryClient.invalidateQueries({ queryKey: ["arena-host", arenaId] });
      void queryClient.invalidateQueries({ queryKey: ["arena-player", arenaId] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Split failed"),
  });

  return (
    <section className="surface-paper space-y-4 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Lobby tools</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Spin a participant or randomly split people into teams. {onlineCount}/{pool.length}{" "}
            online in this list.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => setSource("lobby")}
            className={cn(
              "rounded-full px-3 py-1",
              source === "lobby" ? "bg-primary text-primary-foreground" : "bg-secondary",
            )}
          >
            Lobby ({participants.length})
          </button>
          <button
            type="button"
            onClick={() => setSource("all")}
            className={cn(
              "rounded-full px-3 py-1",
              source === "all" ? "bg-primary text-primary-foreground" : "bg-secondary",
            )}
          >
            All users ({directory.length})
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div
              className="absolute left-1/2 top-0 z-10 h-0 w-0 -translate-x-1/2 -translate-y-1 border-l-[10px] border-r-[10px] border-t-[18px] border-l-transparent border-r-transparent border-t-amber-500"
              aria-hidden
            />
            <div
              className="h-56 w-56 rounded-full border-4 border-border shadow-inner"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              {pool.length === 0 ? (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-secondary text-xs text-muted-foreground">
                  No people yet
                </div>
              ) : (
                <svg viewBox="0 0 200 200" className="h-full w-full">
                  <defs>
                    {slices.map((sliceRow, i) => (
                      <linearGradient
                        key={sliceRow.person.userId}
                        id={`arena-wheel-${i}`}
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor={sliceRow.fill[0]} />
                        <stop offset="100%" stopColor={sliceRow.fill[1]} />
                      </linearGradient>
                    ))}
                    <filter id="arena-name-shadow" x="-30%" y="-30%" width="160%" height="160%">
                      <feDropShadow
                        dx="0"
                        dy="1"
                        stdDeviation="1.1"
                        floodColor="#000"
                        floodOpacity="0.5"
                      />
                    </filter>
                    <radialGradient id="arena-hub" cx="35%" cy="30%" r="70%">
                      <stop offset="0%" stopColor="#fef3c7" />
                      <stop offset="60%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#92400e" />
                    </radialGradient>
                  </defs>
                  <circle cx="100" cy="100" r="99" fill="#0f172a" />
                  {slices.map((sliceRow, i) => (
                    <g key={sliceRow.person.userId}>
                      <path
                        d={sliceRow.d}
                        fill={`url(#arena-wheel-${i})`}
                        stroke="#0f172a"
                        strokeWidth="1"
                      />
                      <text
                        x={sliceRow.labelX}
                        y={sliceRow.labelY}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#fff"
                        fontSize={pool.length > 14 ? "6.5" : "8"}
                        fontWeight="800"
                        filter="url(#arena-name-shadow)"
                        transform={`rotate(${sliceRow.rotate} ${sliceRow.labelX} ${sliceRow.labelY})`}
                      >
                        {sliceRow.short}
                      </text>
                    </g>
                  ))}
                  <circle
                    cx="100"
                    cy="100"
                    r="18"
                    fill="url(#arena-hub)"
                    stroke="#fef3c7"
                    strokeWidth="2"
                  />
                </svg>
              )}
            </div>
          </div>

          <div
            className={cn(
              "min-h-10 max-w-[16rem] truncate rounded-full border px-4 py-2 text-center text-sm font-semibold",
              spinning
                ? "border-amber-400/50 bg-amber-500/15 text-amber-900 dark:text-amber-100"
                : picked
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                  : "border-border bg-secondary/60 text-muted-foreground",
            )}
          >
            {spinning && previewName
              ? `Passing · ${previewName}`
              : picked
                ? `Selected · ${picked.name}`
                : "Names stay on the wheel while it spins"}
          </div>

          <button
            type="button"
            disabled={spinMut.isPending || spinning || pool.length === 0}
            onClick={() => spinMut.mutate()}
            className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-60"
          >
            {spinning ? "Spinning…" : "Spin wheel"}
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-xs">
              Number of teams
              <input
                type="number"
                min={1}
                max={32}
                className="field mt-1 h-9 w-full text-sm"
                value={teamCount}
                onChange={(e) => setTeamCount(Number(e.target.value) || 1)}
              />
            </label>
            <label className="block text-xs">
              People per team (0 = even split)
              <input
                type="number"
                min={0}
                max={50}
                className="field mt-1 h-9 w-full text-sm"
                value={perTeam}
                onChange={(e) => setPerTeam(Number(e.target.value) || 0)}
              />
            </label>
          </div>
          <button
            type="button"
            disabled={splitMut.isPending || pool.length === 0}
            onClick={() => splitMut.mutate()}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-60"
          >
            {splitMut.isPending ? "Splitting…" : "Random team split"}
          </button>

          <ul className="max-h-56 space-y-1.5 overflow-auto text-sm">
            {pool.slice(0, 40).map((person) => (
              <li key={person.userId} className="flex items-center gap-2 rounded-md px-1 py-1">
                <UserAvatar
                  avatarId={person.avatarId}
                  name={person.name}
                  size={28}
                  status={person.presence ?? (person.online ? "online" : "offline")}
                />
                <span className="min-w-0 flex-1 truncate">
                  {person.name}
                  {person.teamName ? (
                    <span className="ml-1 text-xs text-muted-foreground">· {person.teamName}</span>
                  ) : null}
                </span>
              </li>
            ))}
            {pool.length > 40 ? (
              <li className="text-xs text-muted-foreground">+{pool.length - 40} more</li>
            ) : null}
            {pool.length === 0 ? (
              <li className="text-xs text-muted-foreground">No people in this list yet.</li>
            ) : null}
          </ul>
        </div>
      </div>
    </section>
  );
}

function shortenName(name: string, max: number) {
  const first = name.trim().split(/\s+/)[0] ?? name.trim();
  if (first.length <= max) return first;
  return `${first.slice(0, Math.max(1, max - 1))}…`;
}
