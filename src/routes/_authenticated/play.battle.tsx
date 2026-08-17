import { PageLoader } from "@/components/platform";
import { beginPlay, getPlayHub, joinBattle, sendBattleInvite } from "@/lib/play.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
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
  const fetchHub = useServerFn(getPlayHub);
  const invite = useServerFn(sendBattleInvite);
  const accept = useServerFn(joinBattle);
  const start = useServerFn(beginPlay);
  const { data } = useQuery({ queryKey: ["play-hub"], queryFn: () => fetchHub() });
  const inviteMut = useMutation({
    mutationFn: () => invite({ data: { email } }),
    onSuccess: () => {
      toast.success("Invite sent");
      setEmail("");
      void queryClient.invalidateQueries({ queryKey: ["play-hub"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Invite failed"),
  });
  const playMut = useMutation({
    mutationFn: (matchId: string) => start({ data: { kind: "battle", matchId } }),
    onSuccess: (result) =>
      navigate({ to: "/play/session/$sessionId", params: { sessionId: result.sessionId } }),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not start"),
  });
  const acceptMut = useMutation({
    mutationFn: (matchId: string) => accept({ data: { matchId } }),
    onSuccess: (result) =>
      navigate({ to: "/play/session/$sessionId", params: { sessionId: result.sessionId } }),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not join"),
  });

  if (!data) return <PageLoader />;

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <Link to="/play" className="text-xs text-accent underline">
        Play
      </Link>
      <h1 className="font-display text-2xl">Battle</h1>
      <p className="text-sm text-muted-foreground">
        Same 15 questions. More correct, then faster, wins.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          inviteMut.mutate();
        }}
      >
        <input
          className="field h-9 flex-1 text-sm"
          type="email"
          placeholder="teammate@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-3 text-sm text-primary-foreground"
        >
          Invite
        </button>
      </form>
      <ul className="space-y-2">
        {data.matches.map((match) => (
          <li
            key={match.id}
            className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
          >
            <span>
              {match.status} · {match.invitee_email ?? "pending"}
            </span>
            {match.status === "pending" ? (
              <button
                type="button"
                className="text-accent"
                onClick={() => acceptMut.mutate(match.id)}
              >
                Accept
              </button>
            ) : match.status === "ready" ? (
              <button
                type="button"
                className="text-accent"
                onClick={() => playMut.mutate(match.id)}
              >
                Play
              </button>
            ) : (
              <span className="text-muted-foreground">Done</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
