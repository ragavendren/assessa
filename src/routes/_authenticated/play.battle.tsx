import { PageLoader } from "@/components/platform";
import {
  beginPlay,
  joinBattle,
  listBattles,
  readyBattleMatch,
  sendBattleInvite,
} from "@/lib/play.functions";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Swords } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/play/battle")({
  head: () => ({ meta: [{ title: "Battle — Assessa" }] }),
  component: BattlePage,
});

function BattlePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const fetchBattles = useServerFn(listBattles);
  const invite = useServerFn(sendBattleInvite);
  const accept = useServerFn(joinBattle);
  const ready = useServerFn(readyBattleMatch);
  const start = useServerFn(beginPlay);

  const { data, isPending } = useQuery({
    queryKey: ["play-battles"],
    queryFn: () => fetchBattles(),
    refetchInterval: 4000,
  });

  const inviteMut = useMutation({
    mutationFn: () => invite({ data: { email } }),
    onSuccess: () => {
      toast.success("Invite sent");
      setEmail("");
      void queryClient.invalidateQueries({ queryKey: ["play-battles"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Invite failed"),
  });

  const acceptMut = useMutation({
    mutationFn: (matchId: string) => accept({ data: { matchId } }),
    onSuccess: () => {
      toast.success("Invite accepted — press Ready when you are set");
      void queryClient.invalidateQueries({ queryKey: ["play-battles"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not accept"),
  });

  const readyMut = useMutation({
    mutationFn: (matchId: string) => ready({ data: { matchId } }),
    onSuccess: (result) => {
      toast.success(result.bothReady ? "Both ready — you can Play" : "You are ready");
      void queryClient.invalidateQueries({ queryKey: ["play-battles"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not ready"),
  });

  const playMut = useMutation({
    mutationFn: (matchId: string) => start({ data: { kind: "battle", matchId } }),
    onSuccess: (result) =>
      navigate({ to: "/play/session/$sessionId", params: { sessionId: result.sessionId } }),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not start"),
  });

  if (isPending || !data) return <PageLoader label="Loading battles…" />;

  const battles = data.battles;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link to="/play" className="text-xs text-accent underline">
        Play
      </Link>
      <header>
        <div className="flex items-center gap-2">
          <Swords className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl">Battle</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Invite a teammate. They accept, both press Ready, then Play starts the same 15 questions.
          More correct, then faster, wins.
        </p>
      </header>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          inviteMut.mutate();
        }}
      >
        <input
          className="field h-10 min-w-[14rem] flex-1 text-sm"
          type="email"
          placeholder="teammate@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={inviteMut.isPending}
          className="rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {inviteMut.isPending ? "Sending…" : "Invite"}
        </button>
      </form>

      {battles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
          No battles yet. Invite someone by email to start a 1v1.
        </div>
      ) : (
        <ul className="space-y-3">
          {battles.map((battle) => (
            <li
              key={battle.id}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{battle.opponentName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {battle.role === "inviter" ? "You invited" : "Invited you"}
                    {battle.opponentEmail ? ` · ${battle.opponentEmail}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <StatusChip phase={battle.phase} />
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      You {battle.myReady ? "ready" : "not ready"}
                    </span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Them {battle.theirReady ? "ready" : "not ready"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {battle.canAccept ? (
                    <button
                      type="button"
                      disabled={acceptMut.isPending}
                      onClick={() => acceptMut.mutate(battle.id)}
                      className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
                    >
                      Accept
                    </button>
                  ) : null}
                  {battle.canReady ? (
                    <button
                      type="button"
                      disabled={readyMut.isPending}
                      onClick={() => readyMut.mutate(battle.id)}
                      className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary disabled:opacity-60"
                    >
                      Ready
                    </button>
                  ) : null}
                  {battle.canPlay ? (
                    <button
                      type="button"
                      disabled={playMut.isPending}
                      onClick={() =>
                        battle.mySessionId
                          ? navigate({
                              to: "/play/session/$sessionId",
                              params: { sessionId: battle.mySessionId },
                            })
                          : playMut.mutate(battle.id)
                      }
                      className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
                    >
                      {battle.mySessionStatus === "in_progress" ? "Continue" : "Play"}
                    </button>
                  ) : battle.phase === "complete" && battle.mySessionId ? (
                    <Link
                      to="/play/results/$sessionId"
                      params={{ sessionId: battle.mySessionId }}
                      className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
                    >
                      Results
                    </Link>
                  ) : battle.phase === "invited" && battle.role === "inviter" ? (
                    <span className="self-center text-xs text-muted-foreground">Waiting for accept</span>
                  ) : battle.phase === "accepted" && battle.myReady ? (
                    <span className="self-center text-xs text-muted-foreground">
                      Waiting for opponent
                    </span>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusChip({
  phase,
}: {
  phase: "invited" | "accepted" | "ready" | "playing" | "complete" | "declined";
}) {
  const label =
    phase === "invited"
      ? "Invited"
      : phase === "accepted"
        ? "Accepted"
        : phase === "ready"
          ? "Both ready"
          : phase === "playing"
            ? "Playing"
            : phase === "complete"
              ? "Complete"
              : "Declined";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        phase === "invited" && "bg-amber-500/15 text-amber-800 dark:text-amber-200",
        phase === "accepted" && "bg-sky-500/15 text-sky-800 dark:text-sky-200",
        phase === "ready" && "bg-teal-500/15 text-teal-800 dark:text-teal-200",
        phase === "playing" && "bg-primary/15 text-primary",
        phase === "complete" && "bg-secondary text-muted-foreground",
        phase === "declined" && "bg-destructive/15 text-destructive",
      )}
    >
      {label}
    </span>
  );
}
