import { UserAvatar } from "@/components/UserAvatar";
import { splitArenaTeams, spinArenaParticipant } from "@/lib/play.functions";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
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

  const pool = source === "lobby" ? participants : directory;
  const onlineCount = pool.filter((row) => row.online).length;

  const spinMut = useMutation({
    mutationFn: () => spinFn({ data: { arenaId, source } }),
    onSuccess: async (result) => {
      const index = Math.max(
        0,
        pool.findIndex((row) => row.userId === result.userId),
      );
      const slice = pool.length ? 360 / pool.length : 360;
      const turns = 4 + Math.floor(Math.random() * 3);
      setSpinning(true);
      setRotation((prev) => prev + turns * 360 + (360 - index * slice) + slice / 2);
      window.setTimeout(() => {
        setPicked({
          userId: result.userId,
          name: result.name,
          email: result.email,
          avatarId: result.avatarId,
        });
        setSpinning(false);
        toast.success(`Spun: ${result.name}`);
      }, 2800);
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

  const wheelColors = useMemo(
    () => ["#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#ef4444", "#14b8a6", "#f97316", "#6366f1"],
    [],
  );

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
            <div className="absolute left-1/2 top-0 z-10 h-0 w-0 -translate-x-1/2 -translate-y-1 border-l-8 border-r-8 border-t-[14px] border-l-transparent border-r-transparent border-t-foreground" />
            <div
              className="h-52 w-52 rounded-full border-4 border-border shadow-inner transition-transform duration-[2800ms] ease-out"
              style={{
                transform: `rotate(${rotation}deg)`,
                background:
                  pool.length === 0
                    ? "var(--secondary)"
                    : `conic-gradient(${pool
                        .map(
                          (_, index) =>
                            `${wheelColors[index % wheelColors.length]} ${(index / pool.length) * 100}% ${((index + 1) / pool.length) * 100}%`,
                        )
                        .join(", ")})`,
              }}
            />
          </div>
          <button
            type="button"
            disabled={spinMut.isPending || spinning || pool.length === 0}
            onClick={() => spinMut.mutate()}
            className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-60"
          >
            {spinning ? "Spinning…" : "Spin wheel"}
          </button>
          {picked ? (
            <p className="text-center text-sm">
              Selected: <span className="font-semibold">{picked.name}</span>
            </p>
          ) : null}
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
