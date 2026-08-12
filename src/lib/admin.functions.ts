import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getAdminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/platform.server");
    await requireAdmin(context.userId);

    const [
      { data: profiles },
      { data: attempts },
      { data: xp },
      { data: badges },
      { data: streaks },
      { data: exams },
      { data: mastery },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, email, organization, department"),
      supabaseAdmin
        .from("exam_attempts")
        .select("user_id, exam_id, score, passed, submitted_at, status")
        .eq("status", "submitted"),
      supabaseAdmin.from("xp_transactions").select("user_id, points"),
      supabaseAdmin.from("user_badges").select("user_id"),
      supabaseAdmin
        .from("user_streaks")
        .select("user_id, streak_type, current_count, longest_count"),
      supabaseAdmin.from("exams").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("topic_mastery").select("topic, subtopic, mastery, total_count"),
    ]);

    const xpByUser = new Map<string, number>();
    for (const row of xp ?? [])
      xpByUser.set(row.user_id, (xpByUser.get(row.user_id) ?? 0) + (row.points ?? 0));
    const badgesByUser = new Map<string, number>();
    for (const row of badges ?? [])
      badgesByUser.set(row.user_id, (badgesByUser.get(row.user_id) ?? 0) + 1);
    const attemptsByUser = new Map<string, number[]>();
    for (const row of attempts ?? []) {
      const list = attemptsByUser.get(row.user_id) ?? [];
      list.push(Number(row.score ?? 0));
      attemptsByUser.set(row.user_id, list);
    }

    const participants = (profiles ?? []).map((p) => {
      const scores = attemptsByUser.get(p.id) ?? [];
      const average = scores.length
        ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
        : 0;
      const improvement =
        scores.length >= 2 ? Math.round((scores[scores.length - 1] ?? 0) - (scores[0] ?? 0)) : 0;
      const streak =
        (streaks ?? []).find((s) => s.user_id === p.id && s.streak_type === "pass")
          ?.longest_count ?? 0;
      return {
        id: p.id,
        name: p.full_name || p.email,
        organization: p.organization,
        department: p.department,
        xp: xpByUser.get(p.id) ?? 0,
        badges: badgesByUser.get(p.id) ?? 0,
        completed: scores.length,
        average,
        improvement,
        passStreak: streak,
      };
    });

    const topicAgg = new Map<string, { sum: number; count: number }>();
    for (const row of mastery ?? []) {
      const key = `${row.topic} · ${row.subtopic}`;
      const bucket = topicAgg.get(key) ?? { sum: 0, count: 0 };
      bucket.sum += Number(row.mastery);
      bucket.count += 1;
      topicAgg.set(key, bucket);
    }

    return {
      totals: {
        participants: (profiles ?? []).length,
        attempts: (attempts ?? []).length,
        exams: (exams ?? []).length,
        averageScore: (attempts ?? []).length
          ? Math.round(
              (attempts ?? []).reduce((s, a) => s + Number(a.score ?? 0), 0) /
                (attempts ?? []).length,
            )
          : 0,
        passRate: (attempts ?? []).length
          ? Math.round(
              ((attempts ?? []).filter((a) => a.passed).length / (attempts ?? []).length) * 100,
            )
          : 0,
      },
      participants,
      exams: (exams ?? []).map((e) => ({
        id: e.id,
        title: e.title,
        topic: e.topic,
        mode: e.mode,
        access: e.access,
        active: e.active,
        passMark: e.pass_mark,
        questionCount: e.question_count,
        duration: e.duration_minutes,
        maxAttempts: e.max_attempts,
        enableXp: e.enable_xp,
        enableBadges: e.enable_badges,
        enableLeaderboard: e.enable_leaderboard,
        showRank: e.show_rank,
        showOthers: e.show_others,
        nameDisplay: e.leaderboard_name_display,
        startsAt: e.starts_at,
        endsAt: (e as { ends_at?: string | null }).ends_at ?? null,
        attempts: (attempts ?? []).filter((a) => a.exam_id === e.id).length,
      })),
      weakestTopics: [...topicAgg.entries()]
        .map(([key, b]) => ({ key, average: Math.round(b.sum / b.count) }))
        .sort((a, b) => a.average - b.average)
        .slice(0, 6),
    };
  });

export const updateExamSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        examId: z.string().uuid(),
        enable_xp: z.boolean(),
        enable_badges: z.boolean(),
        enable_leaderboard: z.boolean(),
        show_rank: z.boolean(),
        show_others: z.boolean(),
        leaderboard_name_display: z.enum([
          "full_name",
          "first_initial",
          "display_name",
          "anonymous",
        ]),
        active: z.boolean(),
        starts_at: z.string().datetime().nullable().optional(),
        ends_at: z.string().datetime().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/platform.server");
    await requireAdmin(context.userId);
    const { examId, starts_at, ends_at, ...rest } = data;
    if (starts_at && ends_at && new Date(ends_at) <= new Date(starts_at)) {
      throw new Error("End date must be after the start date.");
    }
    const { error } = await supabaseAdmin
      .from("exams")
      .update({
        ...rest,
        starts_at: starts_at ?? null,
        ends_at: ends_at ?? null,
      })
      .eq("id", examId);
    if (error) throw error;
    return { ok: true };
  });

export const createExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        title: z.string().trim().min(3).max(140),
        description: z.string().trim().max(600).default(""),
        topic: z.string().trim().min(2).max(60),
        mode: z.enum(["practice", "assessment", "competitive", "certification"]),
        duration_minutes: z.number().int().min(1).max(300),
        pass_mark: z.number().int().min(1).max(100),
        max_attempts: z.number().int().min(1).max(99),
        access: z.enum(["public", "private", "organization", "group"]),
        organization: z.string().trim().max(120).optional().or(z.literal("")),
        team_group: z.string().trim().max(120).optional().or(z.literal("")),
        invitations: z.string().max(4000).optional().or(z.literal("")),
        active: z.boolean().default(true),
        starts_at: z.string().datetime().nullable().optional(),
        ends_at: z.string().datetime().nullable().optional(),
        questions: z
          .array(
            z.object({
              prompt: z.string().trim().min(4).max(600),
              options: z.array(z.string().trim().min(1).max(300)).min(2).max(6),
              correct_index: z.number().int().min(0).max(5),
              correct_indexes: z.array(z.number().int().min(0).max(5)).min(1).max(6).optional(),
              multi_select: z.boolean().default(false),
              subtopic: z.string().trim().max(60).default("general"),
              explanation: z.string().trim().max(600).default(""),
            }),
          )
          .min(1)
          .max(200),
      })
      .superRefine((value, ctx) => {
        if (
          value.starts_at &&
          value.ends_at &&
          new Date(value.ends_at) <= new Date(value.starts_at)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "End date must be after the start date.",
          });
        }
        for (const [index, question] of value.questions.entries()) {
          const indexes = [...new Set(question.correct_indexes ?? [question.correct_index])].filter(
            (item) => item < question.options.length,
          );
          if (indexes.length === 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Question ${index + 1} needs a valid correct answer.`,
            });
          }
          if (!question.multi_select && indexes.length > 1) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Question ${index + 1}: enable multi-select for multiple answers.`,
            });
          }
        }
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/platform.server");
    await requireAdmin(context.userId);

    const { data: exam, error } = await supabaseAdmin
      .from("exams")
      .insert({
        title: data.title,
        description: data.description,
        topic: data.topic,
        mode: data.mode,
        question_count: data.questions.length,
        duration_minutes: data.duration_minutes,
        pass_mark: data.pass_mark,
        max_attempts: data.max_attempts,
        access: data.access,
        organization: data.organization || null,
        team_group: data.team_group || null,
        created_by: context.userId,
        active: data.active,
        starts_at: data.starts_at ?? null,
        ends_at: data.ends_at ?? null,
        enable_leaderboard: data.mode !== "practice",
        enable_xp: true,
        enable_badges: data.mode !== "certification",
      })
      .select("id")
      .single();
    if (error) throw error;

    const { error: qError } = await supabaseAdmin.from("questions").insert(
      data.questions.map((q) => {
        const correctIndexes = [...new Set(q.correct_indexes ?? [q.correct_index])]
          .filter((index) => index < q.options.length)
          .sort((a, b) => a - b);
        return {
          exam_id: exam.id,
          prompt: q.prompt,
          options: q.options,
          correct_index: correctIndexes[0] ?? 0,
          correct_indexes: q.multi_select ? correctIndexes : [correctIndexes[0] ?? 0],
          subtopic: q.subtopic || "general",
          explanation: q.explanation,
        };
      }),
    );
    if (qError) throw qError;

    const { parseEmailList, sendExamInvitationEmails } = await import("@/lib/email.server");
    const emails = parseEmailList(data.invitations);
    if (emails.length > 0) {
      await supabaseAdmin.from("exam_invitations").upsert(
        emails.map((email) => ({ exam_id: exam.id, email })),
        { onConflict: "exam_id,email" },
      );
      const { data: invited } = await supabaseAdmin
        .from("profiles")
        .select("id, email")
        .in("email", emails);
      const { notify } = await import("@/lib/platform.server");
      for (const profile of invited ?? []) {
        await notify(profile.id, {
          kind: "invitation",
          icon: "✉️",
          title: `You have been invited to ${data.title}`,
          body: "Open My Exams to start when you are ready.",
          href: `/exams/${exam.id}`,
          ctaLabel: "Open assessment",
          // Bulk Resend below covers all invitees (registered + guest).
          email: false,
        });
      }
      await sendExamInvitationEmails({
        emails,
        examId: exam.id,
        title: data.title,
        description: data.description,
      });
    }
    return { examId: exam.id as string };
  });

const examQuestionSchema = z.object({
  prompt: z.string().trim().min(4).max(600),
  options: z.array(z.string().trim().min(1).max(300)).min(2).max(6),
  correct_index: z.number().int().min(0).max(5),
  correct_indexes: z.array(z.number().int().min(0).max(5)).min(1).max(6).optional(),
  multi_select: z.boolean().default(false),
  subtopic: z.string().trim().max(60).default("general"),
  explanation: z.string().trim().max(600).default(""),
});

const examWriteObjectSchema = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().max(600).default(""),
  topic: z.string().trim().min(2).max(60),
  mode: z.enum(["practice", "assessment", "competitive", "certification"]),
  duration_minutes: z.number().int().min(1).max(300),
  pass_mark: z.number().int().min(1).max(100),
  max_attempts: z.number().int().min(1).max(99),
  access: z.enum(["public", "private", "organization", "group"]),
  organization: z.string().trim().max(120).optional().or(z.literal("")),
  team_group: z.string().trim().max(120).optional().or(z.literal("")),
  invitations: z.string().max(4000).optional().or(z.literal("")),
  active: z.boolean().default(true),
  starts_at: z.string().datetime().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
  questions: z.array(examQuestionSchema).min(1).max(200),
});

function refineExamWrite(value: z.infer<typeof examWriteObjectSchema>, ctx: z.RefinementCtx) {
  if (value.starts_at && value.ends_at && new Date(value.ends_at) <= new Date(value.starts_at)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "End date must be after the start date.",
    });
  }
  for (const [index, question] of value.questions.entries()) {
    const indexes = [...new Set(question.correct_indexes ?? [question.correct_index])].filter(
      (item) => item < question.options.length,
    );
    if (indexes.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Question ${index + 1} needs a valid correct answer.`,
      });
    }
    if (!question.multi_select && indexes.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Question ${index + 1}: enable multi-select for multiple answers.`,
      });
    }
  }
}

const examWriteSchema = examWriteObjectSchema.superRefine(refineExamWrite);
const examUpdateSchema = examWriteObjectSchema
  .extend({ examId: z.string().uuid() })
  .superRefine(refineExamWrite);

function mapQuestionsForInsert(examId: string, questions: z.infer<typeof examQuestionSchema>[]) {
  return questions.map((q) => {
    const correctIndexes = [...new Set(q.correct_indexes ?? [q.correct_index])]
      .filter((index) => index < q.options.length)
      .sort((a, b) => a - b);
    return {
      exam_id: examId,
      prompt: q.prompt,
      options: q.options,
      correct_index: correctIndexes[0] ?? 0,
      correct_indexes: q.multi_select ? correctIndexes : [correctIndexes[0] ?? 0],
      subtopic: q.subtopic || "general",
      explanation: q.explanation,
    };
  });
}

/** Admin: load one assessment with questions for editing. */
export const getExamForEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ examId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/platform.server");
    await requireAdmin(context.userId);

    const [{ data: exam, error }, { data: questions, error: qError }, { data: invitations }] =
      await Promise.all([
        supabaseAdmin.from("exams").select("*").eq("id", data.examId).maybeSingle(),
        supabaseAdmin
          .from("questions")
          .select("*")
          .eq("exam_id", data.examId)
          .order("created_at", { ascending: true }),
        supabaseAdmin.from("exam_invitations").select("email").eq("exam_id", data.examId),
      ]);
    if (error) throw error;
    if (qError) throw qError;
    if (!exam) throw new Error("Assessment not found");

    const { data: categoryRows } = await supabaseAdmin
      .from("exams")
      .select("topic")
      .order("topic", { ascending: true });

    const categories = [
      ...new Set((categoryRows ?? []).map((row) => row.topic).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));

    return {
      categories,
      exam: {
        id: exam.id,
        title: exam.title,
        description: exam.description ?? "",
        topic: exam.topic,
        mode: exam.mode,
        duration_minutes: exam.duration_minutes,
        pass_mark: exam.pass_mark,
        max_attempts: exam.max_attempts,
        access: exam.access,
        organization: exam.organization ?? "",
        team_group: exam.team_group ?? "",
        active: exam.active,
        starts_at: exam.starts_at,
        ends_at: (exam as { ends_at?: string | null }).ends_at ?? null,
        invitations: (invitations ?? []).map((row) => row.email).join(", "),
        questions: (questions ?? []).map((q) => {
          const indexes =
            Array.isArray((q as { correct_indexes?: number[] }).correct_indexes) &&
            (q as { correct_indexes?: number[] }).correct_indexes!.length > 0
              ? (q as { correct_indexes: number[] }).correct_indexes
              : [q.correct_index];
          return {
            prompt: q.prompt,
            options: (q.options as string[]) ?? [],
            correct_index: indexes[0] ?? 0,
            correct_indexes: indexes,
            multi_select: indexes.length > 1,
            subtopic: q.subtopic || "general",
            explanation: q.explanation ?? "",
          };
        }),
      },
    };
  });

/** Admin: update assessment details and replace its question bank. */
export const updateExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => examUpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/platform.server");
    await requireAdmin(context.userId);

    const { examId, invitations, questions, ...examFields } = data;
    const { error } = await supabaseAdmin
      .from("exams")
      .update({
        title: examFields.title,
        description: examFields.description,
        topic: examFields.topic,
        mode: examFields.mode,
        question_count: questions.length,
        duration_minutes: examFields.duration_minutes,
        pass_mark: examFields.pass_mark,
        max_attempts: examFields.max_attempts,
        access: examFields.access,
        organization: examFields.organization || null,
        team_group: examFields.team_group || null,
        active: examFields.active,
        starts_at: examFields.starts_at ?? null,
        ends_at: examFields.ends_at ?? null,
      })
      .eq("id", examId);
    if (error) throw error;

    const { error: deleteError } = await supabaseAdmin
      .from("questions")
      .delete()
      .eq("exam_id", examId);
    if (deleteError) throw deleteError;

    const { error: qError } = await supabaseAdmin
      .from("questions")
      .insert(mapQuestionsForInsert(examId, questions));
    if (qError) throw qError;

    const { data: previousInvites } = await supabaseAdmin
      .from("exam_invitations")
      .select("email")
      .eq("exam_id", examId);
    const previousEmails = new Set((previousInvites ?? []).map((row) => row.email.toLowerCase()));

    await supabaseAdmin.from("exam_invitations").delete().eq("exam_id", examId);
    const { parseEmailList, sendExamInvitationEmails } = await import("@/lib/email.server");
    const emails = parseEmailList(invitations);
    if (emails.length > 0) {
      await supabaseAdmin.from("exam_invitations").upsert(
        emails.map((email: string) => ({ exam_id: examId, email })),
        { onConflict: "exam_id,email" },
      );
      const newEmails = emails.filter((email) => !previousEmails.has(email));
      if (newEmails.length > 0) {
        const { data: invited } = await supabaseAdmin
          .from("profiles")
          .select("id, email")
          .in("email", newEmails);
        const { notify } = await import("@/lib/platform.server");
        for (const profile of invited ?? []) {
          await notify(profile.id, {
            kind: "invitation",
            icon: "✉️",
            title: `You have been invited to ${examFields.title}`,
            body: "Open My Exams to start when you are ready.",
            href: `/exams/${examId}`,
            ctaLabel: "Open assessment",
            email: false,
          });
        }
        await sendExamInvitationEmails({
          emails: newEmails,
          examId,
          title: examFields.title,
          description: examFields.description,
        });
      }
    }

    return { examId };
  });

/** Admin: delete an assessment (cascades questions/attempts). */
export const deleteExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ examId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/platform.server");
    await requireAdmin(context.userId);
    const { error } = await supabaseAdmin.from("exams").delete().eq("id", data.examId);
    if (error) throw error;
    return { ok: true };
  });

/** Admin: publish or unpublish an assessment. */
export const setExamPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ examId: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/platform.server");
    await requireAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("exams")
      .update({ active: data.active })
      .eq("id", data.examId);
    if (error) throw error;
    return { ok: true };
  });

/** Admin: categories already used across assessments (for pickers). */
export const listExamCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/platform.server");
    await requireAdmin(context.userId);
    const { data, error } = await supabaseAdmin.from("exams").select("topic");
    if (error) throw error;
    const categories = [...new Set((data ?? []).map((row) => row.topic).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b),
    );
    return { categories };
  });

export const upsertBadge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        code: z
          .string()
          .trim()
          .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers, underscores")
          .max(60),
        name: z.string().trim().min(2).max(80),
        description: z.string().trim().max(240).default(""),
        icon: z.string().trim().min(1).max(8),
        category: z.string().trim().max(40).default("custom"),
        track: z.enum(["beginner", "intermediate", "expertise", "elite"]).default("intermediate"),
        condition_type: z.enum([
          "pass_count",
          "attempt_count",
          "single_score",
          "average_over",
          "pass_streak",
          "fast_high_score",
          "improvement",
          "comeback",
          "topic_average",
          "top_rank",
        ]),
        condition_value: z.number().min(0).max(1000),
        condition_topic: z.string().trim().max(60).optional().or(z.literal("")),
        xp_reward: z.number().int().min(0).max(2000),
        active: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/platform.server");
    await requireAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("badges")
      .upsert({ ...data, condition_topic: data.condition_topic || null }, { onConflict: "code" });
    if (error) throw error;
    return { ok: true };
  });

export const listBadgeConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/platform.server");
    await requireAdmin(context.userId);
    const [{ data: badges }, { data: rules }] = await Promise.all([
      supabaseAdmin.from("badges").select("*").order("category"),
      supabaseAdmin.from("xp_rules").select("*").order("points", { ascending: false }),
    ]);
    return { badges: badges ?? [], rules: rules ?? [] };
  });

export const updateXpRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        code: z.string().max(60),
        points: z.number().int().min(0).max(1000),
        active: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/platform.server");
    await requireAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("xp_rules")
      .update({ points: data.points, active: data.active })
      .eq("code", data.code);
    if (error) throw error;
    return { ok: true };
  });

/** Admin: users list with activity and performance rollups. */
export const getAdminUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/platform.server");
    await requireAdmin(context.userId);

    const [{ data: profiles }, { data: roles }, { data: attempts }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select(
          "id, full_name, email, organization, department, participant_id, mobile, created_at, updated_at, leaderboard_opt_out",
        )
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin
        .from("exam_attempts")
        .select("id, user_id, exam_id, score, passed, status, started_at, submitted_at")
        .order("started_at", { ascending: false }),
    ]);

    const roleByUser = new Map<string, string[]>();
    for (const row of roles ?? []) {
      const list = roleByUser.get(row.user_id) ?? [];
      list.push(row.role);
      roleByUser.set(row.user_id, list);
    }

    const users = (profiles ?? []).map((profile) => {
      const userAttempts = (attempts ?? []).filter((a) => a.user_id === profile.id);
      const submitted = userAttempts.filter((a) => a.status === "submitted");
      const inProgress = userAttempts.filter((a) => a.status === "in_progress");
      const passed = submitted.filter((a) => a.passed);
      const scores = submitted.map((a) => Number(a.score ?? 0));
      const examsOpted = new Set(userAttempts.map((a) => a.exam_id)).size;
      const examsCompleted = new Set(submitted.map((a) => a.exam_id)).size;
      const lastActivity =
        userAttempts[0]?.submitted_at || userAttempts[0]?.started_at || profile.updated_at;

      return {
        id: profile.id,
        name: profile.full_name || profile.email,
        email: profile.email,
        organization: profile.organization,
        department: profile.department,
        participantId: profile.participant_id,
        mobile: profile.mobile,
        roles: roleByUser.get(profile.id) ?? ["participant"],
        isAdmin: (roleByUser.get(profile.id) ?? []).includes("admin"),
        leaderboardOptOut: profile.leaderboard_opt_out,
        createdAt: profile.created_at,
        lastActivity,
        optedAssessments: examsOpted,
        completedAssessments: examsCompleted,
        completionRate: examsOpted ? Math.round((examsCompleted / examsOpted) * 100) : 0,
        attempts: userAttempts.length,
        submitted: submitted.length,
        inProgress: inProgress.length,
        passRate: submitted.length ? Math.round((passed.length / submitted.length) * 100) : 0,
        averageScore: scores.length
          ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
          : 0,
        bestScore: scores.length ? Math.max(...scores) : null,
      };
    });

    return { users };
  });

/** Admin: one user's activity timeline and per-assessment performance. */
export const getAdminUserDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/platform.server");
    await requireAdmin(context.userId);

    const [{ data: profile }, { data: roles }, { data: attempts }, { data: exams }] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("*").eq("id", data.userId).maybeSingle(),
        supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId),
        supabaseAdmin
          .from("exam_attempts")
          .select(
            "id, exam_id, score, passed, status, started_at, submitted_at, duration_seconds, correct_count, question_ids",
          )
          .eq("user_id", data.userId)
          .order("started_at", { ascending: false }),
        supabaseAdmin.from("exams").select("id, title, topic, pass_mark, active"),
      ]);

    if (!profile) throw new Error("User not found");

    const examById = new Map((exams ?? []).map((exam) => [exam.id, exam]));
    const byExam = new Map<
      string,
      {
        examId: string;
        title: string;
        topic: string;
        passMark: number;
        attempts: number;
        submitted: number;
        bestScore: number | null;
        passed: boolean;
        lastStatus: string;
        lastAt: string | null;
      }
    >();

    for (const attempt of attempts ?? []) {
      const exam = examById.get(attempt.exam_id);
      const current = byExam.get(attempt.exam_id) ?? {
        examId: attempt.exam_id,
        title: exam?.title ?? "Assessment",
        topic: exam?.topic ?? "—",
        passMark: exam?.pass_mark ?? 0,
        attempts: 0,
        submitted: 0,
        bestScore: null as number | null,
        passed: false,
        lastStatus: attempt.status,
        lastAt: attempt.submitted_at ?? attempt.started_at,
      };
      current.attempts += 1;
      if (attempt.status === "submitted") {
        current.submitted += 1;
        const score = Number(attempt.score ?? 0);
        current.bestScore = current.bestScore == null ? score : Math.max(current.bestScore, score);
        if (attempt.passed) current.passed = true;
      }
      byExam.set(attempt.exam_id, current);
    }

    return {
      profile: {
        id: profile.id,
        name: profile.full_name || profile.email,
        fullName: profile.full_name || "",
        email: profile.email,
        organization: profile.organization ?? "",
        department: profile.department ?? "",
        participantId: profile.participant_id ?? "",
        mobile: profile.mobile ?? "",
        displayName: profile.display_name ?? "",
        teamGroup: profile.team_group ?? "",
        roles: (roles ?? []).map((r) => r.role),
        isAdmin: (roles ?? []).some((r) => r.role === "admin"),
        leaderboardOptOut: profile.leaderboard_opt_out,
        createdAt: profile.created_at,
      },
      assessments: [...byExam.values()].sort((a, b) =>
        (b.lastAt ?? "").localeCompare(a.lastAt ?? ""),
      ),
      activity: (attempts ?? []).map((attempt) => {
        const exam = examById.get(attempt.exam_id);
        return {
          id: attempt.id,
          examId: attempt.exam_id,
          title: exam?.title ?? "Assessment",
          topic: exam?.topic ?? "—",
          status: attempt.status,
          score: attempt.score == null ? null : Number(attempt.score),
          passed: attempt.passed,
          startedAt: attempt.started_at,
          submittedAt: attempt.submitted_at,
          durationSeconds: attempt.duration_seconds,
          correctCount: attempt.correct_count,
          questionCount: attempt.question_ids?.length ?? 0,
        };
      }),
    };
  });

/** Admin: per-assessment opted/completion/pass metrics + leaderboard. */
export const getAdminAssessmentPerformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/platform.server");
    await requireAdmin(context.userId);

    const [{ data: exams }, { data: attempts }, { data: profiles }] = await Promise.all([
      supabaseAdmin.from("exams").select("*").order("created_at", { ascending: false }),
      supabaseAdmin
        .from("exam_attempts")
        .select("id, user_id, exam_id, score, passed, status, started_at, submitted_at"),
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, display_name, organization, leaderboard_opt_out"),
    ]);

    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

    const assessments = (exams ?? []).map((exam) => {
      const examAttempts = (attempts ?? []).filter((a) => a.exam_id === exam.id);
      const optedUsers = new Set(examAttempts.map((a) => a.user_id));
      const submitted = examAttempts.filter((a) => a.status === "submitted");
      const completedUsers = new Set(submitted.map((a) => a.user_id));
      const passedUsers = new Set(submitted.filter((a) => a.passed).map((a) => a.user_id));

      const bestByUser = new Map<
        string,
        { score: number; passed: boolean; submittedAt: string | null }
      >();
      for (const attempt of submitted) {
        const score = Number(attempt.score ?? 0);
        const current = bestByUser.get(attempt.user_id);
        if (!current || score > current.score) {
          bestByUser.set(attempt.user_id, {
            score,
            passed: !!attempt.passed,
            submittedAt: attempt.submitted_at,
          });
        }
      }

      const leaderboard = [...bestByUser.entries()]
        .map(([userId, row]) => {
          const profile = profileById.get(userId);
          return {
            userId,
            name: profile?.full_name || profile?.email || "Participant",
            email: profile?.email ?? "",
            organization: profile?.organization ?? null,
            score: row.score,
            passed: row.passed,
            submittedAt: row.submittedAt,
            optedOut: !!profile?.leaderboard_opt_out,
          };
        })
        .sort((a, b) => b.score - a.score || (a.name ?? "").localeCompare(b.name ?? ""))
        .map((row, index) => ({ ...row, rank: index + 1 }));

      const scores = [...bestByUser.values()].map((row) => row.score);
      const opted = optedUsers.size;
      const completed = completedUsers.size;

      return {
        id: exam.id,
        title: exam.title,
        topic: exam.topic,
        mode: exam.mode,
        active: exam.active,
        passMark: exam.pass_mark,
        opted,
        completed,
        completionRate: opted ? Math.round((completed / opted) * 100) : 0,
        passRate: completed ? Math.round((passedUsers.size / completed) * 100) : 0,
        averageBestScore: scores.length
          ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
          : 0,
        inProgress: examAttempts.filter((a) => a.status === "in_progress").length,
        leaderboard: leaderboard.slice(0, 20),
      };
    });

    const totals = {
      assessments: assessments.length,
      opted: assessments.reduce((sum, exam) => sum + exam.opted, 0),
      completed: assessments.reduce((sum, exam) => sum + exam.completed, 0),
      averageCompletion: assessments.length
        ? Math.round(
            assessments.reduce((sum, exam) => sum + exam.completionRate, 0) / assessments.length,
          )
        : 0,
      averagePassRate: assessments.length
        ? Math.round(assessments.reduce((sum, exam) => sum + exam.passRate, 0) / assessments.length)
        : 0,
    };

    return { assessments, totals };
  });

/** Admin: promote/demote user role. */
export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "participant"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/platform.server");
    await requireAdmin(context.userId);

    if (data.userId === context.userId && data.role !== "admin") {
      throw new Error("You cannot remove your own administrator role.");
    }

    if (data.role === "admin") {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "admin");
      if (error) throw error;
      const { data: remaining } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", data.userId);
      if (!remaining?.length) {
        await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: data.userId, role: "participant" }, { onConflict: "user_id,role" });
      }
    }

    return { ok: true };
  });

/** Admin: ban / unban a user (blocks further auth). */
export const setUserBanned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        banned: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/platform.server");
    await requireAdmin(context.userId);

    if (data.userId === context.userId) {
      throw new Error("You cannot ban your own account.");
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.banned ? "876000h" : "none",
    });
    if (error) throw error;
    return { ok: true };
  });

/** Admin: edit participant profile fields. */
export const updateAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        full_name: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(200),
        organization: z.string().trim().max(120).optional().or(z.literal("")),
        department: z.string().trim().max(120).optional().or(z.literal("")),
        mobile: z.string().trim().max(40).optional().or(z.literal("")),
        participant_id: z.string().trim().max(80).optional().or(z.literal("")),
        display_name: z.string().trim().max(80).optional().or(z.literal("")),
        team_group: z.string().trim().max(120).optional().or(z.literal("")),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { allocateParticipantIdForSave, requireAdmin } = await import("@/lib/platform.server");
    await requireAdmin(context.userId);

    const { userId, ...profile } = data;
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("participant_id")
      .eq("id", userId)
      .maybeSingle();
    const teamGroup = profile.department || profile.team_group || null;
    const participantId =
      existing?.participant_id?.trim() ||
      (await allocateParticipantIdForSave(profile.participant_id || null));

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: profile.full_name,
        email: profile.email,
        organization: profile.organization || null,
        department: teamGroup,
        mobile: profile.mobile || null,
        participant_id: participantId,
        display_name: profile.display_name || null,
        team_group: teamGroup,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (error) throw error;

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email: profile.email,
      user_metadata: {
        full_name: profile.full_name,
        display_name: profile.display_name || profile.full_name,
      },
    });
    if (authError) throw authError;

    return { ok: true };
  });

/** Admin: permanently delete a user and related profile/role rows. */
export const deleteAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/platform.server");
    await requireAdmin(context.userId);

    if (data.userId === context.userId) {
      throw new Error("You cannot delete your own account.");
    }

    await Promise.all([
      supabaseAdmin.from("exam_attempts").delete().eq("user_id", data.userId),
      supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId),
      supabaseAdmin.from("xp_transactions").delete().eq("user_id", data.userId),
      supabaseAdmin.from("user_badges").delete().eq("user_id", data.userId),
      supabaseAdmin.from("user_streaks").delete().eq("user_id", data.userId),
      supabaseAdmin.from("topic_mastery").delete().eq("user_id", data.userId),
      supabaseAdmin.from("notifications").delete().eq("user_id", data.userId),
    ]);

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", data.userId);
    if (profileError) throw profileError;

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw error;
    return { ok: true };
  });

/**
 * Danger zone: wipe all assessments and non-admin participant data.
 * Keeps seeded admin (SEED_ADMIN_EMAIL), the calling admin, and baseline
 * levels / badges / xp_rules configuration.
 */
export const wipePlatformData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        confirm: z.literal("WIPE DATA", {
          errorMap: () => ({ message: "Type WIPE DATA exactly to confirm." }),
        }),
      })
      .parse(input),
  )
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/platform.server");
    await requireAdmin(context.userId);

    const seedEmail = (process.env["SEED_ADMIN_EMAIL"] || "").trim().toLowerCase();
    const preserveIds = new Set<string>([context.userId]);

    if (seedEmail) {
      const { data: seedProfile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", seedEmail)
        .maybeSingle();
      if (seedProfile?.id) preserveIds.add(seedProfile.id);

      // Auth list fallback if profile email drifted
      const { data: listed } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      for (const user of listed?.users ?? []) {
        if (user.email?.toLowerCase() === seedEmail) preserveIds.add(user.id);
      }
    }

    // 1) Remove every assessment (cascades questions, invitations, attempts).
    const { data: exams } = await supabaseAdmin.from("exams").select("id");
    const examIds = (exams ?? []).map((row) => row.id as string);
    if (examIds.length > 0) {
      const { error: examError } = await supabaseAdmin.from("exams").delete().in("id", examIds);
      if (examError) throw examError;
    }

    // 2) Collect every profile/auth user except preserved admins.
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, email");
    const wipeIds = new Set<string>();
    for (const profile of profiles ?? []) {
      if (!preserveIds.has(profile.id)) wipeIds.add(profile.id);
    }

    // Page through auth users in case a user has no profile row.
    for (let page = 1; page <= 20; page += 1) {
      const { data: listed, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) throw error;
      const users = listed?.users ?? [];
      if (users.length === 0) break;
      for (const user of users) {
        if (!preserveIds.has(user.id)) wipeIds.add(user.id);
      }
      if (users.length < 200) break;
    }

    let deletedUsers = 0;
    for (const userId of wipeIds) {
      await Promise.all([
        supabaseAdmin.from("exam_attempts").delete().eq("user_id", userId),
        supabaseAdmin.from("user_roles").delete().eq("user_id", userId),
        supabaseAdmin.from("xp_transactions").delete().eq("user_id", userId),
        supabaseAdmin.from("user_badges").delete().eq("user_id", userId),
        supabaseAdmin.from("user_streaks").delete().eq("user_id", userId),
        supabaseAdmin.from("topic_mastery").delete().eq("user_id", userId),
        supabaseAdmin.from("notifications").delete().eq("user_id", userId),
      ]);
      await supabaseAdmin.from("profiles").delete().eq("id", userId);
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) {
        console.error("[wipe] failed to delete auth user", userId, error.message);
        continue;
      }
      deletedUsers += 1;
    }

    // 3) Clear leftover participant activity for preserved admins (keep account + role).
    for (const adminId of preserveIds) {
      await Promise.all([
        supabaseAdmin.from("exam_attempts").delete().eq("user_id", adminId),
        supabaseAdmin.from("xp_transactions").delete().eq("user_id", adminId),
        supabaseAdmin.from("user_badges").delete().eq("user_id", adminId),
        supabaseAdmin.from("topic_mastery").delete().eq("user_id", adminId),
        supabaseAdmin.from("notifications").delete().eq("user_id", adminId),
      ]);
      await supabaseAdmin.from("user_streaks").upsert(
        [
          {
            user_id: adminId,
            streak_type: "exam",
            current_count: 0,
            longest_count: 0,
          },
          {
            user_id: adminId,
            streak_type: "pass",
            current_count: 0,
            longest_count: 0,
          },
          {
            user_id: adminId,
            streak_type: "high_score",
            current_count: 0,
            longest_count: 0,
          },
        ],
        { onConflict: "user_id,streak_type" },
      );
    }

    return {
      ok: true as const,
      deletedExams: examIds.length,
      deletedUsers,
      preservedUsers: preserveIds.size,
    };
  });

/** Admin: full org/department catalog including inactive rows. */
export const getAdminOrganizations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/platform.server");
    await requireAdmin(context.userId);

    const [{ data: organizations, error: orgError }, { data: departments, error: deptError }] =
      await Promise.all([
        supabaseAdmin
          .from("organizations")
          .select("id, name, active, created_at")
          .order("name", { ascending: true }),
        supabaseAdmin
          .from("departments")
          .select("id, organization_id, name, active, created_at")
          .order("name", { ascending: true }),
      ]);
    if (orgError) throw orgError;
    if (deptError) throw deptError;

    return {
      organizations: organizations ?? [],
      departments: departments ?? [],
    };
  });

export const upsertOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(2).max(120),
        active: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/platform.server");
    await requireAdmin(context.userId);

    const payload = {
      name: data.name,
      active: data.active,
      updated_at: new Date().toISOString(),
    };

    if (data.id) {
      const { error } = await supabaseAdmin.from("organizations").update(payload).eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }

    const { data: created, error } = await supabaseAdmin
      .from("organizations")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    return { id: created.id as string };
  });

export const upsertDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        organizationId: z.string().uuid(),
        name: z.string().trim().min(2).max(120),
        active: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/platform.server");
    await requireAdmin(context.userId);

    const payload = {
      organization_id: data.organizationId,
      name: data.name,
      active: data.active,
      updated_at: new Date().toISOString(),
    };

    if (data.id) {
      const { error } = await supabaseAdmin.from("departments").update(payload).eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }

    const { data: created, error } = await supabaseAdmin
      .from("departments")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    return { id: created.id as string };
  });

export const deleteOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/platform.server");
    await requireAdmin(context.userId);
    const { error } = await supabaseAdmin.from("organizations").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

export const deleteDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/platform.server");
    await requireAdmin(context.userId);
    const { error } = await supabaseAdmin.from("departments").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });
