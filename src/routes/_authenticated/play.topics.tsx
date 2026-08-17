import { PageLoader } from "@/components/platform";
import { PlayLeaderboardPanel } from "@/components/play/PlayLeaderboardPanel";
import { beginPlay, getPlayCatalog } from "@/lib/play.functions";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/play/topics")({
  validateSearch: z.object({
    courseId: z.string().uuid().optional(),
  }),
  head: () => ({ meta: [{ title: "Topic Challenge — Assessa" }] }),
  component: TopicChallengePage,
});

function TopicChallengePage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { courseId: searchCourseId } = Route.useSearch();
  const fetchCatalog = useServerFn(getPlayCatalog);
  const start = useServerFn(beginPlay);
  const { data, isPending } = useQuery({
    queryKey: ["play-catalog", "topic", searchCourseId ?? ""],
    queryFn: () =>
      fetchCatalog({
        data: { kind: "topic", ...(searchCourseId ? { courseId: searchCourseId } : {}) },
      }),
  });
  const [topic, setTopic] = useState<string | null>(null);
  const [count, setCount] = useState<10 | 15 | 20>(10);
  const [poolId, setPoolId] = useState<string | null>(null);
  const courseId = searchCourseId ?? data?.pools[0]?.courseId ?? null;

  const startMut = useMutation({
    mutationFn: () =>
      start({
        data: {
          kind: "topic",
          poolId,
          topic,
          questionCount: count,
          ...(courseId ? { courseId } : {}),
        },
      }),
    onSuccess: (result) =>
      navigate({ to: "/play/session/$sessionId", params: { sessionId: result.sessionId } }),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not start"),
  });

  if (isPending || !data) return <PageLoader />;

  return (
    <div className="space-y-6">
      <header>
        <Link
          to="/play"
          search={{ courseId: courseId ?? undefined }}
          className="text-xs text-accent underline"
        >
          Play
        </Link>
        <h1 className="font-display text-2xl">Topic Challenge</h1>
        <p className="text-sm text-muted-foreground">Choose a pool topic and a length.</p>
      </header>
      {data.enabled === false ? (
        <p className="text-sm text-muted-foreground">
          Topic Challenge is turned off. Ask an admin to enable it in Play control.
        </p>
      ) : data.pools.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No pool questions yet. Ask an admin to import a bank.
        </p>
      ) : (
        data.pools.map((pool) => (
          <section key={pool.id} className="surface-paper rounded-xl p-4">
            <p className="text-sm font-semibold">
              {pool.courseName} · {pool.name}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {pool.topics.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setTopic(item.label);
                    setPoolId(pool.id);
                  }}
                  className={
                    topic === item.label && poolId === pool.id
                      ? "rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground"
                      : "rounded-full border border-border px-3 py-1 text-xs"
                  }
                >
                  {item.label} ({item.count})
                </button>
              ))}
            </div>
          </section>
        ))
      )}
      {topic && courseId ? (
        <>
          <section className="flex flex-wrap items-center gap-2">
            {([10, 15, 20] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCount(n)}
                className={
                  count === n
                    ? "rounded-md bg-secondary px-3 py-1.5 text-sm font-medium"
                    : "rounded-md border border-border px-3 py-1.5 text-sm"
                }
              >
                {n} questions
              </button>
            ))}
            <button
              type="button"
              disabled={startMut.isPending}
              onClick={() => startMut.mutate()}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
            >
              Start {topic}
            </button>
          </section>
          <section className="surface-paper rounded-xl p-4">
            <h2 className="text-sm font-semibold">Leaderboard · {topic}</h2>
            <div className="mt-3">
              <PlayLeaderboardPanel
                kind="topic"
                courseId={courseId}
                courseName={data.pools.find((p) => p.id === poolId)?.courseName ?? "Course"}
                topic={topic}
                limit={10}
              />
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
