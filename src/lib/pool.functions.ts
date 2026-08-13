import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  distributionMap,
  finalizeAllocations,
  type BlueprintRuleInput,
} from "@/lib/question-selection.math";
import {
  assertExamRegeneratable,
  checkAvailabilityAgainstAllocations,
  loadExcludedPoolQuestionIds,
  persistGeneratedQuestions,
  previewOrSelectQuestions,
  type ReusePolicy,
} from "@/lib/question-selection.server";
import { parsePoolQuestionsCsv } from "@/lib/pool-questions-csv";

const reusePolicySchema = z.enum([
  "allow_reuse",
  "no_reuse_course",
  "no_reuse_series",
  "until_pool_exhausted",
  "no_reuse_last_n",
]);

const catalogStatusSchema = z.enum(["active", "inactive"]);
const difficultySchema = z.enum(["easy", "medium", "hard"]);

const blueprintRuleSchema = z.object({
  topic: z.string().trim().min(1).max(80),
  subtopic: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    })
    .optional(),
  weightage: z.coerce.number().min(0).max(100),
  min_questions: z.coerce.number().int().min(0).default(0),
  max_questions: z.preprocess((value) => {
    if (value === "" || value === undefined || value === null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }, z.number().int().min(0).nullable()),
  easy_percentage: z.coerce.number().min(0).max(100).default(20),
  medium_percentage: z.coerce.number().min(0).max(100).default(60),
  hard_percentage: z.coerce.number().min(0).max(100).default(20),
});

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

function zodMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

async function adminClient(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { requireAdmin } = await import("@/lib/platform.server");
  await requireAdmin(userId);
  return supabaseAdmin;
}

// ——— Courses ———

export const listCourses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = await adminClient(context.userId);
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw error;
    return { courses: data ?? [] };
  });

export const upsertCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(2).max(120),
        status: catalogStatusSchema.default("active"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = await adminClient(context.userId);
    if (data.id) {
      const { data: row, error } = await supabase
        .from("courses")
        .update({ name: data.name, status: data.status, updated_at: new Date().toISOString() })
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await supabase
      .from("courses")
      .insert({ name: data.name, status: data.status })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = await adminClient(context.userId);
    const { error } = await supabase.from("courses").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ——— Pools ———

export const listQuestionPools = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ courseId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const supabase = await adminClient(context.userId);
    let query = supabase
      .from("question_pools")
      .select("*, courses(name)")
      .order("name", { ascending: true });
    if (data.courseId) query = query.eq("course_id", data.courseId);
    const { data: pools, error } = await query;
    if (error) throw error;
    return { pools: pools ?? [] };
  });

export const upsertQuestionPool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        courseId: z.string().uuid(),
        name: z.string().trim().min(2).max(120),
        status: catalogStatusSchema.default("active"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = await adminClient(context.userId);
    if (data.id) {
      const { data: row, error } = await supabase
        .from("question_pools")
        .update({
          course_id: data.courseId,
          name: data.name,
          status: data.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await supabase
      .from("question_pools")
      .insert({ course_id: data.courseId, name: data.name, status: data.status })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteQuestionPool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = await adminClient(context.userId);
    const { error } = await supabase.from("question_pools").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/** Distinct topic / subtopic values from active pool questions for a course. */
export const listCoursePoolTopics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ courseId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = await adminClient(context.userId);
    const { data: pools, error: poolsError } = await supabase
      .from("question_pools")
      .select("id")
      .eq("course_id", data.courseId);
    if (poolsError) throw new Error(poolsError.message);
    const poolIds = (pools ?? []).map((p) => p.id);
    if (poolIds.length === 0) {
      return { topics: [] as Array<{ topic: string; count: number; subtopics: string[] }> };
    }

    const { data: rows, error } = await supabase
      .from("pool_questions")
      .select("topic, subtopic")
      .in("pool_id", poolIds)
      .eq("status", "active");
    if (error) throw new Error(error.message);

    const byTopic = new Map<string, { count: number; subtopics: Set<string> }>();
    for (const row of rows ?? []) {
      const topic = (row.topic ?? "").trim() || "general";
      const subtopic = (row.subtopic ?? "").trim();
      const entry = byTopic.get(topic) ?? { count: 0, subtopics: new Set<string>() };
      entry.count += 1;
      if (subtopic && subtopic.toLowerCase() !== "general") entry.subtopics.add(subtopic);
      byTopic.set(topic, entry);
    }

    const topics = [...byTopic.entries()]
      .map(([topic, value]) => ({
        topic,
        count: value.count,
        subtopics: [...value.subtopics].sort((a, b) => a.localeCompare(b)),
      }))
      .sort((a, b) => a.topic.localeCompare(b.topic));

    return { topics };
  });

export const listPoolQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ poolId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = await adminClient(context.userId);
    const { data: questions, error } = await supabase
      .from("pool_questions")
      .select("*")
      .eq("pool_id", data.poolId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return { questions: questions ?? [] };
  });

export const upsertPoolQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        poolId: z.string().uuid(),
        prompt: z.string().trim().min(4).max(4000),
        options: z.array(z.string().trim().min(1).max(1000)).min(2).max(6),
        correct_indexes: z.array(z.number().int().min(0).max(5)).min(1).max(6),
        multi_select: z.boolean().default(false),
        topic: z.string().trim().min(1).max(80).default("general"),
        subtopic: z.string().trim().max(80).default("general"),
        difficulty: difficultySchema.default("medium"),
        skill: z.string().trim().max(120).default(""),
        tags: z.array(z.string().trim().max(40)).default([]),
        explanation: z.string().trim().max(4000).default(""),
        marks: z.number().int().min(1).max(100).default(1),
        status: catalogStatusSchema.default("active"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = await adminClient(context.userId);
    const indexes = [...new Set(data.correct_indexes)]
      .filter((i) => i < data.options.length)
      .sort((a, b) => a - b);
    if (indexes.length === 0) throw new Error("Valid correct answer required");
    if (!data.multi_select && indexes.length > 1) {
      throw new Error("Enable multi-select for multiple answers");
    }
    const payload = {
      pool_id: data.poolId,
      prompt: data.prompt,
      options: data.options,
      correct_index: indexes[0] ?? 0,
      correct_indexes: data.multi_select ? indexes : [indexes[0] ?? 0],
      topic: data.topic,
      subtopic: data.subtopic || "general",
      difficulty: data.difficulty,
      skill: data.skill,
      tags: data.tags,
      explanation: data.explanation,
      marks: data.marks,
      status: data.status,
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      const { data: row, error } = await supabase
        .from("pool_questions")
        .update(payload)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await supabase
      .from("pool_questions")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const deletePoolQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = await adminClient(context.userId);
    const { error } = await supabase.from("pool_questions").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const clearPoolQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ poolId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = await adminClient(context.userId);
    const { data: pool, error: poolError } = await supabase
      .from("question_pools")
      .select("id")
      .eq("id", data.poolId)
      .maybeSingle();
    if (poolError) throw new Error(poolError.message);
    if (!pool) throw new Error("Question pool not found.");

    const { count, error: countError } = await supabase
      .from("pool_questions")
      .select("id", { count: "exact", head: true })
      .eq("pool_id", data.poolId);
    if (countError) throw new Error(countError.message);

    const { error } = await supabase.from("pool_questions").delete().eq("pool_id", data.poolId);
    if (error) throw new Error(error.message);
    return { ok: true as const, deleted: count ?? 0 };
  });

export const importPoolQuestionsCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ poolId: z.string().uuid(), csvText: z.string().min(1).max(2_000_000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = await adminClient(context.userId);

    const { data: pool, error: poolError } = await supabase
      .from("question_pools")
      .select("id")
      .eq("id", data.poolId)
      .maybeSingle();
    if (poolError) throw new Error(poolError.message);
    if (!pool) throw new Error("Question pool not found. Open a pool from the list and try again.");

    const { questions, errors } = parsePoolQuestionsCsv(data.csvText);
    if (questions.length === 0) {
      return {
        imported: 0,
        errors: errors.length
          ? errors
          : [
              "No valid questions found. Download the pool CSV template, keep the header row, and use A–F for correct answers.",
            ],
      };
    }

    const rows = questions.map((q) => ({
      pool_id: data.poolId,
      prompt: q.prompt,
      options: q.options,
      correct_index: q.correctIndexes[0] ?? 0,
      correct_indexes: q.multiSelect ? q.correctIndexes : [q.correctIndexes[0] ?? 0],
      topic: q.topic || "general",
      subtopic: q.subtopic || "general",
      difficulty: q.difficulty,
      skill: q.skill || "",
      tags: q.tags ?? [],
      explanation: q.explanation || "",
      marks: q.marks || 1,
      status: "active" as const,
    }));

    // Insert in chunks to avoid payload limits
    const chunkSize = 100;
    let imported = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase.from("pool_questions").insert(chunk);
      if (error) {
        throw new Error(
          `Import failed after ${imported} question(s): ${error.message}. Check difficulty is easy/medium/hard and options are filled.`,
        );
      }
      imported += chunk.length;
    }

    return { imported, errors };
  });

// ——— Blueprints ———

export const listBlueprints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ courseId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const supabase = await adminClient(context.userId);
    let query = supabase
      .from("course_blueprints")
      .select("*, courses(name)")
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });
    if (data.courseId) query = query.eq("course_id", data.courseId);
    const { data: blueprints, error } = await query;
    if (error) throw error;
    return { blueprints: blueprints ?? [] };
  });

export const getBlueprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = await adminClient(context.userId);
    const [{ data: blueprint, error }, { data: rules, error: rulesError }] = await Promise.all([
      supabase.from("course_blueprints").select("*").eq("id", data.id).maybeSingle(),
      supabase.from("blueprint_rules").select("*").eq("blueprint_id", data.id).order("topic"),
    ]);
    if (error) throw error;
    if (rulesError) throw rulesError;
    if (!blueprint) throw new Error("Blueprint not found");
    return { blueprint, rules: rules ?? [] };
  });

export const upsertBlueprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => {
    const parsed = z
      .object({
        id: z.string().uuid().optional().nullable(),
        courseId: z
          .string()
          .min(1, "Select a course before saving.")
          .uuid("Select a course before saving."),
        name: z.string().trim().min(2, "Blueprint name must be at least 2 characters.").max(120),
        version: z.coerce.number().int().min(1).default(1),
        status: catalogStatusSchema.default("active"),
        defaultTotalQuestions: z.coerce.number().int().min(1).max(200).default(30),
        isDefault: z.boolean().default(false),
        rules: z.array(blueprintRuleSchema).min(1, "Add at least one topic rule.").max(40),
      })
      .superRefine((value, ctx) => {
        const weightSum = value.rules.reduce((s, r) => s + r.weightage, 0);
        if (Math.abs(weightSum - 100) > 0.05) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Rule weightage must total 100% (currently ${round3(weightSum)}%).`,
          });
        }
        for (const [i, rule] of value.rules.entries()) {
          const diff = rule.easy_percentage + rule.medium_percentage + rule.hard_percentage;
          if (Math.abs(diff - 100) > 0.05) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Rule ${i + 1} (${rule.topic || "untitled"}): Easy/Medium/Hard must total 100% (currently ${round3(diff)}%).`,
            });
          }
        }
      })
      .safeParse(input);
    if (!parsed.success) {
      throw new Error(zodMessage(parsed.error));
    }
    return parsed.data;
  })
  .handler(async ({ data, context }) => {
    const supabase = await adminClient(context.userId);

    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id")
      .eq("id", data.courseId)
      .maybeSingle();
    if (courseError) throw new Error(courseError.message);
    if (!course) {
      throw new Error(
        "Selected course was not found. Create a course under Question bank → Courses.",
      );
    }

    if (data.isDefault) {
      const { error: clearDefaultError } = await supabase
        .from("course_blueprints")
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .eq("course_id", data.courseId)
        .eq("is_default", true);
      if (clearDefaultError) throw new Error(clearDefaultError.message);
    }

    let blueprintId = data.id ?? undefined;
    if (blueprintId) {
      const { error } = await supabase
        .from("course_blueprints")
        .update({
          course_id: data.courseId,
          name: data.name,
          version: data.version,
          status: data.status,
          default_total_questions: data.defaultTotalQuestions,
          is_default: data.isDefault,
          updated_at: new Date().toISOString(),
        })
        .eq("id", blueprintId);
      if (error) throw new Error(error.message);
      const { error: deleteError } = await supabase
        .from("blueprint_rules")
        .delete()
        .eq("blueprint_id", blueprintId);
      if (deleteError) throw new Error(deleteError.message);
    } else {
      const { data: row, error } = await supabase
        .from("course_blueprints")
        .insert({
          course_id: data.courseId,
          name: data.name,
          version: data.version,
          status: data.status,
          default_total_questions: data.defaultTotalQuestions,
          is_default: data.isDefault,
        })
        .select("id")
        .single();
      if (error) {
        if (error.message.toLowerCase().includes("duplicate") || error.code === "23505") {
          throw new Error(
            "A blueprint with this name and version already exists for the course. Change the name or version.",
          );
        }
        throw new Error(error.message);
      }
      blueprintId = row.id;
    }

    const { error: rulesError } = await supabase.from("blueprint_rules").insert(
      data.rules.map((r) => ({
        blueprint_id: blueprintId!,
        topic: r.topic,
        subtopic: r.subtopic ?? null,
        weightage: round3(r.weightage),
        min_questions: r.min_questions,
        max_questions: r.max_questions ?? null,
        easy_percentage: round3(r.easy_percentage),
        medium_percentage: round3(r.medium_percentage),
        hard_percentage: round3(r.hard_percentage),
      })),
    );
    if (rulesError) {
      // Roll back brand-new blueprint if rules fail
      if (!data.id) {
        await supabase.from("course_blueprints").delete().eq("id", blueprintId!);
      }
      throw new Error(rulesError.message);
    }
    return { id: blueprintId! };
  });

export const deleteBlueprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = await adminClient(context.userId);
    const { error } = await supabase.from("course_blueprints").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const setDefaultBlueprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        isDefault: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = await adminClient(context.userId);
    const { data: blueprint, error } = await supabase
      .from("course_blueprints")
      .select("id, course_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!blueprint) throw new Error("Blueprint not found");

    if (data.isDefault) {
      const { error: clearError } = await supabase
        .from("course_blueprints")
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .eq("course_id", blueprint.course_id)
        .eq("is_default", true);
      if (clearError) throw new Error(clearError.message);
    }

    const { error: updateError } = await supabase
      .from("course_blueprints")
      .update({ is_default: data.isDefault, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (updateError) throw new Error(updateError.message);
    return { ok: true as const };
  });

export const previewBlueprintDistribution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        blueprintId: z.string().uuid().optional(),
        questionCount: z.number().int().min(1).max(200),
        rules: z.array(blueprintRuleSchema).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = await adminClient(context.userId);
    let ruleInputs: BlueprintRuleInput[] = (data.rules ?? []).map((r) => ({
      topic: r.topic,
      subtopic: r.subtopic ?? null,
      weightage: r.weightage,
      min_questions: r.min_questions,
      max_questions: r.max_questions ?? null,
      easy_percentage: r.easy_percentage,
      medium_percentage: r.medium_percentage,
      hard_percentage: r.hard_percentage,
    }));
    if (data.blueprintId && ruleInputs.length === 0) {
      const { data: rules, error } = await supabase
        .from("blueprint_rules")
        .select("*")
        .eq("blueprint_id", data.blueprintId);
      if (error) throw error;
      ruleInputs = (rules ?? []).map((r) => ({
        topic: r.topic,
        subtopic: r.subtopic ?? null,
        weightage: Number(r.weightage),
        min_questions: r.min_questions,
        max_questions: r.max_questions ?? null,
        easy_percentage: Number(r.easy_percentage),
        medium_percentage: Number(r.medium_percentage),
        hard_percentage: Number(r.hard_percentage),
      }));
    }
    const allocations = finalizeAllocations(ruleInputs, data.questionCount);
    return { allocations, distribution: distributionMap(allocations) };
  });

// ——— Series ———

export const listAssessmentSeries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ courseId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const supabase = await adminClient(context.userId);
    let query = supabase
      .from("assessment_series")
      .select("*, courses(name), course_blueprints(name), question_pools(name)")
      .order("name", { ascending: true });
    if (data.courseId) query = query.eq("course_id", data.courseId);
    const { data: series, error } = await query;
    if (error) throw error;
    return { series: series ?? [] };
  });

export const upsertAssessmentSeries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        courseId: z.string().uuid(),
        blueprintId: z.string().uuid(),
        questionPoolId: z.string().uuid(),
        name: z.string().trim().min(2).max(120),
        reusePolicy: reusePolicySchema.default("until_pool_exhausted"),
        reuseLastN: z.number().int().min(1).max(50).default(5),
        status: catalogStatusSchema.default("active"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = await adminClient(context.userId);
    const payload = {
      course_id: data.courseId,
      blueprint_id: data.blueprintId,
      question_pool_id: data.questionPoolId,
      name: data.name,
      reuse_policy: data.reusePolicy,
      reuse_last_n: data.reuseLastN,
      status: data.status,
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      const { data: row, error } = await supabase
        .from("assessment_series")
        .update(payload)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await supabase
      .from("assessment_series")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteAssessmentSeries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = await adminClient(context.userId);
    const { error } = await supabase.from("assessment_series").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ——— Availability / generate ———

const generateInputSchema = z.object({
  examId: z.string().uuid().optional(),
  courseId: z.string().uuid(),
  poolId: z.string().uuid(),
  blueprintId: z.string().uuid(),
  seriesId: z.string().uuid().nullable().optional(),
  questionCount: z.number().int().min(1).max(200),
  reusePolicy: reusePolicySchema.default("until_pool_exhausted"),
  reuseLastN: z.number().int().min(1).max(50).default(5),
  allowPreviouslyUsed: z.boolean().default(false),
  persist: z.boolean().default(false),
});

export const checkQuestionAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    generateInputSchema.omit({ persist: true, examId: true }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = await adminClient(context.userId);
    const { data: rules, error } = await supabase
      .from("blueprint_rules")
      .select("*")
      .eq("blueprint_id", data.blueprintId);
    if (error) throw error;
    const allocations = finalizeAllocations(
      (rules ?? []).map((r) => ({
        topic: r.topic,
        subtopic: r.subtopic,
        weightage: Number(r.weightage),
        min_questions: r.min_questions,
        max_questions: r.max_questions,
        easy_percentage: Number(r.easy_percentage),
        medium_percentage: Number(r.medium_percentage),
        hard_percentage: Number(r.hard_percentage),
      })),
      data.questionCount,
    );

    const reusePolicy = (
      data.allowPreviouslyUsed ? "allow_reuse" : data.reusePolicy
    ) as ReusePolicy;
    const excluded = await loadExcludedPoolQuestionIds(supabase, {
      poolId: data.poolId,
      courseId: data.courseId,
      seriesId: data.seriesId ?? null,
      reusePolicy,
      reuseLastN: data.reuseLastN,
    });

    const { data: poolRows, error: poolError } = await supabase
      .from("pool_questions")
      .select("id, topic, subtopic, difficulty")
      .eq("pool_id", data.poolId)
      .eq("status", "active");
    if (poolError) throw poolError;

    const eligible = (poolRows ?? []).filter((q) => !excluded.has(q.id));
    const shortages = checkAvailabilityAgainstAllocations(allocations, eligible);
    return {
      allocations,
      distribution: distributionMap(allocations),
      eligibleCount: eligible.length,
      excludedCount: excluded.size,
      shortages,
      available: shortages.length === 0,
    };
  });

export const generateExamQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => generateInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = await adminClient(context.userId);
    if (data.persist && data.examId) {
      await assertExamRegeneratable(supabase, data.examId);
    }

    const result = await previewOrSelectQuestions(supabase, {
      poolId: data.poolId,
      blueprintId: data.blueprintId,
      courseId: data.courseId,
      seriesId: data.seriesId ?? null,
      questionCount: data.questionCount,
      reusePolicy: data.reusePolicy,
      reuseLastN: data.reuseLastN,
      excludeExamId: data.examId ?? null,
      allowPreviouslyUsed: data.allowPreviouslyUsed,
    });

    if (!result.ok) {
      return {
        ok: false as const,
        reason: "shortage" as const,
        shortages: result.shortages,
        allocations: result.allocations,
        distribution: result.distribution,
      };
    }

    if (data.persist && data.examId) {
      await persistGeneratedQuestions(supabase, {
        examId: data.examId,
        poolId: data.poolId,
        blueprintId: data.blueprintId,
        courseId: data.courseId,
        seriesId: data.seriesId ?? null,
        reusePolicy: data.reusePolicy,
        reuseLastN: data.reuseLastN,
        questionCount: data.questionCount,
        result,
      });
    }

    return {
      ok: true as const,
      questions: result.questions,
      selectedPoolQuestionIds: result.selectedPoolQuestionIds,
      allocations: result.allocations,
      distribution: result.distribution,
      blueprintVersion: result.blueprintVersion,
    };
  });

export const regenerateExamQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    generateInputSchema.extend({ examId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = await adminClient(context.userId);
    await assertExamRegeneratable(supabase, data.examId);

    const result = await previewOrSelectQuestions(supabase, {
      poolId: data.poolId,
      blueprintId: data.blueprintId,
      courseId: data.courseId,
      seriesId: data.seriesId ?? null,
      questionCount: data.questionCount,
      reusePolicy: data.reusePolicy,
      reuseLastN: data.reuseLastN,
      excludeExamId: data.examId ?? null,
      allowPreviouslyUsed: data.allowPreviouslyUsed,
    });

    if (!result.ok) {
      return {
        ok: false as const,
        reason: "shortage" as const,
        shortages: result.shortages,
        allocations: result.allocations,
        distribution: result.distribution,
      };
    }

    await persistGeneratedQuestions(supabase, {
      examId: data.examId,
      poolId: data.poolId,
      blueprintId: data.blueprintId,
      courseId: data.courseId,
      seriesId: data.seriesId ?? null,
      reusePolicy: data.reusePolicy,
      reuseLastN: data.reuseLastN,
      questionCount: data.questionCount,
      result,
    });

    return {
      ok: true as const,
      questions: result.questions,
      selectedPoolQuestionIds: result.selectedPoolQuestionIds,
      allocations: result.allocations,
      distribution: result.distribution,
      blueprintVersion: result.blueprintVersion,
    };
  });

export const getExamGenerationMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ examId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = await adminClient(context.userId);
    const { data: exam, error } = await supabase
      .from("exams")
      .select(
        "id, active, question_selection_method, course_id, question_pool_id, blueprint_id, series_id, reuse_policy, reuse_last_n, generation_locked_at, question_count",
      )
      .eq("id", data.examId)
      .maybeSingle();
    if (error) throw error;
    if (!exam) throw new Error("Assessment not found");

    const { count, error: countError } = await supabase
      .from("exam_attempts")
      .select("id", { count: "exact", head: true })
      .eq("exam_id", data.examId);
    if (countError) throw countError;

    return {
      exam,
      attemptCount: count ?? 0,
      canRegenerate: !exam.active && (count ?? 0) === 0,
    };
  });
