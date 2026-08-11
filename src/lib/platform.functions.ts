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
    const xp = await getXpTotal(context.userId);
    return { profile, isAdmin, level: resolveLevel(xp, await getLevels()) };
  });

export const getDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureProfile, getXpTotal, getLevels, participantStats } = await import(
      "@/lib/platform.server"
    );
    const { resolveLevel } = await import("@/lib/gamification");
    const userId = context.userId;

    const { profile, isAdmin } = await ensureProfile(
      userId,
      context.claims as unknown as Record<string, unknown>,
    );
    const stats = await participantStats(userId);
    const xp = await getXpTotal(userId);
    const level = resolveLevel(xp, await getLevels());

    const [{ data: streaks }, { data: badges }, { data: exams }, { data: recent }, { data: mastery }] =
      await Promise.all([
        supabaseAdmin.from("user_streaks").select("*").eq("user_id", userId),
        supabaseAdmin
          .from("user_badges")
          .select("earned_at, badges(code, name, icon, description)")
          .eq("user_id", userId)
          .order("earned_at", { ascending: false }),
        supabaseAdmin.from("exams").select("*").eq("active", true).order("starts_at"),
        supabaseAdmin
          .from("exam_attempts")
          .select("id, score, passed, submitted_at, exams(title, topic, pass_mark)")
          .eq("user_id", userId)
          .eq("status", "submitted")
          .order("submitted_at", { ascending: false })
          .limit(5),
        supabaseAdmin
          .from("topic_mastery")
          .select("topic, subtopic, mastery")
          .eq("user_id", userId),
      ]);

    const { data: accessible } = await supabaseAdmin.rpc("can_access_exam", {
      _user_id: userId,
      _exam_id: (exams ?? [])[0]?.id ?? "00000000-0000-0000-0000-000000000000",
    });
    void accessible;

    const visible = [];
    for (const exam of exams ?? []) {
      if (exam.access === "public") visible.push(exam);
      else {
        const { data: ok } = await supabaseAdmin.rpc("can_access_exam", {
          _user_id: userId,
          _exam_id: exam.id,
        });
        if (ok) visible.push(exam);
      }
    }

    const upcoming = visible
      .filter((e) => !e.starts_at || new Date(e.starts_at) > new Date())
      .slice(0, 3);
    const available = visible.filter((e) => !e.starts_at || new Date(e.starts_at) <= new Date());

    return {
      profile,
      isAdmin,
      level,
      stats: {
        average: stats.average,
        completed: stats.completed,
        passRate: stats.passRate,
        best: stats.best,
      },
      streaks: (streaks ?? []).map((s) => ({
        type: s.streak_type,
        current: s.current_count,
        longest: s.longest_count,
      })),
      badgeCount: (badges ?? []).length,
      latestBadges: (badges ?? []).slice(0, 4).map((b) => {
        const badge = b.badges as unknown as { name: string; icon: string } | null;
        return { name: badge?.name ?? "Badge", icon: badge?.icon ?? "🏅" };
      }),
      upcoming: upcoming.map((e) => ({
        id: e.id,
        title: e.title,
        topic: e.topic,
        startsAt: e.starts_at,
        duration: e.duration_minutes,
        questionCount: e.question_count,
      })),
      availableCount: available.length,
      recent: (recent ?? []).map((r) => {
        const exam = r.exams as unknown as { title: string; topic: string } | null;
        return {
          id: r.id,
          title: exam?.title ?? "Assessment",
          topic: exam?.topic ?? "",
          score: Number(r.score ?? 0),
          passed: !!r.passed,
          submittedAt: r.submitted_at,
        };
      }),
      trend: stats.attempts.slice(-8).map((a) => ({
        label: a.submitted_at
          ? new Date(a.submitted_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })
          : "",
        score: Number(a.score ?? 0),
      })),
      mastery: (mastery ?? []).map((m) => ({
        topic: m.topic,
        subtopic: m.subtopic,
        mastery: Number(m.mastery),
      })),
    };
  });

export const listMyExams = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const { data: exams } = await supabaseAdmin
      .from("exams")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false });
    const { data: attempts } = await supabaseAdmin
      .from("exam_attempts")
      .select("id, exam_id, status, score, passed, submitted_at")
      .eq("user_id", userId)
      .order("submitted_at", { ascending: false });

    const out = [];
    for (const exam of exams ?? []) {
      if (exam.access !== "public") {
        const { data: ok } = await supabaseAdmin.rpc("can_access_exam", {
          _user_id: userId,
          _exam_id: exam.id,
        });
        if (!ok) continue;
      }
      const mine = (attempts ?? []).filter((a) => a.exam_id === exam.id);
      const inProgress = mine.find((a) => a.status === "in_progress") ?? null;
      const submitted = mine.filter((a) => a.status === "submitted");
      const best = submitted.reduce<(typeof submitted)[number] | null>(
        (acc, a) => (!acc || Number(a.score ?? 0) > Number(acc.score ?? 0) ? a : acc),
        null,
      );
      const notOpen = !!exam.starts_at && new Date(exam.starts_at) > new Date();
      const attemptsLeft = exam.max_attempts - submitted.length;

      let status: "available" | "upcoming" | "in_progress" | "completed";
      if (inProgress) status = "in_progress";
      else if (notOpen) status = "upcoming";
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
    const { getExam, assertExamAccess, countAttempts, ensureProfile } = await import(
      "@/lib/platform.server"
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const exam = await getExam(data.examId);
    if (!exam) throw new Error("Assessment not found.");
    await assertExamAccess(context.userId, exam);
    const { profile } = await ensureProfile(
      context.userId,
      context.claims as unknown as Record<string, unknown>,
    );
    const used = await countAttempts(context.userId, data.examId);
    const { data: open } = await supabaseAdmin
      .from("exam_attempts")
      .select("id")
      .eq("user_id", context.userId)
      .eq("exam_id", data.examId)
      .eq("status", "in_progress")
      .maybeSingle();

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
      .object({ examId: z.string().uuid(), extra: z.record(z.string(), z.string()).default({}) })
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

export const getLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        scope: z.enum(["global", "organization", "department", "exam", "topic"]),
        target: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { leaderboard } = await import("@/lib/platform.server");
    return leaderboard(context.userId, data.scope, data.target);
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
          return { current: stats.completed, required: value, unit: "assessments" };
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
      xp: b.xp_reward,
      earnedAt: ownedMap.get(b.id) ?? null,
      progress: ownedMap.has(b.id) ? null : progressFor(b.condition_type, Number(b.condition_value)),
    }));
  });

export const getProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { participantStats } = await import("@/lib/platform.server");
    const userId = context.userId;
    const stats = await participantStats(userId);
    const { data: journey } = await supabaseAdmin
      .from("exam_attempts")
      .select("id, score, passed, submitted_at, duration_seconds, exams(title, topic, duration_minutes)")
      .eq("user_id", userId)
      .eq("status", "submitted")
      .order("submitted_at", { ascending: true });
    const { data: mastery } = await supabaseAdmin
      .from("topic_mastery")
      .select("topic, subtopic, mastery, total_count")
      .eq("user_id", userId)
      .order("topic");

    const scores = (journey ?? []).map((j) => Number(j.score ?? 0));
    const last4 = scores.slice(-4);
    const improvement =
      last4.length >= 2 ? Math.round((last4[last4.length - 1] ?? 0) - (last4[0] ?? 0)) : 0;

    return {
      stats: {
        average: stats.average,
        completed: stats.completed,
        passRate: stats.passRate,
        best: stats.best,
      },
      improvement,
      journey: (journey ?? []).map((j) => {
        const exam = j.exams as unknown as {
          title: string;
          topic: string;
          duration_minutes: number;
        } | null;
        return {
          id: j.id,
          title: exam?.title ?? "Assessment",
          topic: exam?.topic ?? "",
          score: Number(j.score ?? 0),
          passed: !!j.passed,
          submittedAt: j.submitted_at,
          durationSeconds: j.duration_seconds,
          allowedSeconds: (exam?.duration_minutes ?? 0) * 60,
        };
      }),
      mastery: (mastery ?? []).map((m) => ({
        topic: m.topic,
        subtopic: m.subtopic,
        mastery: Number(m.mastery),
        answered: m.total_count,
      })),
    };
  });

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        full_name: z.string().trim().min(2).max(120),
        mobile: z.string().trim().max(30).optional().or(z.literal("")),
        participant_id: z.string().trim().max(60).optional().or(z.literal("")),
        organization: z.string().trim().max(120).optional().or(z.literal("")),
        department: z.string().trim().max(120).optional().or(z.literal("")),
        display_name: z.string().trim().max(60).optional().or(z.literal("")),
        team_group: z.string().trim().max(120).optional().or(z.literal("")),
        leaderboard_opt_out: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        mobile: data.mobile || null,
        participant_id: data.participant_id || null,
        organization: data.organization || null,
        department: data.department || null,
        display_name: data.display_name || null,
        team_group: data.team_group || null,
        leaderboard_opt_out: data.leaderboard_opt_out,
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
