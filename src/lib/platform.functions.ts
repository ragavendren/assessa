import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Bootstraps the signed-in participant: profile row, role, streak rows. */
export const getMe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ensureProfile, getXpTotal, getLevels } = await import("@/lib/platform.server");
    const { resolveLevel } = await import("@/lib/gamification");
    const { profile, isAdmin } = await ensureProfile(
      context.userId,
      context.claims as unknown as Record<string, unknown>,
    );
    const [xp, levels] = await Promise.all([getXpTotal(context.userId), getLevels()]);
    const needsOrg = !profile.organization?.trim() || !profile.department?.trim() ? true : false;
    return {
      profile,
      isAdmin,
      level: resolveLevel(xp, levels),
      needsOrg,
    };
  });

/** Active organisations + departments for signup / profile (no auth required). */
export const listOrgCatalog = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: organizations, error: orgError }, { data: departments, error: deptError }] =
    await Promise.all([
      supabaseAdmin
        .from("organizations")
        .select("id, name")
        .eq("active", true)
        .order("name", { ascending: true }),
      supabaseAdmin
        .from("departments")
        .select("id, organization_id, name")
        .eq("active", true)
        .order("name", { ascending: true }),
    ]);
  if (orgError) throw orgError;
  if (deptError) throw deptError;
  return {
    organizations: organizations ?? [],
    departments: departments ?? [],
  };
});

export const getDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureProfile, getXpTotal, getLevels, filterAccessibleExams } =
      await import("@/lib/platform.server");
    const { resolveLevel } = await import("@/lib/gamification");
    const userId = context.userId;

    const { profile, isAdmin } = await ensureProfile(
      userId,
      context.claims as unknown as Record<string, unknown>,
    );

    const [
      xp,
      levels,
      { data: streaks },
      { data: badges },
      { data: badgeCatalog },
      { data: exams },
      { data: allAttempts },
      { data: mastery },
    ] = await Promise.all([
      getXpTotal(userId),
      getLevels(),
      supabaseAdmin.from("user_streaks").select("*").eq("user_id", userId),
      supabaseAdmin
        .from("user_badges")
        .select("earned_at, badges(code, name, icon, description)")
        .eq("user_id", userId)
        .order("earned_at", { ascending: false }),
      supabaseAdmin.from("badges").select("id").eq("active", true),
      supabaseAdmin
        .from("exams")
        .select(
          "id, title, topic, starts_at, ends_at, duration_minutes, question_count, mode, access",
        )
        .eq("active", true)
        .order("starts_at"),
      supabaseAdmin
        .from("exam_attempts")
        .select("id, score, passed, submitted_at, duration_seconds, exams(title, topic, pass_mark)")
        .eq("user_id", userId)
        .eq("status", "submitted")
        .order("submitted_at", { ascending: true }),
      supabaseAdmin
        .from("topic_mastery")
        .select("topic, subtopic, mastery, total_count, correct_count")
        .eq("user_id", userId),
    ]);

    const level = resolveLevel(xp, levels);
    const visible = await filterAccessibleExams(userId, exams ?? []);

    const { examAvailability } = await import("@/lib/exam-availability");
    const { careerDomains } = await import("@/lib/play.math");
    const upcoming = visible
      .filter(
        (e) =>
          examAvailability({
            active: true,
            starts_at: e.starts_at,
            ends_at: e.ends_at ?? null,
          }).notOpenYet === true,
      )
      .slice(0, 3);
    const available = visible.filter(
      (e) =>
        examAvailability({
          active: true,
          starts_at: e.starts_at,
          ends_at: e.ends_at ?? null,
        }).ok,
    );

    const attempts = allAttempts ?? [];
    const scores = attempts.map((a) => Number(a.score ?? 0));
    const completed = attempts.length;
    const passes = attempts.filter((a) => a.passed).length;
    const average = completed ? Math.round(scores.reduce((s, v) => s + v, 0) / completed) : 0;
    const best = completed ? Math.max(...scores) : 0;
    const passRate = completed ? Math.round((passes / completed) * 100) : 0;
    const recent = [...attempts].reverse().slice(0, 6);

    const last4 = scores.slice(-4);
    const improvement =
      last4.length >= 2 ? Math.round((last4[last4.length - 1] ?? 0) - (last4[0] ?? 0)) : 0;

    const durations = attempts.map((a) => Number(a.duration_seconds ?? 0)).filter((d) => d > 0);
    const avgDuration = durations.length
      ? Math.round(durations.reduce((s, v) => s + v, 0) / durations.length)
      : 0;
    const totalDuration = durations.reduce((s, v) => s + v, 0);

    const topicPerformance = new Map<string, { scores: number[]; passes: number; total: number }>();
    for (const attempt of attempts) {
      const exam = attempt.exams as unknown as { topic: string } | null;
      const topic = exam?.topic;
      if (!topic) continue;
      const bucket = topicPerformance.get(topic) ?? { scores: [], passes: 0, total: 0 };
      bucket.scores.push(Number(attempt.score ?? 0));
      bucket.total += 1;
      if (attempt.passed) bucket.passes += 1;
      topicPerformance.set(topic, bucket);
    }

    const masteryRows = (mastery ?? []).map((m) => ({
      topic: m.topic,
      subtopic: m.subtopic,
      mastery: Number(m.mastery),
      answered: m.total_count ?? 0,
      correct: m.correct_count ?? 0,
    }));

    return {
      profile,
      isAdmin,
      level,
      stats: {
        average,
        completed,
        passes,
        passRate,
        best,
        avgDuration,
        totalDuration,
        badgesTotal: (badgeCatalog ?? []).length,
      },
      improvement,
      streaks: (streaks ?? []).map((s) => ({
        type: s.streak_type,
        current: s.current_count,
        longest: s.longest_count,
      })),
      badgeCount: (badges ?? []).length,
      latestBadges: (badges ?? []).slice(0, 8).map((b) => {
        const badge = b.badges as unknown as {
          code?: string;
          name: string;
          icon: string;
          description?: string;
        } | null;
        return {
          code: badge?.code,
          name: badge?.name ?? "Badge",
          icon: badge?.icon ?? "trophy",
          description: badge?.description ?? "",
          earnedAt: b.earned_at,
        };
      }),
      earnedBadges: (badges ?? []).map((b) => {
        const badge = b.badges as unknown as {
          name: string;
          icon: string;
          description?: string;
          code?: string;
        } | null;
        return {
          code: badge?.code ?? badge?.name ?? "badge",
          name: badge?.name ?? "Badge",
          icon: badge?.icon ?? "trophy",
          description: badge?.description ?? "",
          earnedAt: b.earned_at,
        };
      }),
      upcoming: upcoming.map((e) => ({
        id: e.id,
        title: e.title,
        topic: e.topic,
        startsAt: e.starts_at,
        duration: e.duration_minutes,
        questionCount: e.question_count,
      })),
      available: available.slice(0, 12).map((e) => ({
        id: e.id,
        title: e.title,
        topic: e.topic,
        startsAt: e.starts_at,
        duration: e.duration_minutes,
        questionCount: e.question_count,
        mode: e.mode,
      })),
      availableCount: available.length,
      recent: recent.map((r) => {
        const exam = r.exams as unknown as {
          title: string;
          topic: string;
        } | null;
        return {
          id: r.id,
          title: exam?.title ?? "Assessment",
          topic: exam?.topic ?? "",
          score: Number(r.score ?? 0),
          passed: !!r.passed,
          submittedAt: r.submitted_at,
          durationSeconds: Number(r.duration_seconds ?? 0),
        };
      }),
      trend: attempts.slice(-8).map((a) => ({
        label: a.submitted_at
          ? new Date(a.submitted_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })
          : "",
        score: Number(a.score ?? 0),
        passed: !!a.passed,
      })),
      topicPerformance: [...topicPerformance.entries()]
        .map(([topic, bucket]) => ({
          topic,
          attempts: bucket.total,
          passes: bucket.passes,
          average: Math.round(bucket.scores.reduce((s, v) => s + v, 0) / bucket.scores.length),
          best: Math.max(...bucket.scores),
          passRate: Math.round((bucket.passes / bucket.total) * 100),
        }))
        .sort((a, b) => b.attempts - a.attempts)
        .slice(0, 6),
      mastery: masteryRows,
      career: careerDomains(masteryRows),
    };
  });

export const listMyExams = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { filterAccessibleExams } = await import("@/lib/platform.server");
    const userId = context.userId;
    const [{ data: exams }, { data: attempts }] = await Promise.all([
      supabaseAdmin
        .from("exams")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("exam_attempts")
        .select("id, exam_id, status, score, passed, submitted_at")
        .eq("user_id", userId)
        .order("submitted_at", { ascending: false }),
    ]);

    const visible = await filterAccessibleExams(userId, exams ?? []);
    const attemptsByExam = new Map<string, NonNullable<typeof attempts>>();
    for (const attempt of attempts ?? []) {
      const list = attemptsByExam.get(attempt.exam_id) ?? [];
      list.push(attempt);
      attemptsByExam.set(attempt.exam_id, list);
    }

    const out = [];
    for (const exam of visible) {
      const mine = attemptsByExam.get(exam.id) ?? [];
      const inProgress = mine.find((a) => a.status === "in_progress") ?? null;
      const submitted = mine.filter((a) => a.status === "submitted");
      const best = submitted.reduce<(typeof submitted)[number] | null>(
        (acc, a) => (!acc || Number(a.score ?? 0) > Number(acc.score ?? 0) ? a : acc),
        null,
      );
      const notOpen = !!exam.starts_at && new Date(exam.starts_at) > new Date();
      const closed = !!exam.ends_at && new Date(exam.ends_at) < new Date();
      const attemptsLeft = exam.max_attempts - submitted.length;

      let status: "available" | "upcoming" | "in_progress" | "completed" | "closed";
      if (inProgress) status = "in_progress";
      else if (notOpen) status = "upcoming";
      else if (closed) status = "closed";
      else if (submitted.length > 0 && attemptsLeft <= 0) status = "completed";
      else if (submitted.length > 0) status = "available";
      else status = "available";

      out.push({
        id: exam.id,
        title: exam.title,
        description: exam.description,
        topic: exam.topic,
        mode: exam.mode,
        access: exam.access,
        questionCount: exam.question_count,
        duration: exam.duration_minutes,
        passMark: exam.pass_mark,
        maxAttempts: exam.max_attempts,
        attemptsUsed: submitted.length,
        attemptsLeft,
        startsAt: exam.starts_at,
        endsAt: exam.ends_at ?? null,
        status,
        inProgressId: inProgress?.id ?? null,
        completed: submitted.length > 0,
        bestScore: best ? Number(best.score ?? 0) : null,
        bestPassed: best ? !!best.passed : null,
        lastAttemptId: best?.id ?? null,
        lastCompletedAt: best?.submitted_at ?? null,
      });
    }
    return out;
  });

export const getExamBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ examId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { getExam, assertExamAccess, countAttempts, ensureProfile } =
      await import("@/lib/platform.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const exam = await getExam(data.examId);
    if (!exam) throw new Error("Assessment not found.");

    const [{ profile }, used, openResult] = await Promise.all([
      ensureProfile(context.userId, context.claims as unknown as Record<string, unknown>),
      (async () => {
        await assertExamAccess(context.userId, exam);
        return countAttempts(context.userId, data.examId);
      })(),
      supabaseAdmin
        .from("exam_attempts")
        .select("id")
        .eq("user_id", context.userId)
        .eq("exam_id", data.examId)
        .eq("status", "in_progress")
        .maybeSingle(),
    ]);
    const open = openResult.data;

    return {
      profile,
      exam: {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        topic: exam.topic,
        mode: exam.mode,
        questionCount: exam.question_count,
        duration: exam.duration_minutes,
        passMark: exam.pass_mark,
        maxAttempts: exam.max_attempts,
        startsAt: exam.starts_at,
        extraFields: exam.extra_fields ?? [],
        enableXp: exam.enable_xp,
        enableBadges: exam.enable_badges,
        enableLeaderboard: exam.enable_leaderboard,
      },
      attemptsUsed: used,
      attemptsLeft: exam.max_attempts - used,
      openAttemptId: open?.id ?? null,
      notOpenYet: !!exam.starts_at && new Date(exam.starts_at) > new Date(),
      closed: !!exam.ends_at && new Date(exam.ends_at) < new Date(),
      endsAt: exam.ends_at,
    };
  });

export const beginAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        examId: z.string().uuid(),
        extra: z.record(z.string(), z.string()).default({}),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { startAttempt } = await import("@/lib/platform.server");
    return startAttempt(context.userId, data.examId, data.extra);
  });

export const getAttemptPaper = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ attemptId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { loadAttempt, serveQuestions } = await import("@/lib/platform.server");
    const { attempt, exam } = await loadAttempt(context.userId, data.attemptId);
    if (attempt.status === "submitted") return { submitted: true as const, attemptId: attempt.id };
    const questions = await serveQuestions(attempt.question_ids);
    const deadline = new Date(
      new Date(attempt.started_at).getTime() + exam.duration_minutes * 60_000,
    ).toISOString();
    return {
      submitted: false as const,
      attemptId: attempt.id,
      deadline,
      startedAt: attempt.started_at,
      questions,
      exam: {
        id: exam.id,
        title: exam.title,
        mode: exam.mode,
        passMark: exam.pass_mark,
        duration: exam.duration_minutes,
        topic: exam.topic,
      },
    };
  });

export const finishAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        attemptId: z.string().uuid(),
        answers: z.record(
          z.string(),
          z.union([
            z.number().int().min(0).max(20),
            z.array(z.number().int().min(0).max(20)).max(6),
          ]),
        ),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { submitAttempt } = await import("@/lib/platform.server");
    return submitAttempt(context.userId, data.attemptId, data.answers);
  });

export const getResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ attemptId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { summariseResult } = await import("@/lib/platform.server");
    return summariseResult(context.userId, data.attemptId);
  });

export const listLeaderboardExams = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listLeaderboardExams: list } = await import("@/lib/platform.server");
    return list(context.userId);
  });

export const getLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        scope: z.enum(["global", "organization", "department", "exam", "topic"]),
        target: z.string().optional(),
        examId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { leaderboard } = await import("@/lib/platform.server");
    return leaderboard(context.userId, data.scope, data.target, data.examId);
  });

export const getAchievements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { participantStats } = await import("@/lib/platform.server");
    const userId = context.userId;
    const [{ data: badges }, { data: owned }, { data: streaks }] = await Promise.all([
      supabaseAdmin.from("badges").select("*").eq("active", true).order("category"),
      supabaseAdmin.from("user_badges").select("badge_id, earned_at").eq("user_id", userId),
      supabaseAdmin.from("user_streaks").select("*").eq("user_id", userId),
    ]);
    const ownedMap = new Map((owned ?? []).map((b) => [b.badge_id, b.earned_at]));
    const stats = await participantStats(userId);
    const passStreak = (streaks ?? []).find((s) => s.streak_type === "pass")?.current_count ?? 0;

    const progressFor = (type: string, value: number) => {
      switch (type) {
        case "pass_count":
          return { current: stats.passes, required: value, unit: "passes" };
        case "attempt_count":
          return {
            current: stats.completed,
            required: value,
            unit: "assessments",
          };
        case "single_score":
          return { current: stats.best, required: value, unit: "%" };
        case "average_over":
          return { current: stats.average, required: value, unit: "% average" };
        case "pass_streak":
          return { current: passStreak, required: value, unit: "in a row" };
        default:
          return null;
      }
    };

    return (badges ?? []).map((b) => ({
      code: b.code,
      name: b.name,
      description: b.description,
      icon: b.icon,
      category: b.category,
      track: (b.track as string | null) ?? "intermediate",
      xp: b.xp_reward,
      earnedAt: ownedMap.get(b.id) ?? null,
      progress: ownedMap.has(b.id)
        ? null
        : progressFor(b.condition_type, Number(b.condition_value)),
    }));
  });

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        full_name: z.string().trim().min(2).max(120),
        mobile: z.string().trim().max(30).optional().or(z.literal("")),
        participant_id: z.string().trim().max(60).optional().or(z.literal("")),
        organization: z.string().trim().min(2).max(120),
        department: z.string().trim().min(2).max(120),
        display_name: z.string().trim().max(60).optional().or(z.literal("")),
        team_group: z.string().trim().max(120).optional().or(z.literal("")),
        leaderboard_opt_out: z.boolean(),
        avatar_id: z.string().trim().max(40).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { allocateParticipantIdForSave, ensureProfile } = await import("@/lib/platform.server");
    const { isAvatarId } = await import("@/lib/avatars");

    const avatarId =
      data.avatar_id === null || data.avatar_id === undefined || data.avatar_id === ""
        ? null
        : isAvatarId(data.avatar_id)
          ? data.avatar_id
          : null;

    const { profile, isAdmin } = await ensureProfile(
      context.userId,
      context.claims as unknown as Record<string, unknown>,
    );
    const participantId =
      profile.participant_id?.trim() ||
      (await allocateParticipantIdForSave(data.participant_id || null));

    // Leaderboard privacy is admin-managed; participants keep their existing value.
    const leaderboardOptOut = isAdmin ? data.leaderboard_opt_out : !!profile.leaderboard_opt_out;

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        mobile: data.mobile || null,
        participant_id: participantId,
        organization: data.organization,
        department: data.department,
        display_name: data.display_name || null,
        team_group: data.department,
        leaderboard_opt_out: leaderboardOptOut,
        avatar_id: avatarId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

/** Attach organisation + team/group after Google (or any OAuth) without rewriting the full profile. */
export const saveOrgMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        organization: z.string().trim().min(2).max(120),
        department: z.string().trim().min(2).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureProfile } = await import("@/lib/platform.server");
    await ensureProfile(context.userId, context.claims as unknown as Record<string, unknown>);

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        organization: data.organization,
        department: data.department,
        team_group: data.department,
        updated_at: new Date().toISOString(),
      })
      .eq("id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const listNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(40);
    return data ?? [];
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("notifications")
      .update({ read: true })
      .eq("user_id", context.userId)
      .eq("read", false);
    return { ok: true };
  });
