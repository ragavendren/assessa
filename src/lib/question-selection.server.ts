import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  distributionMap,
  finalizeAllocations,
  selectQuestionsFromPool,
  type BlueprintRuleInput,
  type Shortage,
  type TopicAllocation,
} from "@/lib/question-selection.math";

export type ReusePolicy = Database["public"]["Enums"]["question_reuse_policy"];

export type GeneratedQuestion = {
  prompt: string;
  options: string[];
  correct_index: number;
  correct_indexes: number[];
  multi_select: boolean;
  subtopic: string;
  explanation: string;
  source_pool_question_id: string;
};

export type GenerationResult = {
  ok: true;
  questions: GeneratedQuestion[];
  selectedPoolQuestionIds: string[];
  allocations: TopicAllocation[];
  distribution: Record<string, number>;
  shortages: Shortage[];
  blueprintVersion: number | null;
};

export type GenerationShortageResult = {
  ok: false;
  reason: "shortage";
  shortages: Shortage[];
  allocations: TopicAllocation[];
  distribution: Record<string, number>;
};

function validateClone(q: {
  prompt: string;
  options: unknown;
  correct_index: number;
  correct_indexes: number[] | null;
}): { options: string[]; correctIndexes: number[]; multiSelect: boolean } {
  const options = Array.isArray(q.options)
    ? (q.options as unknown[]).map((o) => String(o).trim()).filter(Boolean)
    : [];
  if (options.length < 2) throw new Error("Pool question has fewer than two options.");
  const indexes = [
    ...new Set(
      Array.isArray(q.correct_indexes) && q.correct_indexes.length > 0
        ? q.correct_indexes
        : [q.correct_index],
    ),
  ]
    .filter((i) => i >= 0 && i < options.length)
    .sort((a, b) => a - b);
  if (indexes.length === 0) throw new Error("Pool question has an invalid answer key.");
  if (!q.prompt || q.prompt.trim().length < 4) {
    throw new Error("Pool question prompt is too short.");
  }
  return {
    options,
    correctIndexes: indexes,
    multiSelect: indexes.length > 1,
  };
}

export async function loadExcludedPoolQuestionIds(
  supabase: SupabaseClient<Database>,
  args: {
    poolId: string;
    courseId: string;
    seriesId: string | null;
    reusePolicy: ReusePolicy;
    reuseLastN: number;
    excludeExamId?: string | null;
  },
): Promise<Set<string>> {
  const excluded = new Set<string>();
  if (args.reusePolicy === "allow_reuse") return excluded;

  if (args.reusePolicy === "no_reuse_last_n") {
    let examQuery = supabase
      .from("exams")
      .select("id, created_at")
      .eq("question_pool_id", args.poolId)
      .order("created_at", { ascending: false })
      .limit(Math.max(1, args.reuseLastN));
    if (args.excludeExamId) examQuery = examQuery.neq("id", args.excludeExamId);
    const { data: recentExams, error } = await examQuery;
    if (error) throw error;
    const examIds = (recentExams ?? []).map((e) => e.id);
    if (examIds.length === 0) return excluded;
    const { data: used, error: usedError } = await supabase
      .from("questions")
      .select("source_pool_question_id")
      .in("exam_id", examIds)
      .not("source_pool_question_id", "is", null);
    if (usedError) throw usedError;
    for (const row of used ?? []) {
      if (row.source_pool_question_id) excluded.add(row.source_pool_question_id);
    }
    return excluded;
  }

  let examQuery = supabase.from("exams").select("id").eq("question_pool_id", args.poolId);
  if (args.reusePolicy === "no_reuse_course") {
    examQuery = examQuery.eq("course_id", args.courseId);
  } else if (args.reusePolicy === "no_reuse_series") {
    if (!args.seriesId) return excluded;
    examQuery = examQuery.eq("series_id", args.seriesId);
  } else if (args.reusePolicy === "until_pool_exhausted") {
    examQuery = examQuery.eq("course_id", args.courseId);
  }
  if (args.excludeExamId) examQuery = examQuery.neq("id", args.excludeExamId);

  const { data: exams, error } = await examQuery;
  if (error) throw error;
  const examIds = (exams ?? []).map((e) => e.id);
  if (examIds.length === 0) return excluded;

  const { data: used, error: usedError } = await supabase
    .from("questions")
    .select("source_pool_question_id")
    .in("exam_id", examIds)
    .not("source_pool_question_id", "is", null);
  if (usedError) throw usedError;
  for (const row of used ?? []) {
    if (row.source_pool_question_id) excluded.add(row.source_pool_question_id);
  }
  return excluded;
}

export async function assertExamRegeneratable(
  supabase: SupabaseClient<Database>,
  examId: string,
): Promise<{ active: boolean }> {
  const { data: exam, error } = await supabase
    .from("exams")
    .select("id, active")
    .eq("id", examId)
    .maybeSingle();
  if (error) throw error;
  if (!exam) throw new Error("Assessment not found");
  if (exam.active) {
    throw new Error("Cannot regenerate questions on a published assessment. Unpublish first.");
  }
  const { count, error: countError } = await supabase
    .from("exam_attempts")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", examId);
  if (countError) throw countError;
  if ((count ?? 0) > 0) {
    throw new Error("Cannot regenerate questions after participants have started attempts.");
  }
  return { active: exam.active };
}

export async function previewOrSelectQuestions(
  supabase: SupabaseClient<Database>,
  args: {
    poolId: string;
    blueprintId: string;
    courseId: string;
    seriesId?: string | null;
    questionCount: number;
    reusePolicy: ReusePolicy;
    reuseLastN?: number;
    excludeExamId?: string | null;
    allowPreviouslyUsed?: boolean;
  },
): Promise<GenerationResult | GenerationShortageResult> {
  const [{ data: blueprint, error: bpError }, { data: rules, error: rulesError }] =
    await Promise.all([
      supabase.from("course_blueprints").select("*").eq("id", args.blueprintId).maybeSingle(),
      supabase.from("blueprint_rules").select("*").eq("blueprint_id", args.blueprintId),
    ]);
  if (bpError) throw bpError;
  if (rulesError) throw rulesError;
  if (!blueprint) throw new Error("Blueprint not found");
  if (blueprint.course_id !== args.courseId) {
    throw new Error("Blueprint does not belong to the selected course.");
  }

  const ruleInputs: BlueprintRuleInput[] = (rules ?? []).map((r) => ({
    topic: r.topic,
    subtopic: r.subtopic,
    weightage: Number(r.weightage),
    min_questions: r.min_questions,
    max_questions: r.max_questions,
    easy_percentage: Number(r.easy_percentage),
    medium_percentage: Number(r.medium_percentage),
    hard_percentage: Number(r.hard_percentage),
  }));
  const allocations = finalizeAllocations(ruleInputs, args.questionCount);
  const distribution = distributionMap(allocations);

  const reusePolicy: ReusePolicy = args.allowPreviouslyUsed ? "allow_reuse" : args.reusePolicy;

  const excluded = await loadExcludedPoolQuestionIds(supabase, {
    poolId: args.poolId,
    courseId: args.courseId,
    seriesId: args.seriesId ?? null,
    reusePolicy,
    reuseLastN: args.reuseLastN ?? 5,
    excludeExamId: args.excludeExamId ?? null,
  });

  const { data: poolRows, error: poolError } = await supabase
    .from("pool_questions")
    .select(
      "id, prompt, options, correct_index, correct_indexes, explanation, topic, subtopic, difficulty, status",
    )
    .eq("pool_id", args.poolId)
    .eq("status", "active");
  if (poolError) throw poolError;

  const eligible = (poolRows ?? [])
    .filter((q) => !excluded.has(q.id))
    .map((q) => ({
      id: q.id,
      topic: q.topic,
      subtopic: q.subtopic,
      difficulty: q.difficulty,
    }));

  const { selectedIds, shortages } = selectQuestionsFromPool({ allocations, eligible });
  if (shortages.length > 0 || selectedIds.length !== args.questionCount) {
    return {
      ok: false,
      reason: "shortage",
      shortages,
      allocations,
      distribution,
    };
  }

  const byId = new Map((poolRows ?? []).map((q) => [q.id, q]));
  const questions: GeneratedQuestion[] = selectedIds.map((id) => {
    const row = byId.get(id);
    if (!row) throw new Error("Selected pool question missing.");
    const validated = validateClone(row);
    return {
      prompt: row.prompt.trim(),
      options: validated.options,
      correct_index: validated.correctIndexes[0] ?? 0,
      correct_indexes: validated.multiSelect
        ? validated.correctIndexes
        : [validated.correctIndexes[0] ?? 0],
      multi_select: validated.multiSelect,
      subtopic: row.subtopic || "general",
      explanation: row.explanation ?? "",
      source_pool_question_id: row.id,
    };
  });

  return {
    ok: true,
    questions,
    selectedPoolQuestionIds: selectedIds,
    allocations,
    distribution,
    shortages: [],
    blueprintVersion: blueprint.version,
  };
}

/** Clone selected pool questions onto an unpublished exam with zero attempts. */
export async function persistGeneratedQuestions(
  supabase: SupabaseClient<Database>,
  args: {
    examId: string;
    poolId: string;
    blueprintId: string;
    courseId: string;
    seriesId: string | null;
    reusePolicy: ReusePolicy;
    reuseLastN: number;
    questionCount: number;
    result: GenerationResult;
  },
) {
  await assertExamRegeneratable(supabase, args.examId);

  const { error: deleteError } = await supabase
    .from("questions")
    .delete()
    .eq("exam_id", args.examId);
  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase.from("questions").insert(
    args.result.questions.map((q) => ({
      exam_id: args.examId,
      prompt: q.prompt,
      options: q.options,
      correct_index: q.correct_index,
      correct_indexes: q.correct_indexes,
      subtopic: q.subtopic,
      explanation: q.explanation,
      source_pool_question_id: q.source_pool_question_id,
    })),
  );
  if (insertError) throw insertError;

  const { error: examError } = await supabase
    .from("exams")
    .update({
      question_selection_method: "question_pool",
      course_id: args.courseId,
      question_pool_id: args.poolId,
      blueprint_id: args.blueprintId,
      series_id: args.seriesId,
      reuse_policy: args.reusePolicy,
      reuse_last_n: args.reuseLastN,
      question_count: args.result.questions.length,
      generation_locked_at: new Date().toISOString(),
    })
    .eq("id", args.examId);
  if (examError) throw examError;

  const { error: auditError } = await supabase.from("exam_generation_audit").insert({
    exam_id: args.examId,
    method: "question_pool",
    pool_id: args.poolId,
    blueprint_id: args.blueprintId,
    blueprint_version: args.result.blueprintVersion,
    series_id: args.seriesId,
    reuse_policy: args.reusePolicy,
    question_count: args.result.questions.length,
    selected_pool_question_ids: args.result.selectedPoolQuestionIds,
    distribution: args.result.distribution,
  });
  if (auditError) throw auditError;
}

export function checkAvailabilityAgainstAllocations(
  allocations: TopicAllocation[],
  eligible: Array<{ topic: string; subtopic: string; difficulty: string }>,
): Shortage[] {
  const { shortages } = selectQuestionsFromPool({
    allocations,
    eligible: eligible.map((q, i) => ({
      id: `avail-${i}`,
      topic: q.topic,
      subtopic: q.subtopic,
      difficulty: q.difficulty as "easy" | "medium" | "hard",
    })),
    random: () => 0.5,
  });
  return shortages;
}
