import { PlayLobbyList } from "@/components/play/PlayLobbyList";
import { PageLoader } from "@/components/platform";
import { joinPlayPulseByCode, listPlayPulses, resolvePulseCode } from "@/lib/play.pulse.functions";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/play/pulse")({
  validateSearch: z.object({
    code: z.string().optional(),
  }),
  head: () => ({ meta: [{ title: "Pulse — Assessa" }] }),
  component: PulseListPage,
});

function PulseListPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [code, setCode] = useState(search.code ?? "");
  const listFn = useServerFn(listPlayPulses);
  const joinByCode = useServerFn(joinPlayPulseByCode);
  const resolveCode = useServerFn(resolvePulseCode);

  const { data, isPending } = useQuery({
    queryKey: ["play-pulses"],
    queryFn: () => listFn(),
  });

  const joinMut = useMutation({
    mutationFn: async (raw: string) => {
      const resolved = await resolveCode({ data: { code: raw } });
      await joinByCode({ data: { code: raw } });
      return resolved.pulseId;
    },
    onSuccess: (pulseId) => {
      toast.success("Joined Pulse");
      void navigate({ to: "/play/pulse/$pulseId", params: { pulseId } });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not join"),
  });

  const items = useMemo(() => {
    if (!data?.pulses) return [];
    return data.pulses.map((row) => ({
      id: row.id,
      title: row.name,
      meta: `Code ${row.joinCode} · ${row.status}`,
      statusLabel:
        row.status === "prompt" || row.status === "results"
          ? "Live"
          : row.status === "lobby"
            ? "Lobby"
            : row.status,
      statusTone: (row.status === "prompt" || row.status === "results"
        ? "live"
        : row.status === "lobby"
          ? "lobby"
          : "neutral") as "live" | "lobby" | "neutral",
      to: "/play/pulse/$pulseId",
      params: { pulseId: row.id },
    }));
  }, [data?.pulses]);

  if (isPending || !data) return <PageLoader label="Loading pulses…" />;

  return (
    <div className="space-y-6">
      <PlayLobbyList
        title="Pulse"
        blurb="Join a live slide session with a link or 6-character code. Answer MCQ, text, or rating prompts and watch the shared wall."
        empty="No published pulses right now. Ask a host for a join code."
        items={items}
        headerAction={
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) joinMut.mutate(code.trim());
            }}
          >
            <label className="sr-only" htmlFor="pulse-code">
              Join code
            </label>
            <input
              id="pulse-code"
              className="field h-9 w-36 font-mono text-sm uppercase tracking-widest"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="CODE"
              maxLength={6}
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={joinMut.isPending || code.trim().length < 4}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {joinMut.isPending ? "Joining…" : "Join code"}
            </button>
          </form>
        }
      />
    </div>
  );
}
