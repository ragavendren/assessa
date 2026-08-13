import { AdminNav } from "@/components/AdminNav";
import { QuestionBankNav } from "@/components/admin/QuestionBankNav";
import { AdminEmpty } from "@/components/admin/AdminPageUi";
import { HelpTip, Panel, QuestionBankPageHeader } from "@/components/admin/pool/QuestionBankUi";
import { PageLoader } from "@/components/platform";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { downloadPoolQuestionCsvTemplate, parsePoolQuestionsCsv } from "@/lib/pool-questions-csv";
import {
  clearPoolQuestions,
  deletePoolQuestions,
  importPoolQuestionsCsv,
  listPoolQuestions,
  listQuestionPools,
  upsertPoolQuestion,
} from "@/lib/pool.functions";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Download, Eraser, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/pools/$poolId")({
  head: () => ({
    meta: [
      { title: "Pool questions — Assessa Admin" },
      { name: "description", content: "Import and manage questions in a pool bank." },
    ],
  }),
  component: AdminPoolDetailPage,
});

type PoolQuestion = Awaited<ReturnType<typeof listPoolQuestions>>["questions"][number];

type TopicBucket = {
  topic: string;
  count: number;
  active: number;
  subtopics: Array<{ name: string; count: number }>;
  difficulty: { easy: number; medium: number; hard: number };
};

function normalizeLabel(value: string | null | undefined, fallback = "general") {
  const trimmed = (value ?? "").trim();
  return trimmed || fallback;
}

function buildInventoryStats(questions: PoolQuestion[]) {
  const byTopic = new Map<
    string,
    {
      count: number;
      active: number;
      subtopics: Map<string, number>;
      difficulty: { easy: number; medium: number; hard: number };
    }
  >();

  let active = 0;
  const difficulty = { easy: 0, medium: 0, hard: 0 };
  const subtopicKeys = new Set<string>();

  for (const question of questions) {
    const topic = normalizeLabel(question.topic);
    const subtopic = normalizeLabel(question.subtopic);
    const diffKey = (
      ["easy", "medium", "hard"].includes(question.difficulty) ? question.difficulty : "medium"
    ) as "easy" | "medium" | "hard";

    if (question.status === "active") active += 1;
    difficulty[diffKey] += 1;

    let bucket = byTopic.get(topic);
    if (!bucket) {
      bucket = {
        count: 0,
        active: 0,
        subtopics: new Map(),
        difficulty: { easy: 0, medium: 0, hard: 0 },
      };
      byTopic.set(topic, bucket);
    }
    bucket.count += 1;
    if (question.status === "active") bucket.active += 1;
    bucket.difficulty[diffKey] += 1;
    bucket.subtopics.set(subtopic, (bucket.subtopics.get(subtopic) ?? 0) + 1);
    if (subtopic.toLowerCase() !== "general") {
      subtopicKeys.add(`${topic}::${subtopic.toLowerCase()}`);
    }
  }

  const topics: TopicBucket[] = [...byTopic.entries()]
    .map(([topic, value]) => ({
      topic,
      count: value.count,
      active: value.active,
      difficulty: value.difficulty,
      subtopics: [...value.subtopics.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));

  return {
    total: questions.length,
    active,
    topicCount: topics.length,
    subtopicCount: subtopicKeys.size,
    difficulty,
    topics,
  };
}

function AdminPoolDetailPage() {
  const { poolId } = Route.useParams();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const fetchQuestions = useServerFn(listPoolQuestions);
  const fetchPools = useServerFn(listQuestionPools);
  const importCsv = useServerFn(importPoolQuestionsCsv);
  const saveQuestion = useServerFn(upsertPoolQuestion);
  const removeQuestions = useServerFn(deletePoolQuestions);
  const clearQuestions = useServerFn(clearPoolQuestions);

  const [search, setSearch] = useState("");
  const [topicFilter, setTopicFilter] = useState<string>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<"all" | "easy" | "medium" | "hard">(
    "all",
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    prompt: "",
    options: ["", "", "", ""],
    correctIndex: 0,
    topic: "general",
    subtopic: "general",
    difficulty: "medium" as "easy" | "medium" | "hard",
  });

  const { data: poolsData } = useQuery({
    queryKey: ["admin-pools"],
    queryFn: () => fetchPools({ data: {} }),
  });
  const pool = (poolsData?.pools ?? []).find((p) => p.id === poolId);

  const { data, isPending } = useQuery({
    queryKey: ["admin-pool-questions", poolId],
    queryFn: () => fetchQuestions({ data: { poolId } }),
  });

  const inventory = useMemo(
    () => buildInventoryStats(data?.questions ?? []),
    [data?.questions],
  );

  const filteredQuestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.questions ?? []).filter((question) => {
      if (topicFilter !== "all" && normalizeLabel(question.topic) !== topicFilter) return false;
      if (difficultyFilter !== "all" && question.difficulty !== difficultyFilter) return false;
      if (!q) return true;
      return (
        question.prompt.toLowerCase().includes(q) ||
        normalizeLabel(question.topic).toLowerCase().includes(q) ||
        normalizeLabel(question.subtopic).toLowerCase().includes(q) ||
        (question.skill ?? "").toLowerCase().includes(q)
      );
    });
  }, [data?.questions, search, topicFilter, difficultyFilter]);

  const filteredIds = useMemo(() => filteredQuestions.map((q) => q.id), [filteredQuestions]);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
  const selectedCount = selectedIds.size;

  useEffect(() => {
    setSelectedIds((prev) => {
      const valid = new Set((data?.questions ?? []).map((q) => q.id));
      const next = new Set([...prev].filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [data?.questions]);

  const importMutation = useMutation({
    mutationFn: (csvText: string) => importCsv({ data: { poolId, csvText } }),
    onSuccess: (result) => {
      if (result.imported > 0) {
        toast.success(`Imported ${result.imported} question(s)`);
      } else {
        toast.error(result.errors[0] ?? "No questions imported");
      }
      if (result.imported > 0 && result.errors.length) {
        toast.message(
          `${result.errors.length} row(s) skipped: ${result.errors.slice(0, 2).join("; ")}`,
        );
      }
      queryClient.invalidateQueries({ queryKey: ["admin-pool-questions", poolId] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Import failed. Check the CSV format."),
  });

  const addMutation = useMutation({
    mutationFn: () => {
      const options = draft.options.map((o) => o.trim()).filter(Boolean);
      if (draft.prompt.trim().length < 4) throw new Error("Prompt must be at least 4 characters");
      if (options.length < 2) throw new Error("Add at least two options");
      const correctIndex = Math.min(draft.correctIndex, options.length - 1);
      return saveQuestion({
        data: {
          poolId,
          prompt: draft.prompt.trim(),
          options,
          correct_indexes: [correctIndex],
          multi_select: false,
          topic: draft.topic.trim() || "general",
          subtopic: draft.subtopic.trim() || "general",
          difficulty: draft.difficulty,
        },
      });
    },
    onSuccess: () => {
      toast.success("Question added");
      setDraft({
        prompt: "",
        options: ["", "", "", ""],
        correctIndex: 0,
        topic: topicFilter !== "all" ? topicFilter : "general",
        subtopic: "general",
        difficulty: difficultyFilter !== "all" ? difficultyFilter : "medium",
      });
      setAdding(false);
      queryClient.invalidateQueries({ queryKey: ["admin-pool-questions", poolId] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not add question"),
  });

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        for (const id of filteredIds) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of filteredIds) next.add(id);
      return next;
    });
  }

  async function deleteSelected() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const ok = await confirm({
      title: `Delete ${ids.length} question${ids.length === 1 ? "" : "s"}?`,
      description: "Removes selected bank items. Existing exam clones are kept.",
      confirmLabel: "Delete selected",
      tone: "destructive",
    });
    if (!ok) return;
    try {
      const result = await removeQuestions({ data: { poolId, ids } });
      toast.success(`Deleted ${result.deleted} question${result.deleted === 1 ? "" : "s"}`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["admin-pool-questions", poolId] });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not delete");
    }
  }

  return (
    <div>
      <AdminNav />
      <QuestionBankNav />
      <div className="mb-2">
        <Link to="/admin/pools" className="text-sm text-muted-foreground hover:underline">
          ← Question pools
        </Link>
      </div>
      <QuestionBankPageHeader
        title={pool?.name ?? "Pool questions"}
        summary="CSV import or add single questions. Topics must match blueprint rules."
        help={{
          label: "CSV tips",
          body: (
            <span>
              Correct answers: A–F or 1–6. Difficulty: easy, medium, or hard. Assessment CSV on New
              assessment is a different flow.
            </span>
          ),
        }}
      />

      {/* Compact import bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-border bg-card px-3 py-2.5">
        <p className="mr-auto text-xs text-muted-foreground">
          Import CSV
          <HelpTip label="What gets imported" className="ml-1">
            Prompt, options, answers, topic, subtopic, difficulty, skill, tags, explanation, and
            marks. Keep the header row from the template.
          </HelpTip>
        </p>
        <button
          type="button"
          onClick={() => downloadPoolQuestionCsvTemplate()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs hover:bg-secondary"
        >
          <Download className="h-3.5 w-3.5" /> Template
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={importMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          <Upload className="h-3.5 w-3.5" />{" "}
          {importMutation.isPending ? "Importing…" : "Import"}
        </button>
        {(data?.questions.length ?? 0) > 0 ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10"
            onClick={() => {
              void (async () => {
                const ok = await confirm({
                  title: "Clear all pool questions?",
                  description:
                    "This permanently removes every question in this pool. Existing exam clones are kept.",
                  confirmLabel: "Clear all",
                  tone: "destructive",
                });
                if (!ok) return;
                try {
                  const result = await clearQuestions({ data: { poolId } });
                  toast.success(`Cleared ${result.deleted} question(s)`);
                  queryClient.invalidateQueries({ queryKey: ["admin-pool-questions", poolId] });
                } catch (error: unknown) {
                  toast.error(error instanceof Error ? error.message : "Could not clear pool");
                }
              })();
            }}
          >
            <Eraser className="h-3.5 w-3.5" /> Clear
          </button>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void file.text().then((text) => {
              const { questions, errors } = parsePoolQuestionsCsv(text);
              if (questions.length === 0) {
                toast.error(
                  errors.slice(0, 3).join(" · ") ||
                    "No valid rows. Keep the header row from the pool template.",
                );
                return;
              }
              if (errors.length) {
                toast.message(`${errors.length} row(s) will be skipped`);
              }
              importMutation.mutate(text);
            });
            e.target.value = "";
          }}
        />
      </div>

      {isPending || !data ? (
        <PageLoader />
      ) : data.questions.length === 0 && !adding ? (
        <Panel title="Pool inventory" description="Import a CSV or add a single question.">
          <AdminEmpty title="No questions yet" body="Use Template + Import above, or add one below." />
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> Add question
          </button>
        </Panel>
      ) : data.questions.length === 0 && adding ? (
        <Panel
          title="Add question"
          action={
            <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => setAdding(false)}>
              Cancel
            </button>
          }
        >
          <AddQuestionForm
            draft={draft}
            setDraft={setDraft}
            topics={inventory.topics.map((t) => t.topic)}
            pending={addMutation.isPending}
            onSubmit={() => addMutation.mutate()}
            onCancel={() => setAdding(false)}
          />
        </Panel>
      ) : (
        <div className="grid min-h-0 gap-3 lg:h-[calc(100vh-12.5rem)] lg:grid-cols-[minmax(15rem,19rem)_minmax(0,1fr)] lg:items-stretch">
          {/* Coverage sidebar */}
          <aside className="surface-paper flex min-h-0 flex-col overflow-hidden p-3">
            <div className="mb-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-semibold">Coverage</h3>
                <HelpTip label="Topic matching">
                  Click a topic to filter. Subtopics expand when selected.
                </HelpTip>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums text-muted-foreground">
                <span>
                  <strong className="text-foreground">{inventory.total}</strong> Q
                </span>
                <span>
                  <strong className="text-foreground">{inventory.active}</strong> active
                </span>
                <span>
                  <strong className="text-foreground">{inventory.topicCount}</strong> topics
                </span>
                <span>
                  <strong className="text-foreground">{inventory.subtopicCount}</strong> subs
                </span>
              </div>
              <div className="mt-2 flex gap-1 text-[10px] font-semibold tabular-nums text-muted-foreground">
                {(
                  [
                    ["E", inventory.difficulty.easy, "easy"],
                    ["M", inventory.difficulty.medium, "medium"],
                    ["H", inventory.difficulty.hard, "hard"],
                  ] as const
                ).map(([mark, count, key]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      setDifficultyFilter((current) => (current === key ? "all" : key))
                    }
                    className={cn(
                      "inline-flex flex-1 items-center justify-center gap-1 rounded-md px-1.5 py-1 transition-colors",
                      difficultyFilter === key
                        ? "bg-primary/15 text-foreground"
                        : "bg-secondary/80 hover:bg-secondary",
                    )}
                    title={`Filter ${key}`}
                  >
                    {mark} {count}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 max-h-[40vh] flex-1 space-y-1 overflow-y-auto pr-1 lg:max-h-none">
              <button
                type="button"
                onClick={() => setTopicFilter("all")}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                  topicFilter === "all"
                    ? "bg-primary/10 font-semibold text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60",
                )}
              >
                <span>All topics</span>
                <span className="tabular-nums">{inventory.total}</span>
              </button>
              {inventory.topics.map((bucket) => {
                const selected = topicFilter === bucket.topic;
                const namedSubs = bucket.subtopics.filter(
                  (s) => s.name.toLowerCase() !== "general",
                );
                return (
                  <div key={bucket.topic} className="space-y-1">
                    <button
                      type="button"
                      onClick={() =>
                        setTopicFilter((current) =>
                          current === bucket.topic ? "all" : bucket.topic,
                        )
                      }
                      className={cn(
                        "flex w-full items-start justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                        selected
                          ? "bg-primary/10 ring-1 ring-primary/25"
                          : "hover:bg-secondary/60",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">{bucket.topic}</p>
                        <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                          E{bucket.difficulty.easy} · M{bucket.difficulty.medium} · H
                          {bucket.difficulty.hard}
                          {namedSubs.length > 0 ? ` · ${namedSubs.length} sub` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold tabular-nums">
                        {bucket.count}
                      </span>
                    </button>
                    {selected && namedSubs.length > 0 ? (
                      <div className="ml-2 flex flex-wrap gap-1 border-l border-border pl-2">
                        {namedSubs.map((sub) => (
                          <span
                            key={sub.name}
                            className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-secondary/70 px-2 py-0.5 text-[10px]"
                          >
                            <span className="truncate">{sub.name}</span>
                            <span className="tabular-nums text-muted-foreground">{sub.count}</span>
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Questions pane */}
          <section className="surface-paper flex min-h-0 flex-col overflow-hidden p-3">
            <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">Questions</h3>
              <p className="text-xs tabular-nums text-muted-foreground">
                {filteredQuestions.length === inventory.total
                  ? inventory.total
                  : `${filteredQuestions.length}/${inventory.total}`}
                {topicFilter !== "all" ? ` · ${topicFilter}` : ""}
                {difficultyFilter !== "all" ? ` · ${difficultyFilter}` : ""}
              </p>

              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setDraft((d) => ({
                      ...d,
                      topic: topicFilter !== "all" ? topicFilter : d.topic,
                      difficulty: difficultyFilter !== "all" ? difficultyFilter : d.difficulty,
                    }));
                    setAdding((v) => !v);
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-secondary"
                >
                  {adding ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  {adding ? "Close" : "Add"}
                </button>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  disabled={filteredIds.length === 0}
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-secondary disabled:opacity-50"
                >
                  {allFilteredSelected ? "Clear" : "Select all"}
                </button>
                <button
                  type="button"
                  onClick={() => void deleteSelected()}
                  disabled={selectedCount === 0}
                  className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete{selectedCount > 0 ? ` (${selectedCount})` : ""}
                </button>
              </div>
            </div>

            <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2">
              <label className="relative min-w-0 flex-1 basis-40">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="field h-8 w-full py-1 pl-8 text-xs"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              {(topicFilter !== "all" || difficultyFilter !== "all" || search) && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:underline"
                  onClick={() => {
                    setTopicFilter("all");
                    setDifficultyFilter("all");
                    setSearch("");
                  }}
                >
                  Reset
                </button>
              )}
            </div>

            {adding ? (
              <div className="mb-2 shrink-0 rounded-md border border-border bg-secondary/20 p-3">
                <AddQuestionForm
                  draft={draft}
                  setDraft={setDraft}
                  topics={inventory.topics.map((t) => t.topic)}
                  pending={addMutation.isPending}
                  onSubmit={() => addMutation.mutate()}
                  onCancel={() => setAdding(false)}
                />
              </div>
            ) : null}

            <div className="min-h-0 max-h-[55vh] flex-1 overflow-y-auto pr-1 lg:max-h-none">
              {filteredQuestions.length === 0 ? (
                <AdminEmpty title="No matching questions" body="Reset filters or add a question." />
              ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
                  {filteredQuestions.map((q) => {
                    const topic = normalizeLabel(q.topic);
                    const subtopic = normalizeLabel(q.subtopic);
                    const showTopic = topicFilter === "all";
                    const checked = selectedIds.has(q.id);
                    const expanded = expandedId === q.id;
                    const options = normalizeOptions(q.options);
                    const correct = new Set(correctIndexesFor(q));
                    return (
                      <li
                        key={q.id}
                        className={cn(
                          "px-2.5 py-2 hover:bg-secondary/30",
                          checked && "bg-primary/5",
                          expanded && "bg-secondary/20",
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-1 h-3.5 w-3.5 shrink-0 accent-[var(--primary)]"
                            checked={checked}
                            onChange={() => toggleSelect(q.id)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Select question"
                          />
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() =>
                              setExpandedId((current) => (current === q.id ? null : q.id))
                            }
                            aria-expanded={expanded}
                          >
                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <p
                                  className={cn(
                                    "text-sm leading-snug",
                                    !expanded && "line-clamp-2",
                                  )}
                                >
                                  {q.prompt}
                                </p>
                                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                                  <span
                                    className={cn(
                                      "capitalize",
                                      q.status !== "active" && "text-destructive",
                                    )}
                                  >
                                    {q.status === "active"
                                      ? q.difficulty
                                      : `${q.status} · ${q.difficulty}`}
                                  </span>
                                  {showTopic ? <span>· {topic}</span> : null}
                                  {subtopic.toLowerCase() !== "general" ? (
                                    <span>· {subtopic}</span>
                                  ) : null}
                                  <span className="text-muted-foreground/80">
                                    · {expanded ? "Hide" : "Options"}
                                  </span>
                                </div>
                              </div>
                              <ChevronDown
                                className={cn(
                                  "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                                  expanded && "rotate-180",
                                )}
                                aria-hidden
                              />
                            </div>
                          </button>
                        </div>

                        {expanded ? (
                          <div className="mt-2 ml-6 space-y-1.5 border-l border-border pl-3">
                            {options.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No options stored.</p>
                            ) : (
                              options.map((option, index) => {
                                const isCorrect = correct.has(index);
                                return (
                                  <div
                                    key={`${q.id}-${index}`}
                                    className={cn(
                                      "rounded-md border px-2.5 py-1.5 text-xs",
                                      isCorrect
                                        ? "border-success/40 bg-success/10 text-foreground"
                                        : "border-border/70 bg-background text-muted-foreground",
                                    )}
                                  >
                                    <span className="mr-1.5 font-semibold tabular-nums text-foreground">
                                      {String.fromCharCode(65 + index)}.
                                    </span>
                                    {option}
                                    {isCorrect ? (
                                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-success">
                                        Answer
                                      </span>
                                    ) : null}
                                  </div>
                                );
                              })
                            )}
                            {q.explanation ? (
                              <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
                                <span className="font-medium text-foreground">Explanation: </span>
                                {q.explanation}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

type QuestionDraft = {
  prompt: string;
  options: string[];
  correctIndex: number;
  topic: string;
  subtopic: string;
  difficulty: "easy" | "medium" | "hard";
};

function normalizeOptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function correctIndexesFor(question: PoolQuestion): number[] {
  if (Array.isArray(question.correct_indexes) && question.correct_indexes.length > 0) {
    return question.correct_indexes.filter((n) => typeof n === "number");
  }
  if (typeof question.correct_index === "number") return [question.correct_index];
  return [];
}

function AddQuestionForm({
  draft,
  setDraft,
  topics,
  pending,
  onSubmit,
  onCancel,
}: {
  draft: QuestionDraft;
  setDraft: Dispatch<SetStateAction<QuestionDraft>>;
  topics: string[];
  pending: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <form
      className="space-y-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div>
        <label className="mb-1 block text-[11px] text-muted-foreground">Prompt *</label>
        <textarea
          className="field min-h-[4.5rem] w-full text-sm"
          value={draft.prompt}
          onChange={(e) => setDraft((d) => ({ ...d, prompt: e.target.value }))}
          required
          maxLength={4000}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {draft.options.map((option, index) => (
          <label key={index} className="flex items-center gap-2">
            <input
              type="radio"
              name="correct"
              checked={draft.correctIndex === index}
              onChange={() => setDraft((d) => ({ ...d, correctIndex: index }))}
              className="accent-[var(--primary)]"
              title="Mark as correct"
            />
            <input
              className="field h-8 flex-1 text-xs"
              placeholder={`Option ${String.fromCharCode(65 + index)}${index < 2 ? " *" : ""}`}
              value={option}
              onChange={(e) =>
                setDraft((d) => {
                  const options = [...d.options];
                  options[index] = e.target.value;
                  return { ...d, options };
                })
              }
              required={index < 2}
            />
          </label>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">Topic</label>
          <input
            className="field h-8 w-full text-xs"
            list="pool-add-topics"
            value={draft.topic}
            onChange={(e) => setDraft((d) => ({ ...d, topic: e.target.value }))}
          />
          <datalist id="pool-add-topics">
            {topics.map((topic) => (
              <option key={topic} value={topic} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">Subtopic</label>
          <input
            className="field h-8 w-full text-xs"
            value={draft.subtopic}
            onChange={(e) => setDraft((d) => ({ ...d, subtopic: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">Difficulty</label>
          <select
            className="field h-8 w-full text-xs"
            value={draft.difficulty}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                difficulty: e.target.value as "easy" | "medium" | "hard",
              }))
            }
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save question"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
        >
          Cancel
        </button>
        <p className="self-center text-[11px] text-muted-foreground">
          Select the radio next to the correct option.
        </p>
      </div>
    </form>
  );
}
