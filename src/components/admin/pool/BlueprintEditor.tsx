import { PageLoader } from "@/components/platform";
import {
  getBlueprint,
  listCoursePoolTopics,
  listCourses,
  upsertBlueprint,
} from "@/lib/pool.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";

import { FieldLabel, HelpTip, Panel } from "./QuestionBankUi";

type RuleForm = {
  topic: string;
  subtopic: string;
  weightage: number;
  min_questions: number;
  max_questions: string;
  easy_percentage: number;
  medium_percentage: number;
  hard_percentage: number;
};

const blankRule = (): RuleForm => ({
  topic: "",
  subtopic: "",
  weightage: 25,
  min_questions: 1,
  max_questions: "",
  easy_percentage: 30,
  medium_percentage: 50,
  hard_percentage: 20,
});

export function BlueprintEditor({
  mode,
  blueprintId,
}: {
  mode: "create" | "edit";
  blueprintId?: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchCourses = useServerFn(listCourses);
  const fetchBlueprint = useServerFn(getBlueprint);
  const fetchPoolTopics = useServerFn(listCoursePoolTopics);
  const saveBlueprint = useServerFn(upsertBlueprint);
  const listId = useId();

  const { data: coursesData, isPending: coursesPending } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: () => fetchCourses(),
  });

  const { data: existing, isPending: existingPending } = useQuery({
    queryKey: ["admin-blueprint", blueprintId],
    queryFn: () => fetchBlueprint({ data: { id: blueprintId! } }),
    enabled: mode === "edit" && Boolean(blueprintId),
  });

  const courses = coursesData?.courses ?? [];

  const [courseId, setCourseId] = useState("");
  const [name, setName] = useState("");
  const [version, setVersion] = useState(1);
  const [defaultTotal, setDefaultTotal] = useState(30);
  const [isDefault, setIsDefault] = useState(false);
  const [rules, setRules] = useState<RuleForm[]>([blankRule()]);

  const { data: poolTopicsData, isPending: poolTopicsPending } = useQuery({
    queryKey: ["admin-course-pool-topics", courseId],
    queryFn: () => fetchPoolTopics({ data: { courseId } }),
    enabled: Boolean(courseId),
  });

  const poolTopics = poolTopicsData?.topics ?? [];
  const usedTopics = useMemo(
    () => new Set(rules.map((r) => r.topic.trim().toLowerCase()).filter(Boolean)),
    [rules],
  );
  const unusedPoolTopics = useMemo(
    () => poolTopics.filter((t) => !usedTopics.has(t.topic.toLowerCase())),
    [poolTopics, usedTopics],
  );

  useEffect(() => {
    if (!existing) return;
    setCourseId(existing.blueprint.course_id);
    setName(existing.blueprint.name);
    setVersion(existing.blueprint.version);
    setDefaultTotal(existing.blueprint.default_total_questions);
    setIsDefault(Boolean(existing.blueprint.is_default));
    setRules(
      existing.rules.length
        ? existing.rules.map((r) => ({
            topic: r.topic,
            subtopic: r.subtopic ?? "",
            weightage: Number(r.weightage),
            min_questions: r.min_questions,
            max_questions: r.max_questions == null ? "" : String(r.max_questions),
            easy_percentage: Number(r.easy_percentage),
            medium_percentage: Number(r.medium_percentage),
            hard_percentage: Number(r.hard_percentage),
          }))
        : [blankRule()],
    );
  }, [existing]);

  const weightSum = useMemo(
    () => Math.round(rules.reduce((s, r) => s + Number(r.weightage || 0), 0) * 100) / 100,
    [rules],
  );

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        id: mode === "edit" ? blueprintId : undefined,
        courseId,
        name: name.trim(),
        version,
        defaultTotalQuestions: defaultTotal,
        isDefault,
        rules: rules.map((r) => ({
          topic: r.topic.trim(),
          subtopic: r.subtopic.trim() || null,
          weightage: Number(r.weightage),
          min_questions: Number(r.min_questions) || 0,
          max_questions: r.max_questions === "" ? null : Number(r.max_questions),
          easy_percentage: Number(r.easy_percentage),
          medium_percentage: Number(r.medium_percentage),
          hard_percentage: Number(r.hard_percentage),
        })),
      };
      return saveBlueprint({ data: payload });
    },
    onSuccess: (row) => {
      toast.success(mode === "edit" ? "Blueprint updated" : "Blueprint created");
      void queryClient.invalidateQueries({ queryKey: ["admin-blueprints"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-blueprint", row.id] });
      void navigate({ to: "/admin/blueprints/$blueprintId", params: { blueprintId: row.id } });
    },
    onError: (err: Error) => toast.error(err.message || "Save failed"),
  });

  if (mode === "edit" && existingPending) {
    return <PageLoader />;
  }

  if (mode === "edit" && !existing) {
    return (
      <div className="mt-8 rounded-lg border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">Blueprint not found.</p>
        <Link
          to="/admin/blueprints"
          className="mt-3 inline-block text-sm text-primary hover:underline"
        >
          Back to blueprints
        </Link>
      </div>
    );
  }

  return (
    <form
      className="mt-6 max-w-4xl space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!courseId) {
          toast.error("Select a course before saving.");
          return;
        }
        if (name.trim().length < 2) {
          toast.error("Blueprint name must be at least 2 characters.");
          return;
        }
        if (Math.abs(weightSum - 100) > 0.05) {
          toast.error(`Weightage must total 100% (currently ${weightSum}%)`);
          return;
        }
        for (const [i, rule] of rules.entries()) {
          const diff =
            Number(rule.easy_percentage) +
            Number(rule.medium_percentage) +
            Number(rule.hard_percentage);
          if (Math.abs(diff - 100) > 0.05) {
            toast.error(
              `Rule ${i + 1} (${rule.topic || "untitled"}): Easy/Medium/Hard must total 100%.`,
            );
            return;
          }
          if (!rule.topic.trim()) {
            toast.error(`Rule ${i + 1} needs a topic name.`);
            return;
          }
        }
        mutation.mutate();
      }}
    >
      <Panel
        title="Blueprint details"
        description="Identity and default exam length for pool-based generation."
        help={{
          label: "Matching topics",
          body: "Topics in rules must match pool question topics (and optional subtopics) for that course.",
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel
              htmlFor="bp-course"
              help={{
                label: "Course",
                body: "Blueprints only pull from pools belonging to this course.",
              }}
            >
              Course *
            </FieldLabel>
            <select
              id="bp-course"
              className="field w-full"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              required
            >
              <option value="">Select course…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel
              htmlFor="bp-name"
              help={{
                label: "Name",
                body: "Shown when choosing a blueprint on New assessment.",
              }}
            >
              Name *
            </FieldLabel>
            <input
              id="bp-name"
              className="field w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. AWS Associate — standard mix"
              required
              minLength={2}
            />
          </div>
          <div>
            <FieldLabel
              htmlFor="bp-version"
              help={{
                label: "Version",
                body: "Increment when you publish a new mix; exams keep the version they were generated with.",
              }}
            >
              Version
            </FieldLabel>
            <input
              id="bp-version"
              type="number"
              min={1}
              className="field w-full"
              value={version}
              onChange={(e) => setVersion(Number(e.target.value) || 1)}
            />
          </div>
          <div>
            <FieldLabel
              htmlFor="bp-total"
              help={{
                label: "Default total",
                body: "Default question count when generating an assessment. Can be overridden per exam.",
              }}
            >
              Default total questions
            </FieldLabel>
            <input
              id="bp-total"
              type="number"
              min={1}
              max={200}
              className="field w-full"
              value={defaultTotal}
              onChange={(e) => setDefaultTotal(Number(e.target.value) || 30)}
            />
          </div>
          <label className="sm:col-span-2 flex items-start gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            <span>
              <span className="flex items-center gap-1.5 font-medium">
                Default blueprint for this course
                <HelpTip label="Default blueprint">
                  Pre-selected when creating a pool-based assessment for this course. Only one
                  blueprint per course can be the default.
                </HelpTip>
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Authors can still pick a different blueprint on the assessment form.
              </span>
            </span>
          </label>
        </div>
      </Panel>

      <Panel
        title="Selection rules"
        description="Each rule is a topic bucket. Weightages across all rules must total 100%."
        help={{
          label: "How rules work",
          body: "Weightage decides how many questions come from each topic. Easy/Medium/Hard must total 100% per rule. Topic text must match pool questions.",
        }}
        action={
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
            onClick={() => setRules((current) => [...current, blankRule()])}
          >
            <Plus className="h-3.5 w-3.5" /> Add rule
          </button>
        }
      >
        <div
          className={`mb-4 flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
            Math.abs(weightSum - 100) > 0.05
              ? "border-destructive/40 bg-destructive/5 text-destructive"
              : "border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300"
          }`}
        >
          <span className="inline-flex items-center gap-1.5 font-medium">
            Total weightage
            <HelpTip label="Weightage total">
              Sum of Weight % across all rules. Must equal 100 before you can save.
            </HelpTip>
          </span>
          <span className="tabular-nums font-semibold">{weightSum}% / 100%</span>
        </div>

        {courseId ? (
          <div className="mb-4 rounded-lg border border-border bg-card px-3 py-3">
            <p className="text-xs font-medium text-foreground">
              Suggestions from this course’s question pools
              <HelpTip label="Pool suggestions">
                Topics and subtopics found on active pool questions. Click a chip to fill a rule, or
                type to filter the browser suggestions list.
              </HelpTip>
            </p>
            {poolTopicsPending ? (
              <p className="mt-2 text-xs text-muted-foreground">Loading pool topics…</p>
            ) : poolTopics.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                No active pool questions yet for this course. Import questions into a pool first, or
                type topic names manually.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {unusedPoolTopics.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    All pool topics already have a rule ({poolTopics.length} topic
                    {poolTopics.length === 1 ? "" : "s"}).
                  </p>
                ) : (
                  unusedPoolTopics.map((item) => (
                    <button
                      key={item.topic}
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-2 py-1 text-xs hover:border-primary/40 hover:bg-primary/5"
                      onClick={() => {
                        setRules((current) => {
                          const emptyIndex = current.findIndex((r) => !r.topic.trim());
                          if (emptyIndex >= 0) {
                            return current.map((r, i) =>
                              i === emptyIndex ? { ...r, topic: item.topic, subtopic: "" } : r,
                            );
                          }
                          return [
                            ...current,
                            {
                              ...blankRule(),
                              topic: item.topic,
                              weightage: Math.max(1, Math.round(100 / (current.length + 1))),
                            },
                          ];
                        });
                      }}
                    >
                      <span className="font-medium">{item.topic}</span>
                      <span className="tabular-nums text-muted-foreground">{item.count}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="mb-4 text-xs text-muted-foreground">
            Select a course to load topic suggestions from its question pools.
          </p>
        )}

        <datalist id={`${listId}-topics`}>
          {poolTopics.map((item) => (
            <option key={item.topic} value={item.topic}>
              {item.count} question{item.count === 1 ? "" : "s"}
            </option>
          ))}
        </datalist>

        <div className="space-y-3">
          {rules.map((rule, index) => {
            const diffSum =
              Number(rule.easy_percentage) +
              Number(rule.medium_percentage) +
              Number(rule.hard_percentage);
            const topicMatch = poolTopics.find(
              (t) => t.topic.toLowerCase() === rule.topic.trim().toLowerCase(),
            );
            const subtopicOptions = topicMatch?.subtopics ?? [];
            const sublistId = `${listId}-subtopics-${index}`;
            return (
              <div
                key={index}
                className="rounded-xl border border-border bg-muted/15 p-4 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Rule {index + 1}</p>
                  {rules.length > 1 ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                      aria-label="Remove rule"
                      onClick={() => setRules((rows) => rows.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="sm:col-span-2 lg:col-span-1">
                    <FieldLabel
                      help={{
                        label: "Topic",
                        body: "Must match the Topic value on pool questions for this course.",
                      }}
                    >
                      Topic *
                    </FieldLabel>
                    <input
                      className="field w-full"
                      list={`${listId}-topics`}
                      placeholder="Start typing or pick a suggestion"
                      value={rule.topic}
                      onChange={(e) =>
                        setRules((rows) =>
                          rows.map((r, i) =>
                            i === index ? { ...r, topic: e.target.value, subtopic: "" } : r,
                          ),
                        )
                      }
                      required
                    />
                    {topicMatch ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {topicMatch.count} pool question{topicMatch.count === 1 ? "" : "s"} match
                        this topic
                      </p>
                    ) : rule.topic.trim() &&
                      courseId &&
                      !poolTopicsPending &&
                      poolTopics.length > 0 ? (
                      <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                        No matching pool topic yet — check spelling against your imports.
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <FieldLabel
                      help={{
                        label: "Subtopic",
                        body: "Optional finer filter. Leave blank to use any subtopic under the topic.",
                      }}
                    >
                      Subtopic
                    </FieldLabel>
                    <input
                      className="field w-full"
                      list={sublistId}
                      placeholder={
                        subtopicOptions.length > 0 ? "Optional — pick from pool" : "Optional"
                      }
                      value={rule.subtopic}
                      onChange={(e) =>
                        setRules((rows) =>
                          rows.map((r, i) =>
                            i === index ? { ...r, subtopic: e.target.value } : r,
                          ),
                        )
                      }
                    />
                    <datalist id={sublistId}>
                      {subtopicOptions.map((sub) => (
                        <option key={sub} value={sub} />
                      ))}
                    </datalist>
                    {subtopicOptions.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {subtopicOptions.slice(0, 8).map((sub) => (
                          <button
                            key={sub}
                            type="button"
                            className={`rounded border px-1.5 py-0.5 text-[11px] ${
                              rule.subtopic === sub
                                ? "border-primary/40 bg-primary/10 text-foreground"
                                : "border-border bg-background text-muted-foreground hover:bg-secondary"
                            }`}
                            onClick={() =>
                              setRules((rows) =>
                                rows.map((r, i) =>
                                  i === index
                                    ? {
                                        ...r,
                                        subtopic: r.subtopic === sub ? "" : sub,
                                      }
                                    : r,
                                ),
                              )
                            }
                          >
                            {sub}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <FieldLabel
                      help={{
                        label: "Weight %",
                        body: "Share of the exam from this topic. All rules must add to 100%.",
                      }}
                    >
                      Weight %
                    </FieldLabel>
                    <input
                      type="number"
                      className="field w-full"
                      value={rule.weightage}
                      onChange={(e) =>
                        setRules((rows) =>
                          rows.map((r, i) =>
                            i === index ? { ...r, weightage: Number(e.target.value) } : r,
                          ),
                        )
                      }
                    />
                  </div>
                  <div>
                    <FieldLabel
                      help={{
                        label: "Min questions",
                        body: "Minimum questions to take from this topic when possible.",
                      }}
                    >
                      Min questions
                    </FieldLabel>
                    <input
                      type="number"
                      className="field w-full"
                      value={rule.min_questions}
                      onChange={(e) =>
                        setRules((rows) =>
                          rows.map((r, i) =>
                            i === index ? { ...r, min_questions: Number(e.target.value) } : r,
                          ),
                        )
                      }
                    />
                  </div>
                  <div>
                    <FieldLabel
                      help={{
                        label: "Max questions",
                        body: "Optional upper cap. Leave blank for no maximum.",
                      }}
                    >
                      Max questions
                    </FieldLabel>
                    <input
                      className="field w-full"
                      placeholder="No max"
                      value={rule.max_questions}
                      onChange={(e) =>
                        setRules((rows) =>
                          rows.map((r, i) =>
                            i === index ? { ...r, max_questions: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </div>
                </div>

                <div className="mt-4 border-t border-border/70 pt-4">
                  <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    Difficulty mix (must total 100%)
                    <HelpTip label="Difficulty mix">
                      Within this topic, how many Easy / Medium / Hard questions to prefer.
                    </HelpTip>
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <label className="text-xs text-muted-foreground">
                      Easy %
                      <input
                        type="number"
                        className="field mt-1 w-full"
                        value={rule.easy_percentage}
                        onChange={(e) =>
                          setRules((rows) =>
                            rows.map((r, i) =>
                              i === index ? { ...r, easy_percentage: Number(e.target.value) } : r,
                            ),
                          )
                        }
                      />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      Medium %
                      <input
                        type="number"
                        className="field mt-1 w-full"
                        value={rule.medium_percentage}
                        onChange={(e) =>
                          setRules((rows) =>
                            rows.map((r, i) =>
                              i === index ? { ...r, medium_percentage: Number(e.target.value) } : r,
                            ),
                          )
                        }
                      />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      Hard %
                      <input
                        type="number"
                        className="field mt-1 w-full"
                        value={rule.hard_percentage}
                        onChange={(e) =>
                          setRules((rows) =>
                            rows.map((r, i) =>
                              i === index ? { ...r, hard_percentage: Number(e.target.value) } : r,
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                  {Math.abs(diffSum - 100) > 0.05 ? (
                    <p className="mt-2 text-xs text-destructive">
                      Difficulty mix must total 100% (currently {diffSum}%).
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">Mix totals {diffSum}%.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={mutation.isPending || coursesPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {mutation.isPending ? "Saving…" : "Save blueprint"}
        </button>
        <Link
          to="/admin/blueprints"
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          Cancel
        </Link>
        <p className="w-full text-xs text-muted-foreground sm:w-auto">
          After saving, create an assessment and choose Question pool + this blueprint.
        </p>
      </div>
    </form>
  );
}
