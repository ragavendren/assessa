/**
 * Server-only assessment engine: question serving, authoritative scoring,
 * XP ledger, badge evaluation, streaks, topic mastery and leaderboards.
 * Never imported from client code (blocked by the *.server.* filename rule).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveLevel, type LevelRow } from "@/lib/gamification";

const db = supabaseAdmin;

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  mobile: string | null;
  participant_id: string | null;
  organization: string | null;
  department: string | null;
  display_name: string | null;
  team_group: string | null;
  leaderboard_opt_out: boolean;
};

export type AttemptRow = {
  id: string;
  exam_id: string;
  user_id: string;
  status: "in_progress" | "submitted";
  question_ids: string[];
  answers: Record<string, number | number[]>;
  extra_fields: Record<string, string>;
  score: number | null;
  passed: boolean | null;
  correct_count: number | null;
  duration_seconds: number | null;
  started_at: string;
  submitted_at: string | null;
};

export type ExamRow = {
  id: string;
  title: string;
  description: string;
  topic: string;
  mode: "practice" | "assessment" | "competitive" | "certification";
  question_count: number;
  duration_minutes: number;
  pass_mark: number;
  max_attempts: number;
  access: "public" | "private" | "organization" | "group";
  organization: string | null;
  team_group: string | null;
  starts_at: string | null;
  ends_at: string | null;
  enable_xp: boolean;
  enable_badges: boolean;
  enable_leaderboard: boolean;
  show_rank: boolean;
  show_others: boolean;
  leaderboard_name_display: "full_name" | "first_initial" | "display_name" | "anonymous";
  extra_fields: { key: string; label: string; required?: boolean }[];
  active: boolean;
  created_at: string;
};

/* ------------------------------------------------------------------ */
/* identity                                                            */
/* ------------------------------------------------------------------ */

export async function ensureProfile(
  userId: string,
  claims: Record<string, unknown>,
): Promise<{ profile: Profile; isAdmin: boolean }> {
  const meta = (claims["user_metadata"] as Record<string, unknown> | undefined) ?? {};
  const email = String(claims["email"] ?? meta["email"] ?? "");

  const { data: existing } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();

  let profile = existing as Profile | null;
  if (!profile) {
    const { data, error } = await db
      .from("profiles")
      .insert({
        id: userId,
        email,
        full_name: String(
          meta["full_name"] ?? meta["name"] ?? email.split("@")[0] ?? "Participant",
        ),
        mobile: (meta["mobile"] as string | undefined) ?? null,
        participant_id: (meta["participant_id"] as string | undefined) ?? null,
        organization: (meta["organization"] as string | undefined) ?? null,
        department: (meta["department"] as string | undefined) ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    profile = data as Profile;
  } else if (email && profile.email !== email) {
    await db.from("profiles").update({ email }).eq("id", userId);
    profile.email = email;
  }

  const { data: roles } = await db.from("user_roles").select("role").eq("user_id", userId);
  if (!roles || roles.length === 0) {
    // Guest participants must never become admins. Only the first non-guest account can bootstrap admin.
    const isGuest = meta["guest"] === true;
    let role: "admin" | "participant" = "participant";
    if (!isGuest) {
      const { count } = await db
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");
      role = (count ?? 0) === 0 ? "admin" : "participant";
    }
    await db.from("user_roles").insert({ user_id: userId, role });
    await db.from("user_streaks").upsert(
      [
        { user_id: userId, streak_type: "exam" },
        { user_id: userId, streak_type: "pass" },
        { user_id: userId, streak_type: "high_score" },
      ],
      { onConflict: "user_id,streak_type" },
    );
    return { profile, isAdmin: role === "admin" };
  }

  return { profile, isAdmin: roles.some((r) => r.role === "admin") };
}

export async function requireAdmin(userId: string) {
  const { data } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Administrator access required");
}

/* ------------------------------------------------------------------ */
/* xp + levels                                                         */
/* ------------------------------------------------------------------ */

export async function getLevels(): Promise<LevelRow[]> {
  const { data } = await db.from("levels").select("level, name, min_xp").order("min_xp");
  return (data ?? []) as LevelRow[];
}

export async function getXpTotal(userId: string) {
  const { data } = await db.from("xp_transactions").select("points").eq("user_id", userId);
  return (data ?? []).reduce((sum, row) => sum + (row.points ?? 0), 0);
}

async function xpRules() {
  const { data } = await db.from("xp_rules").select("code, points, active");
  const map: Record<string, number> = {};
  for (const row of data ?? []) if (row.active) map[row.code] = row.points;
  return map;
}

export async function awardXp(
  userId: string,
  source: string,
  points: number,
  referenceId?: string | null,
) {
  if (points <= 0) return 0;
  await db.from("xp_transactions").insert({
    user_id: userId,
    source,
    points,
    reference_id: referenceId ?? null,
  });
  return points;
}

export async function notify(
  userId: string,
  payload: {
    kind: string;
    title: string;
    body?: string;
    icon?: string;
    /** Deep-link path (e.g. `/results/...`). Prefixed with APP_URL for email. */
    href?: string;
    ctaLabel?: string;
    /** When false, skip Resend and keep in-app only. Default true. */
    email?: boolean;
  },
) {
  await db.from("notifications").insert({
    user_id: userId,
    kind: payload.kind,
    title: payload.title,
    body: payload.body ?? "",
    icon: payload.icon ?? "🔔",
  });

  if (payload.email === false) return;

  try {
    const { data: profile } = await db
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();
    const { appBaseUrl, normalizeEmailAddress, sendNotificationEmail } =
      await import("@/lib/email.server");
    const to = normalizeEmailAddress(profile?.email);
    if (!to) return;

    const href = payload.href
      ? `${appBaseUrl()}${payload.href.startsWith("/") ? payload.href : `/${payload.href}`}`
      : appBaseUrl();

    await sendNotificationEmail({
      to,
      kind: payload.kind,
      title: payload.title,
      ...(payload.body ? { body: payload.body } : {}),
      href,
      ctaLabel: payload.ctaLabel ?? "Open Assessa",
    });
  } catch (error) {
    console.error("[notify] email delivery failed:", error);
  }
}

/* ------------------------------------------------------------------ */
/* exam serving                                                        */
/* ------------------------------------------------------------------ */

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = a;
  }
  return copy;
}

export async function getExam(examId: string) {
  const { data, error } = await db.from("exams").select("*").eq("id", examId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Assessment not found.");
  return data as unknown as ExamRow;
}

export async function assertExamAccess(userId: string, exam: ExamRow) {
  const { examAvailability } = await import("@/lib/exam-availability");
  const availability = examAvailability(exam);
  if (!availability.ok) throw new Error(availability.reason);
  if (exam.access === "public") return;
  const { data } = await db.rpc("can_access_exam", {
    _user_id: userId,
    _exam_id: exam.id,
  });
  if (!data) throw new Error("You do not have access to this assessment.");
}

/** Sanitised question shape — the answer key never leaves the server. */
export type ServedQuestion = {
  id: string;
  prompt: string;
  options: string[];
  subtopic: string;
  points: number;
  multiSelect: boolean;
};

function resolveCorrectIndexes(row: {
  correct_index: number;
  correct_indexes?: number[] | null;
}): number[] {
  const indexes = (row.correct_indexes ?? []).filter((value) => Number.isInteger(value));
  if (indexes.length > 0) return [...new Set(indexes)].sort((a, b) => a - b);
  return [row.correct_index];
}

export async function serveQuestions(questionIds: string[]): Promise<ServedQuestion[]> {
  if (questionIds.length === 0) return [];
  const { data } = await db
    .from("questions")
    .select("id, prompt, options, subtopic, points, correct_index, correct_indexes")
    .in("id", questionIds);
  const byId = new Map((data ?? []).map((q) => [q.id, q]));
  return questionIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((q) => {
      const correct = resolveCorrectIndexes(
        q as { correct_index: number; correct_indexes?: number[] | null },
      );
      return {
        id: q!.id,
        prompt: q!.prompt,
        options: (q!.options as string[]) ?? [],
        subtopic: q!.subtopic,
        points: q!.points,
        multiSelect: correct.length > 1,
      };
    });
}

export async function countAttempts(userId: string, examId: string) {
  const { count } = await db
    .from("exam_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("exam_id", examId)
    .eq("status", "submitted");
  return count ?? 0;
}

export async function startAttempt(userId: string, examId: string, extra: Record<string, string>) {
  const exam = await getExam(examId);
  if (!exam) throw new Error("Assessment not found.");
  await assertExamAccess(userId, exam);

  const { data: open } = await db
    .from("exam_attempts")
    .select("*")
    .eq("user_id", userId)
    .eq("exam_id", examId)
    .eq("status", "in_progress")
    .maybeSingle();
  if (open) return { attemptId: (open as AttemptRow).id, resumed: true };

  const used = await countAttempts(userId, examId);
  if (used >= exam.max_attempts) throw new Error("You have used all available attempts.");

  for (const field of exam.extra_fields ?? []) {
    if (field.required && !String(extra[field.key] ?? "").trim()) {
      throw new Error(`${field.label} is required.`);
    }
  }

  const { data: pool } = await db.from("questions").select("id").eq("exam_id", examId);
  const ids = shuffle((pool ?? []).map((q) => q.id)).slice(0, exam.question_count);
  if (ids.length === 0) throw new Error("This assessment has no questions yet.");

  const { data: attempt, error } = await db
    .from("exam_attempts")
    .insert({
      exam_id: examId,
      user_id: userId,
      question_ids: ids,
      extra_fields: extra,
    })
    .select("id")
    .single();
  if (error) throw error;

  if (exam.enable_xp) {
    const rules = await xpRules();
    await awardXp(userId, "exam_started", rules["exam_started"] ?? 0, attempt.id);
  }
  return { attemptId: attempt.id as string, resumed: false };
}

export async function loadAttempt(userId: string, attemptId: string) {
  const { data } = await db.from("exam_attempts").select("*").eq("id", attemptId).maybeSingle();
  const attempt = data as AttemptRow | null;
  if (!attempt || attempt.user_id !== userId) throw new Error("Attempt not found.");
  const exam = await getExam(attempt.exam_id);
  if (!exam) throw new Error("Assessment not found.");
  return { attempt, exam };
}

/* ------------------------------------------------------------------ */
/* authoritative scoring                                               */
/* ------------------------------------------------------------------ */

function normalizeAnswer(value: unknown): number[] {
  if (Array.isArray(value)) {
    return [...new Set(value.filter((item): item is number => Number.isInteger(item)))].sort(
      (a, b) => a - b,
    );
  }
  if (typeof value === "number" && Number.isInteger(value)) return [value];
  return [];
}

function sameIndexSet(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

export async function submitAttempt(
  userId: string,
  attemptId: string,
  answers: Record<string, number | number[]>,
) {
  const { attempt, exam } = await loadAttempt(userId, attemptId);
  if (attempt.status === "submitted") return summariseResult(userId, attemptId);

  const { data: keys } = await db
    .from("questions")
    .select("id, correct_index, correct_indexes, points, subtopic")
    .in("id", attempt.question_ids);

  // Server-side timer enforcement: answers submitted past the deadline still
  // count, but the elapsed time is capped at the allowed duration.
  const started = new Date(attempt.started_at).getTime();
  const allowedMs = exam.duration_minutes * 60_000;
  const elapsedMs = Math.min(Date.now() - started, allowedMs);

  let earned = 0;
  let possible = 0;
  let correctCount = 0;
  const perSubtopic = new Map<string, { correct: number; total: number }>();

  for (const q of keys ?? []) {
    possible += q.points;
    const bucket = perSubtopic.get(q.subtopic) ?? { correct: 0, total: 0 };
    bucket.total += 1;
    const expected = resolveCorrectIndexes(
      q as { correct_index: number; correct_indexes?: number[] | null },
    );
    const given = normalizeAnswer(answers[q.id]);
    if (given.length > 0 && sameIndexSet(given, expected)) {
      earned += q.points;
      correctCount += 1;
      bucket.correct += 1;
    }
    perSubtopic.set(q.subtopic, bucket);
  }

  const score = possible > 0 ? Math.round((earned / possible) * 100) : 0;
  const passed = score >= exam.pass_mark;
  const durationSeconds = Math.round(elapsedMs / 1000);

  // Answers are locked here — the row moves to `submitted` and is never edited again.
  await db
    .from("exam_attempts")
    .update({
      status: "submitted",
      answers,
      score,
      passed,
      correct_count: correctCount,
      duration_seconds: durationSeconds,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", attemptId)
    .eq("status", "in_progress");

  await updateMastery(userId, exam.topic, perSubtopic);
  const streaks = await updateStreaks(userId, passed, score);

  const gains: { label: string; points: number }[] = [];
  if (exam.enable_xp) {
    const rules = await xpRules();
    const add = async (code: string, label: string) => {
      const points = rules[code] ?? 0;
      if (points > 0) {
        await awardXp(userId, code, points, attemptId);
        gains.push({ label, points });
      }
    };
    await add("exam_completed", "Assessment completed");
    if (passed) await add("exam_passed", "Passed");
    if (score === 100) await add("perfect_score", "Perfect score");
    else if (score > 95) await add("score_95", "Scored above 95%");
    else if (score > 90) await add("score_90", "Scored above 90%");
    else if (score > 80) await add("score_80", "Scored above 80%");
  }

  const newBadges = exam.enable_badges
    ? await evaluateBadges(userId, {
        exam,
        attemptId,
        score,
        passed,
        durationSeconds,
        passStreak: streaks.pass,
      })
    : [];

  await notify(userId, {
    kind: "result",
    title: `Result available — ${exam.title}`,
    body: `You scored ${score}% (${passed ? "PASSED" : "NOT PASSED"}).`,
    icon: passed ? "✅" : "📄",
    href: `/results/${attemptId}`,
    ctaLabel: "View result",
  });

  return summariseResult(userId, attemptId, { gains, newBadges });
}

async function updateMastery(
  userId: string,
  topic: string,
  perSubtopic: Map<string, { correct: number; total: number }>,
) {
  for (const [subtopic, stats] of perSubtopic) {
    const { data: existing } = await db
      .from("topic_mastery")
      .select("*")
      .eq("user_id", userId)
      .eq("topic", topic)
      .eq("subtopic", subtopic)
      .maybeSingle();
    const correct = (existing?.correct_count ?? 0) + stats.correct;
    const total = (existing?.total_count ?? 0) + stats.total;
    await db.from("topic_mastery").upsert(
      {
        user_id: userId,
        topic,
        subtopic,
        correct_count: correct,
        total_count: total,
        mastery: total > 0 ? Math.round((correct / total) * 100) : 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,topic,subtopic" },
    );
  }
}

async function updateStreaks(userId: string, passed: boolean, score: number) {
  const now = new Date().toISOString();
  const result = { exam: 0, pass: 0, high_score: 0 };

  const apply = async (type: keyof typeof result, keep: boolean) => {
    const { data } = await db
      .from("user_streaks")
      .select("*")
      .eq("user_id", userId)
      .eq("streak_type", type)
      .maybeSingle();
    const current = keep ? (data?.current_count ?? 0) + 1 : 0;
    const longest = Math.max(data?.longest_count ?? 0, current);
    await db.from("user_streaks").upsert(
      {
        user_id: userId,
        streak_type: type,
        current_count: current,
        longest_count: longest,
        last_activity_at: now,
      },
      { onConflict: "user_id,streak_type" },
    );
    result[type] = current;
  };

  await apply("exam", true);
  await apply("pass", passed);
  await apply("high_score", score >= 80);
  return result;
}

/* ------------------------------------------------------------------ */
/* badges                                                              */
/* ------------------------------------------------------------------ */

export type BadgeRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  condition_type: string;
  condition_value: number;
  condition_topic: string | null;
  xp_reward: number;
  active: boolean;
};

export async function participantStats(userId: string) {
  const { data } = await db
    .from("exam_attempts")
    .select("id, exam_id, score, passed, duration_seconds, submitted_at, status")
    .eq("user_id", userId)
    .eq("status", "submitted")
    .order("submitted_at", { ascending: true });
  const attempts = data ?? [];
  const scores = attempts.map((a) => Number(a.score ?? 0));
  const completed = attempts.length;
  const passes = attempts.filter((a) => a.passed).length;
  return {
    attempts,
    completed,
    passes,
    average: completed ? Math.round(scores.reduce((s, v) => s + v, 0) / completed) : 0,
    best: completed ? Math.max(...scores) : 0,
    passRate: completed ? Math.round((passes / completed) * 100) : 0,
  };
}

async function examRank(examId: string, userId: string) {
  const { data } = await db
    .from("exam_attempts")
    .select("user_id, score")
    .eq("exam_id", examId)
    .eq("status", "submitted");
  const bestByUser = new Map<string, number>();
  for (const row of data ?? []) {
    const score = Number(row.score ?? 0);
    if (score > (bestByUser.get(row.user_id) ?? -1)) bestByUser.set(row.user_id, score);
  }
  const ordered = [...bestByUser.entries()].sort((a, b) => b[1] - a[1]);
  const rank = ordered.findIndex(([id]) => id === userId) + 1;
  const scores = ordered.map(([, s]) => s);
  return {
    rank: rank || null,
    total: ordered.length,
    top: scores[0] ?? 0,
    average: scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0,
  };
}

async function evaluateBadges(
  userId: string,
  ctx: {
    exam: ExamRow;
    attemptId: string;
    score: number;
    passed: boolean;
    durationSeconds: number;
    passStreak: number;
  },
) {
  const { data: badgeRows } = await db.from("badges").select("*").eq("active", true);
  const { data: owned } = await db.from("user_badges").select("badge_id").eq("user_id", userId);
  const ownedSet = new Set((owned ?? []).map((b) => b.badge_id));
  const stats = await participantStats(userId);
  const rank = ctx.exam.enable_leaderboard ? await examRank(ctx.exam.id, userId) : null;

  const topicRows = await db
    .from("exam_attempts")
    .select("score, exams!inner(topic)")
    .eq("user_id", userId)
    .eq("status", "submitted");
  const topicScores = new Map<string, number[]>();
  for (const row of (topicRows.data ?? []) as unknown as {
    score: number;
    exams: { topic: string };
  }[]) {
    const list = topicScores.get(row.exams.topic) ?? [];
    list.push(Number(row.score ?? 0));
    topicScores.set(row.exams.topic, list);
  }

  const previous = stats.attempts.filter(
    (a) => a.exam_id === ctx.exam.id && a.id !== ctx.attemptId,
  );
  const previousScore = previous.length ? Number(previous[previous.length - 1]!.score ?? 0) : null;
  const hadFailure = stats.attempts.some((a) => a.id !== ctx.attemptId && a.passed === false);

  const earned: BadgeRow[] = [];
  for (const badge of (badgeRows ?? []) as BadgeRow[]) {
    if (ownedSet.has(badge.id)) continue;
    const value = Number(badge.condition_value);
    let hit = false;
    switch (badge.condition_type) {
      case "pass_count":
        hit = stats.passes >= value;
        break;
      case "attempt_count":
        hit = stats.completed >= value;
        break;
      case "single_score":
        hit = ctx.score >= value;
        break;
      case "average_over":
        hit = stats.completed >= 10 && stats.average >= value;
        break;
      case "pass_streak":
        hit = ctx.passStreak >= value;
        break;
      case "fast_high_score":
        hit =
          ctx.score >= value &&
          ctx.durationSeconds > 0 &&
          ctx.durationSeconds <= (ctx.exam.duration_minutes * 60) / 2;
        break;
      case "improvement":
        hit = previousScore != null && ctx.score - previousScore >= value;
        break;
      case "comeback":
        hit = ctx.passed && hadFailure;
        break;
      case "topic_average": {
        const list = topicScores.get(badge.condition_topic ?? ctx.exam.topic) ?? [];
        const avg = list.length ? list.reduce((s, v) => s + v, 0) / list.length : 0;
        hit = list.length >= 3 && avg >= value;
        break;
      }
      case "top_rank":
        hit = !!rank?.rank && rank.rank <= value && rank.total >= 3;
        break;
      default:
        hit = false;
    }
    if (!hit) continue;
    const { error } = await db.from("user_badges").insert({ user_id: userId, badge_id: badge.id });
    if (error) continue;
    earned.push(badge);
    if (badge.xp_reward > 0) await awardXp(userId, `badge:${badge.code}`, badge.xp_reward, null);
    await notify(userId, {
      kind: "badge",
      title: `Badge earned — ${badge.name}`,
      body: `${badge.description}${badge.xp_reward ? ` +${badge.xp_reward} XP` : ""}`,
      icon: badge.icon,
      href: "/achievements",
      ctaLabel: "View achievements",
    });
  }
  return earned;
}

/* ------------------------------------------------------------------ */
/* results                                                             */
/* ------------------------------------------------------------------ */

export async function summariseResult(
  userId: string,
  attemptId: string,
  extras?: {
    gains?: { label: string; points: number }[];
    newBadges?: BadgeRow[];
  },
) {
  const { attempt, exam } = await loadAttempt(userId, attemptId);
  const showReview = exam.mode === "practice" || exam.mode === "assessment";

  const { data: keys } = await db
    .from("questions")
    .select("id, prompt, options, correct_index, correct_indexes, explanation, subtopic")
    .in("id", attempt.question_ids);
  const byId = new Map((keys ?? []).map((q) => [q.id, q]));

  const review = showReview
    ? attempt.question_ids
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((q) => {
          const correctIndexes = resolveCorrectIndexes(
            q as { correct_index: number; correct_indexes?: number[] | null },
          );
          const given = normalizeAnswer(attempt.answers[q!.id]);
          return {
            id: q!.id,
            prompt: q!.prompt,
            options: (q!.options as string[]) ?? [],
            correctIndex: correctIndexes[0] ?? q!.correct_index,
            correctIndexes,
            multiSelect: correctIndexes.length > 1,
            explanation: q!.explanation,
            subtopic: q!.subtopic,
            givenIndex: given[0] ?? null,
            givenIndexes: given,
          };
        })
    : [];

  const rank = exam.enable_leaderboard && exam.show_rank ? await examRank(exam.id, userId) : null;
  const xp = await getXpTotal(userId);
  const levels = await getLevels();

  return {
    attempt: {
      id: attempt.id,
      score: Number(attempt.score ?? 0),
      passed: !!attempt.passed,
      correctCount: attempt.correct_count ?? 0,
      total: attempt.question_ids.length,
      durationSeconds: attempt.duration_seconds,
      submittedAt: attempt.submitted_at,
    },
    exam: {
      id: exam.id,
      title: exam.title,
      topic: exam.topic,
      mode: exam.mode,
      passMark: exam.pass_mark,
      durationMinutes: exam.duration_minutes,
      enableLeaderboard: exam.enable_leaderboard,
    },
    review,
    rank,
    level: resolveLevel(xp, levels),
    gains: extras?.gains ?? [],
    newBadges: (extras?.newBadges ?? []).map((b) => ({
      code: b.code,
      name: b.name,
      icon: b.icon,
      description: b.description,
      xp: b.xp_reward,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* leaderboards                                                        */
/* ------------------------------------------------------------------ */

export function maskName(
  profile: { full_name: string; display_name: string | null },
  mode: ExamRow["leaderboard_name_display"],
  index: number,
) {
  const name = profile.full_name?.trim() || "Participant";
  switch (mode) {
    case "full_name":
      return name;
    case "display_name":
      return profile.display_name?.trim() || name.split(" ")[0] || name;
    case "first_initial": {
      const parts = name.split(/\s+/);
      const last = parts.length > 1 ? `${parts[parts.length - 1]![0]}.` : "";
      return `${parts[0]} ${last}`.trim();
    }
    case "anonymous":
    default:
      return `Participant #${index + 1}`;
  }
}

export async function leaderboard(
  userId: string,
  scope: "global" | "organization" | "department" | "exam" | "topic",
  target?: string,
) {
  const { data: me } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
  const viewer = me as Profile | null;

  let nameMode: ExamRow["leaderboard_name_display"] = "first_initial";
  let title = "Global leaderboard";

  const query = db
    .from("exam_attempts")
    .select("user_id, score, exam_id, exams!inner(topic, enable_leaderboard)")
    .eq("status", "submitted");

  if (scope === "exam" && target) {
    const exam = await getExam(target);
    if (!exam) throw new Error("Assessment not found.");
    if (!exam.enable_leaderboard)
      return { title: exam.title, disabled: true, rows: [], myRank: null };
    nameMode = exam.leaderboard_name_display;
    title = exam.title;
    query.eq("exam_id", target);
  }

  const { data: rows } = await query;
  let records = (rows ?? []) as unknown as {
    user_id: string;
    score: number;
    exam_id: string;
    exams: { topic: string; enable_leaderboard: boolean };
  }[];
  records = records.filter((r) => r.exams.enable_leaderboard);

  if (scope === "topic" && target) {
    records = records.filter((r) => r.exams.topic === target);
    title = `${target} leaderboard`;
  }

  const userIds = [...new Set(records.map((r) => r.user_id))];
  const { data: profiles } = await db
    .from("profiles")
    .select("id, full_name, display_name, organization, department, leaderboard_opt_out")
    .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const agg = new Map<string, { scores: number[]; exams: Set<string> }>();
  for (const row of records) {
    const profile = profileMap.get(row.user_id);
    if (!profile) continue;
    if (scope === "organization") {
      if (!viewer?.organization || profile.organization !== viewer.organization) continue;
      title = `${viewer.organization} leaderboard`;
    }
    if (scope === "department") {
      if (!viewer?.department || profile.department !== viewer.department) continue;
      title = `${viewer.department} leaderboard`;
    }
    // Opted-out participants are excluded from public boards, but always see themselves.
    if (profile.leaderboard_opt_out && row.user_id !== userId) continue;
    const bucket = agg.get(row.user_id) ?? {
      scores: [],
      exams: new Set<string>(),
    };
    bucket.scores.push(Number(row.score ?? 0));
    bucket.exams.add(row.exam_id);
    agg.set(row.user_id, bucket);
  }

  const ordered = [...agg.entries()]
    .map(([id, bucket]) => ({
      id,
      score:
        scope === "exam"
          ? Math.max(...bucket.scores)
          : Math.round(bucket.scores.reduce((s, v) => s + v, 0) / bucket.scores.length),
      exams: bucket.exams.size,
    }))
    .sort((a, b) => b.score - a.score || b.exams - a.exams);

  const rowsOut = ordered.slice(0, 25).map((entry, index) => {
    const profile = profileMap.get(entry.id)!;
    return {
      rank: index + 1,
      name:
        entry.id === userId
          ? "You"
          : maskName(
              {
                full_name: profile.full_name,
                display_name: profile.display_name,
              },
              nameMode,
              index,
            ),
      score: entry.score,
      exams: entry.exams,
      isMe: entry.id === userId,
    };
  });

  const myIndex = ordered.findIndex((entry) => entry.id === userId);
  return {
    title,
    disabled: false,
    rows: rowsOut,
    myRank: myIndex >= 0 ? { rank: myIndex + 1, total: ordered.length } : null,
  };
}
