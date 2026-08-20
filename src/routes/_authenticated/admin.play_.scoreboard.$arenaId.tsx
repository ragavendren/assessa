import { AdminAccessDenied } from "@/components/admin/AdminPageUi";
import { ArenaScoreboard } from "@/components/play/ArenaScoreboard";
import { PageLoader } from "@/components/platform";
import { useArenaRealtime } from "@/hooks/use-arena-realtime";
import { getArenaHost } from "@/lib/play.functions";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/play_/scoreboard/$arenaId")({
  head: () => ({ meta: [{ title: "Arena Scoreboard — Assessa" }] }),
  component: ArenaUndockedBoardPage,
});

function ArenaUndockedBoardPage() {
  const { arenaId } = Route.useParams();
  const fetchHost = useServerFn(getArenaHost);
  useArenaRealtime(arenaId);
  const { data, isPending, error } = useQuery({
    queryKey: ["arena-host", arenaId],
    queryFn: () => fetchHost({ data: { arenaId } }),
    refetchInterval: 2500,
    retry: false,
  });
  const [tab, setTab] = useState<"overall" | number>("overall");

  const segmentBoards = useMemo(
    () => data?.board.allSegmentBoards ?? [],
    [data?.board.allSegmentBoards],
  );

  if (isPending) return <PageLoader label="Loading scoreboard…" />;
  if (error || !data) return <AdminAccessDenied />;

  const { arena, board } = data;
  const activeRows =
    tab === "overall" ? board.rows : (segmentBoards.find((row) => row.segment === tab)?.rows ?? []);
  const activeWinner =
    tab === "overall" ? null : (board.segmentWinners.find((row) => row.segment === tab) ?? null);

  return (
    <div className="flex min-h-screen flex-col bg-background px-4 py-5 sm:px-8">
      <header className="mx-auto mb-5 w-full max-w-6xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Audience scoreboard
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl sm:text-5xl">{arena.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="capitalize">{arena.status}</span>
              {" · "}Q {Math.min(arena.currentIndex + 1, arena.totalQuestions)}/
              {arena.totalQuestions}
              {arena.publishedThroughSegment >= 0
                ? ` · published through S${arena.publishedThroughSegment + 1}`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <TabBtn active={tab === "overall"} onClick={() => setTab("overall")} label="Overall" />
            {segmentBoards.map((seg) => (
              <TabBtn
                key={seg.segment}
                active={tab === seg.segment}
                onClick={() => setTab(seg.segment)}
                label={`S${seg.segment + 1}`}
              />
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1">
        <ArenaScoreboard
          rows={activeRows}
          currentSegmentWinner={activeWinner}
          segmentWinners={board.segmentWinners}
          champion={tab === "overall" ? board.champion : null}
          visible
          showSegmentColumn={tab === "overall"}
          showDetailColumns
          dense
          undockMode="dock"
          onDock={() => {
            window.close();
            window.setTimeout(() => {
              window.location.assign(`/admin/play/arena/${arenaId}`);
            }, 150);
          }}
          answerLedger={data.answerLedger}
          ledgerSegment={tab === "overall" ? null : tab}
          title={tab === "overall" ? "Cumulative overall" : `Segment ${(tab as number) + 1}`}
          emptyHint="Scores appear after questions are revealed."
        />
      </div>
    </div>
  );
}

function TabBtn({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-sm",
        active
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-card text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
}
