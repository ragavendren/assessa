import { BlueprintPreview } from "@/components/admin/pool/BlueprintPreview";
import { GeneratedQuestionPreview } from "@/components/admin/pool/GeneratedQuestionPreview";
import { QuestionAvailability } from "@/components/admin/pool/QuestionAvailability";
import type { TopicAllocation, Shortage } from "@/lib/question-selection.math";
import {
  checkQuestionAvailability,
  generateExamQuestions,
  listAssessmentSeries,
  listBlueprints,
  listCourses,
  listQuestionPools,
  previewBlueprintDistribution,
  regenerateExamQuestions,
} from "@/lib/pool.functions";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export type PoolConfigState = {
  courseId: string | null;
  poolId: string | null;
  blueprintId: string | null;
  seriesId: string | null;
  questionCount: number;
  reusePolicy:
    | "allow_reuse"
    | "no_reuse_course"
    | "no_reuse_series"
    | "until_pool_exhausted"
    | "no_reuse_last_n";
  reuseLastN: number;
};

export type GeneratedClone = {
  prompt: string;
  options: string[];
  correct_index: number;
  correct_indexes: number[];
  multi_select: boolean;
  subtopic: string;
  explanation: string;
  source_pool_question_id: string;
};

type Props = {
  examId?: string | null;
  canRegenerate: boolean;
  value: PoolConfigState;
  onChange: (next: PoolConfigState) => void;
  onGenerated: (questions: GeneratedClone[], distribution: Record<string, number>) => void;
  distributionSummary?: Record<string, number> | null;
  generatedCount?: number;
};

const REUSE_LABELS: Record<PoolConfigState["reusePolicy"], string> = {
  allow_reuse: "Allow reuse",
  no_reuse_course: "No reuse within course",
  no_reuse_series: "No reuse within series",
  until_pool_exhausted: "Until pool exhausted (default)",
  no_reuse_last_n: "No reuse in last N assessments",
};

export function QuestionGenerationConfiguration({
  examId,
  canRegenerate,
  value,
  onChange,
  onGenerated,
  distributionSummary,
  generatedCount,
}: Props) {
  const fetchCourses = useServerFn(listCourses);
  const fetchPools = useServerFn(listQuestionPools);
  const fetchBlueprints = useServerFn(listBlueprints);
  const fetchSeries = useServerFn(listAssessmentSeries);
  const previewDist = useServerFn(previewBlueprintDistribution);
  const checkAvail = useServerFn(checkQuestionAvailability);
  const generate = useServerFn(generateExamQuestions);
  const regenerate = useServerFn(regenerateExamQuestions);

  const [allocations, setAllocations] = useState<TopicAllocation[]>([]);
  const [shortages, setShortages] = useState<Shortage[]>([]);
  const [allowPreviouslyUsed, setAllowPreviouslyUsed] = useState(false);

  const { data: coursesData } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: () => fetchCourses(),
  });
  const { data: poolsData } = useQuery({
    queryKey: ["admin-pools", value.courseId],
    queryFn: () => fetchPools({ data: { courseId: value.courseId ?? undefined } }),
    enabled: Boolean(value.courseId),
  });
  const { data: blueprintsData } = useQuery({
    queryKey: ["admin-blueprints", value.courseId],
    queryFn: () => fetchBlueprints({ data: { courseId: value.courseId ?? undefined } }),
    enabled: Boolean(value.courseId),
  });
  const { data: seriesData } = useQuery({
    queryKey: ["admin-series", value.courseId],
    queryFn: () => fetchSeries({ data: { courseId: value.courseId ?? undefined } }),
    enabled: Boolean(value.courseId),
  });

  const pools = poolsData?.pools ?? [];
  const blueprints = blueprintsData?.blueprints ?? [];
  const series = seriesData?.series ?? [];

  useEffect(() => {
    if (!value.courseId || value.blueprintId) return;
    const list = blueprintsData?.blueprints ?? [];
    if (list.length === 0) return;
    const preferred = list.find((b) => b.is_default) ?? list[0];
    if (!preferred) return;
    onChange({
      ...value,
      blueprintId: preferred.id,
      questionCount: preferred.default_total_questions ?? value.questionCount,
    });
  }, [blueprintsData, value.courseId, value.blueprintId]); // eslint-disable-line react-hooks/exhaustive-deps -- auto-pick once when course blueprints load

  useEffect(() => {
    if (!value.blueprintId || value.questionCount < 1) {
      setAllocations([]);
      return;
    }
    let cancelled = false;
    void previewDist({
      data: { blueprintId: value.blueprintId, questionCount: value.questionCount },
    }).then((result) => {
      if (!cancelled) setAllocations(result.allocations);
    });
    return () => {
      cancelled = true;
    };
  }, [previewDist, value.blueprintId, value.questionCount]);

  const ready = useMemo(
    () => Boolean(value.courseId && value.poolId && value.blueprintId && value.questionCount >= 1),
    [value],
  );

  const generateMutation = useMutation({
    mutationFn: async (opts: { persist: boolean; allowUsed: boolean }) => {
      const payload = {
        examId: examId ?? undefined,
        courseId: value.courseId!,
        poolId: value.poolId!,
        blueprintId: value.blueprintId!,
        seriesId: value.seriesId,
        questionCount: value.questionCount,
        reusePolicy: value.reusePolicy,
        reuseLastN: value.reuseLastN,
        allowPreviouslyUsed: opts.allowUsed,
        persist: opts.persist && Boolean(examId),
      };
      if (opts.persist && examId) {
        return regenerate({ data: { ...payload, examId } });
      }
      return generate({ data: payload });
    },
    onSuccess: (result) => {
      if (!result.ok) {
        setShortages(result.shortages);
        toast.error("Not enough eligible questions in the pool");
        return;
      }
      setShortages([]);
      setAllowPreviouslyUsed(false);
      onGenerated(result.questions, result.distribution);
      toast.success(`Generated ${result.questions.length} questions`);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not generate questions"),
  });

  const availabilityMutation = useMutation({
    mutationFn: () =>
      checkAvail({
        data: {
          courseId: value.courseId!,
          poolId: value.poolId!,
          blueprintId: value.blueprintId!,
          seriesId: value.seriesId,
          questionCount: value.questionCount,
          reusePolicy: value.reusePolicy,
          reuseLastN: value.reuseLastN,
          allowPreviouslyUsed,
        },
      }),
    onSuccess: (result) => {
      setShortages(result.shortages);
      if (result.available) toast.success("Pool can fill this blueprint");
      else toast.message("Shortages found — see details below");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Availability check failed"),
  });

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Course</span>
          <select
            className="field w-full"
            value={value.courseId ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                courseId: e.target.value || null,
                poolId: null,
                blueprintId: null,
                seriesId: null,
              })
            }
          >
            <option value="">Select course…</option>
            {(coursesData?.courses ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Question pool</span>
          <select
            className="field w-full"
            value={value.poolId ?? ""}
            disabled={!value.courseId}
            onChange={(e) => onChange({ ...value, poolId: e.target.value || null })}
          >
            <option value="">Select pool…</option>
            {pools.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Blueprint</span>
          <select
            className="field w-full"
            value={value.blueprintId ?? ""}
            disabled={!value.courseId}
            onChange={(e) => {
              const id = e.target.value || null;
              const bp = blueprints.find((b) => b.id === id);
              onChange({
                ...value,
                blueprintId: id,
                questionCount: bp?.default_total_questions ?? value.questionCount,
              });
            }}
          >
            <option value="">Select blueprint…</option>
            {blueprints.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} (v{b.version}){b.is_default ? " · default" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Series (optional)</span>
          <select
            className="field w-full"
            value={value.seriesId ?? ""}
            disabled={!value.courseId}
            onChange={(e) => {
              const id = e.target.value || null;
              const s = series.find((row) => row.id === id);
              onChange({
                ...value,
                seriesId: id,
                poolId: s?.question_pool_id ?? value.poolId,
                blueprintId: s?.blueprint_id ?? value.blueprintId,
                reusePolicy: s?.reuse_policy ?? value.reusePolicy,
                reuseLastN: s?.reuse_last_n ?? value.reuseLastN,
              });
            }}
          >
            <option value="">None</option>
            {series.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Question count</span>
          <input
            type="number"
            min={1}
            max={200}
            className="field w-full"
            value={value.questionCount}
            onChange={(e) =>
              onChange({ ...value, questionCount: Math.max(1, Number(e.target.value) || 1) })
            }
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Reuse policy</span>
          <select
            className="field w-full"
            value={value.reusePolicy}
            onChange={(e) =>
              onChange({
                ...value,
                reusePolicy: e.target.value as PoolConfigState["reusePolicy"],
              })
            }
          >
            {(Object.keys(REUSE_LABELS) as PoolConfigState["reusePolicy"][]).map((key) => (
              <option key={key} value={key}>
                {REUSE_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        {value.reusePolicy === "no_reuse_last_n" ? (
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Last N assessments</span>
            <input
              type="number"
              min={1}
              max={50}
              className="field w-full"
              value={value.reuseLastN}
              onChange={(e) =>
                onChange({ ...value, reuseLastN: Math.max(1, Number(e.target.value) || 5) })
              }
            />
          </label>
        ) : null}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Blueprint preview</p>
        <p className="mb-2 text-xs text-muted-foreground">
          Difficulty follows the blueprint percentages. Question order is randomised on generate.
        </p>
        <BlueprintPreview allocations={allocations} questionCount={value.questionCount} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!ready || availabilityMutation.isPending}
          onClick={() => availabilityMutation.mutate()}
          className="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"
        >
          Check availability
        </button>
        <button
          type="button"
          disabled={!ready || generateMutation.isPending}
          onClick={() =>
            generateMutation.mutate({ persist: false, allowUsed: allowPreviouslyUsed })
          }
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Generate questions
        </button>
        {examId ? (
          <button
            type="button"
            disabled={!ready || !canRegenerate || generateMutation.isPending}
            title={
              canRegenerate
                ? "Replace cloned questions on this draft"
                : "Unpublish and ensure there are no attempts before regenerating"
            }
            onClick={() =>
              generateMutation.mutate({ persist: true, allowUsed: allowPreviouslyUsed })
            }
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"
          >
            Regenerate (save to exam)
          </button>
        ) : null}
      </div>

      <QuestionAvailability
        shortages={shortages}
        poolId={value.poolId}
        onCancel={() => setShortages([])}
        onAllowPreviouslyUsed={() => {
          setAllowPreviouslyUsed(true);
          generateMutation.mutate({ persist: false, allowUsed: true });
        }}
      />

      {generatedCount && generatedCount > 0 && distributionSummary ? (
        <GeneratedQuestionPreview count={generatedCount} distribution={distributionSummary} />
      ) : null}
    </div>
  );
}
