import { PageLoader } from "@/components/platform";
import { FlashCardDeck } from "@/components/play/FlashCardDeck";
import { getFlashDeck, getPlayCatalog, saveFlashCard } from "@/lib/play.functions";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, GraduationCap, Layers } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/play/flash")({
  validateSearch: z.object({
    courseId: z.string().uuid().optional(),
  }),
  head: () => ({ meta: [{ title: "Flash cards — Assessa" }] }),
  component: FlashPage,
});

function FlashPage() {
  const queryClient = useQueryClient();
  const { courseId: searchCourseId } = Route.useSearch();
  const fetchCatalog = useServerFn(getPlayCatalog);
  const fetchDeck = useServerFn(getFlashDeck);
  const mark = useServerFn(saveFlashCard);
  const [courseId, setCourseId] = useState<string | null>(searchCourseId ?? null);
  const [topic, setTopic] = useState<string | "all" | null>(null);
  const [started, setStarted] = useState(false);

  const { data: catalog, isPending: catalogPending } = useQuery({
    queryKey: ["play-catalog", "flash"],
    queryFn: () => fetchCatalog({ data: { kind: "flash" } }),
  });

  const pools = catalog?.pools ?? [];
  const courses = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        questionCount: number;
        topics: Array<{ label: string; count: number }>;
      }
    >();
    for (const pool of pools) {
      const current = map.get(pool.courseId) ?? {
        id: pool.courseId,
        name: pool.courseName,
        questionCount: 0,
        topics: [],
      };
      current.questionCount += pool.questionCount;
      for (const item of pool.topics) {
        const existing = current.topics.find((t) => t.label === item.label);
        if (existing) existing.count += item.count;
        else current.topics.push({ ...item });
      }
      map.set(pool.courseId, current);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [pools]);

  useEffect(() => {
    if (!courseId && courses.length === 1) setCourseId(courses[0]!.id);
  }, [courseId, courses]);

  useEffect(() => {
    if (topic !== null) return;
    const course = courses.find((c) => c.id === courseId);
    if (course?.topics.length === 1) setTopic(course.topics[0]!.label);
  }, [courseId, courses, topic]);

  const selectedCourse = courses.find((c) => c.id === courseId) ?? null;
  const coursePools = pools.filter((p) => p.courseId === courseId);
  const pool =
    coursePools.find((p) =>
      topic && topic !== "all" ? p.topics.some((t) => t.label === topic) : p.questionCount > 0,
    ) ?? coursePools[0];
  const topics = selectedCourse?.topics ?? [];
  const topicFilter = topic === "all" || topic === null ? null : topic;
  const canStart = Boolean(courseId && topic !== null);

  const { data, isPending } = useQuery({
    queryKey: ["flash", pool?.id, topicFilter, courseId],
    queryFn: () =>
      fetchDeck({
        data: {
          poolId: pool!.id,
          topic: topicFilter,
          courseId,
        },
      }),
    enabled: Boolean(started && pool?.id && canStart),
  });

  const markMut = useMutation({
    mutationFn: ({ known, questionId }: { known: boolean; questionId: string }) =>
      mark({ data: { questionId, known } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["flash"] });
    },
  });

  const cards = data?.cards ?? [];

  if (catalogPending || !catalog) return <PageLoader />;
  if (catalog.enabled === false) {
    return (
      <p className="text-sm text-muted-foreground">
        Flash cards are turned off. Ask an admin to enable them in Play control.{" "}
        <Link to="/play">Back</Link>
      </p>
    );
  }
  if (courses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No courses are configured for flash cards yet. <Link to="/play">Back</Link>
      </p>
    );
  }

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
        <div className="mt-2 flex items-center gap-2">
          <Layers className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl">Flash cards</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Choose a course, then a topic, then start the deck.
        </p>
      </header>

      {started && selectedCourse && canStart ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">
              <span className="font-medium">{selectedCourse.name}</span>
              <span className="text-muted-foreground">
                {" "}
                · {topic === "all" ? "All topics" : topic}
              </span>
            </p>
            <button
              type="button"
              onClick={() => setStarted(false)}
              className="inline-flex items-center gap-1 text-xs text-accent underline"
            >
              <ArrowLeft className="h-3 w-3" />
              Change course or topic
            </button>
          </div>
          {isPending ? (
            <PageLoader label="Loading deck…" />
          ) : cards.length === 0 ? (
            <div className="surface-paper rounded-xl p-8 text-center text-sm text-muted-foreground">
              No flash cards in this deck. Add explanations to pool questions, or pick another
              topic.
            </div>
          ) : (
            <FlashCardDeck
              key={`${pool?.id ?? ""}-${topic ?? "all"}`}
              cards={[...cards]}
              marking={markMut.isPending}
              onMark={(known, questionId) => markMut.mutate({ known, questionId })}
            />
          )}
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              1. Course
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {courses.map((course) => (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => {
                    setCourseId(course.id);
                    setTopic(course.topics.length === 1 ? course.topics[0]!.label : null);
                    setStarted(false);
                  }}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-colors",
                    courseId === course.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-secondary",
                  )}
                >
                  <p className="flex items-center gap-2 font-medium">
                    <GraduationCap className="h-4 w-4 text-primary" />
                    {course.name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {course.topics.length} topics · {course.questionCount} questions
                  </p>
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              2. Topic
            </p>
            {!selectedCourse ? (
              <p className="text-sm text-muted-foreground">Select a course first.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {topics.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setTopic("all")}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm",
                      topic === "all"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-secondary",
                    )}
                  >
                    All topics
                  </button>
                ) : null}
                {topics.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setTopic(item.label)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm",
                      topic === item.label
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-secondary",
                    )}
                  >
                    {item.label} ({item.count})
                  </button>
                ))}
              </div>
            )}
          </section>

          <button
            type="button"
            disabled={!canStart}
            onClick={() => setStarted(true)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Start reviewing
          </button>
        </div>
      )}
    </div>
  );
}
