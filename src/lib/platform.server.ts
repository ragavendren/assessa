import { randomBytes } from "node:crypto";

/**
 * Server-only assessment engine: question serving, authoritative scoring,
 * XP ledger, badge evaluation, streaks, topic mastery and leaderboards.
 * Never imported from client code (blocked by the *.server.* filename rule).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { compareScoreThenAttempts, resolveLevel, type LevelRow } from "@/lib/gamification";
import { careerDomains } from "@/lib/play.math";

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
  avatar_id: string | null;
  last_seen_at?: string | null;
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

/** Stable public participant code, e.g. AS-A1B2C3D4 */
export function generateParticipantId() {
  return `AS-${randomBytes(4).toString("hex").toUpperCase()}`;
}

async function allocateParticipantId(preferred?: string | null) {
  const candidate = preferred?.trim() || generateParticipantId();
  for (let attempt = 0; attempt < 6; attempt++) {
    const value = attempt === 0 ? candidate : generateParticipantId();
    const { data } = await db
      .from("profiles")
      .select("id")
      .eq("participant_id", value)
      .maybeSingle();
    if (!data) return value;
  }
  return `AS-${randomBytes(6).toString("hex").toUpperCase()}`;
}

/** Public helper for profile saves that must keep/assign a participant id. */
export async function allocateParticipantIdForSave(preferred?: string | null) {
  return allocateParticipantId(preferred);
}

export async function touchPresence(userId: string) {
  const now = new Date().toISOString();
  const { data } = await db.from("profiles").select("last_seen_at").eq("id", userId).maybeSingle();
  const last = data?.last_seen_at ? Date.parse(data.last_seen_at) : 0;
  if (last && Date.now() - last < 30_000) return;
  await db.from("profiles").update({ last_seen_at: now }).eq("id", userId);
}

export async function ensureProfile(
  userId: string,
  claims: Record<string, unknown>,
): Promise<{ profile: Profile; isAdmin: boolean }> {
  const meta = (claims["user_metadata"] as Record<string, unknown> | undefined) ?? {};
  const email = String(claims["email"] ?? meta["email"] ?? "");

  const { data: existing } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();

  let profile = existing as Profile | null;
  if (!profile) {
    const teamGroup =
      (meta["department"] as string | undefined) ||
      (meta["team_group"] as string | undefined) ||
      null;
    const participantId = await allocateParticipantId(
      (meta["participant_id"] as string | undefined) ?? null,
    );
    const { data, error } = await db
      .from("profiles")
      .insert({
        id: userId,
        email,
        full_name: String(
          meta["full_name"] ?? meta["name"] ?? email.split("@")[0] ?? "Participant",
        ),
        mobile: (meta["mobile"] as string | undefined) ?? null,
        participant_id: participantId,
        organization: (meta["organization"] as string | undefined) ?? null,
        department: teamGroup,
        team_group: teamGroup,
      })
      .select("*")
      .single();
    if (error) throw error;
    profile = data as Profile;
  } else {
    const patch: {
      email?: string;
      participant_id?: string;
      team_group?: string;
    } = {};
    if (email && profile.email !== email) {
      patch.email = email;
      profile.email = email;
    }
    if (!profile.participant_id?.trim()) {
      const participantId = await allocateParticipantId(null);
      patch.participant_id = participantId;
      profile.participant_id = participantId;
    }
    // Keep team_group aligned with department (Team / Group).
    if (profile.department?.trim() && profile.team_group !== profile.department) {
      patch.team_group = profile.department;
      profile.team_group = profile.department;
    }
    if (Object.keys(patch).length > 0) {
      await db.from("profiles").update(patch).eq("id", userId);
    }
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

/** Admin accounts are never listed on public leaderboards. */
async function loadAdminUserIds(): Promise<Set<string>> {
  const { data } = await db.from("user_roles").select("user_id").eq("role", "admin");
  return new Set((data ?? []).map((row) => row.user_id));
}

/* ------------------------------------------------------------------ */
/* xp + levels                                                         */
/* ------------------------------------------------------------------ */

let levelsCache: { at: number; rows: LevelRow[] } | null = null;
let xpRulesCache: { at: number; map: Record<string, number> } | null = null;
const CATALOG_TTL_MS = 60_000;

export async function getLevels(): Promise<LevelRow[]> {
  if (levelsCache && Date.now() - levelsCache.at < CATALOG_TTL_MS) {
    return levelsCache.rows;
  }
  const { data } = await db.from("levels").select("level, name, min_xp").order("min_xp");
  const rows = (data ?? []) as LevelRow[];
  levelsCache = { at: Date.now(), rows };
  return rows;
}

export async function getXpTotal(userId: string) {
  // Aggregate in Postgres instead of shipping every XP row to the app server.
  const { data, error } = await db
    .from("xp_transactions")
    .select("points.sum()")
    .eq("user_id", userId)
    .maybeSingle();
  if (!error && data && typeof (data as { sum?: number }).sum === "number") {
    return Number((data as { sum: number }).sum);
  }
  // Fallback for older PostgREST shapes.
  const { data: rows } = await db.from("xp_transactions").select("points").eq("user_id", userId);
  return (rows ?? []).reduce((sum, row) => sum + (row.points ?? 0), 0);
}

async function xpRules() {
  if (xpRulesCache && Date.now() - xpRulesCache.at < CATALOG_TTL_MS) {
    return xpRulesCache.map;
  }
  const { data } = await db.from("xp_rules").select("code, points, active");
  const map: Record<string, number> = {};
  for (const row of data ?? []) if (row.active) map[row.code] = row.points;
  xpRulesCache = { at: Date.now(), map };
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

async function awardXpBatch(
  userId: string,
  rows: { source: string; points: number; referenceId?: string | null }[],
) {
  const payload = rows
    .filter((row) => row.points > 0)
    .map((row) => ({
      user_id: userId,
      source: row.source,
      points: row.points,
      reference_id: row.referenceId ?? null,
    }));
  if (payload.length === 0) return;
  await db.from("xp_transactions").insert(payload);
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
    /**
     * Opt-in Resend delivery. Default false — conserve ~100/day quota.
     * Exam invites use sendExamInvitationEmails instead.
     */
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

  if (payload.email !== true) return;

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

/** Bulk in-app notifications (no email) — chunks inserts for large audiences. */
export async function notifyMany(
  userIds: string[],
  payload: { kind: string; title: string; body?: string; icon?: string },
) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return;

  const rows = unique.map((userId) => ({
    user_id: userId,
    kind: payload.kind,
    title: payload.title,
    body: payload.body ?? "",
    icon: payload.icon ?? "🔔",
  }));

  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await db.from("notifications").insert(chunk);
    if (error) {
      console.error("[notifyMany] insert failed:", error);
      throw error;
    }
  }
}

type ExamLaunchAudience = {
  id: string;
  title: string;
  access: string;
  organization?: string | null;
  team_group?: string | null;
  starts_at?: string | null;
};

/** Resolve profile IDs that can access an exam (mirrors can_access_exam rules). */
export async function resolveExamAudienceUserIds(exam: ExamLaunchAudience): Promise<string[]> {
  const access = exam.access;

  if (access === "public") {
    const { data, error } = await db.from("profiles").select("id");
    if (error) throw error;
    return (data ?? []).map((row) => row.id);
  }

  if (access === "organization") {
    const org = exam.organization?.trim();
    if (!org) return [];
    const { data, error } = await db.from("profiles").select("id, organization");
    if (error) throw error;
    const needle = org.toLowerCase();
    return (data ?? [])
      .filter((row) => row.organization?.trim().toLowerCase() === needle)
      .map((row) => row.id);
  }

  if (access === "group") {
    const group = exam.team_group?.trim();
    if (!group) return [];
    const { data, error } = await db.from("profiles").select("id, team_group");
    if (error) throw error;
    const needle = group.toLowerCase();
    return (data ?? [])
      .filter((row) => row.team_group?.trim().toLowerCase() === needle)
      .map((row) => row.id);
  }

  if (access === "private") {
    const { data: invites, error: inviteError } = await db
      .from("exam_invitations")
      .select("email")
      .eq("exam_id", exam.id);
    if (inviteError) throw inviteError;
    const emails = [...new Set((invites ?? []).map((row) => row.email))];
    if (emails.length === 0) return [];
    const { data: profiles, error } = await db
      .from("profiles")
      .select("id, email")
      .in("email", emails);
    if (error) throw error;
    return (profiles ?? []).map((row) => row.id);
  }

  return [];
}

/**
 * In-app notification when an assessment is newly launched (published).
 * Audience follows exam access (public / org / group / private invitees).
 */
export async function notifyExamLaunched(exam: ExamLaunchAudience) {
  try {
    const userIds = await resolveExamAudienceUserIds(exam);
    if (userIds.length === 0) return;

    const startsLater =
      exam.starts_at != null &&
      exam.starts_at !== "" &&
      new Date(exam.starts_at).getTime() > Date.now();
    const body = startsLater
      ? `Scheduled to open soon — check Assessments when it starts.`
      : "It's available now in Assessments.";

    await notifyMany(userIds, {
      kind: "exam_launched",
      icon: "📢",
      title: `New assessment — ${exam.title}`,
      body,
    });
  } catch (error) {
    // Publishing should still succeed if notifications fail.
    console.error("[notifyExamLaunched] failed:", error);
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

/** Parallel access checks for non-public exams (avoids sequential N+1 RPCs). */
export async function filterAccessibleExams<T extends { id: string; access: string }>(
  userId: string,
  exams: T[],
): Promise<T[]> {
  if (exams.length === 0) return [];
  const publicExams = exams.filter((exam) => exam.access === "public");
  const restricted = exams.filter((exam) => exam.access !== "public");
  if (restricted.length === 0) return publicExams;

  const checks = await Promise.all(
    restricted.map(async (exam) => {
      const { data: ok } = await db.rpc("can_access_exam", {
        _user_id: userId,
        _exam_id: exam.id,
      });
      return ok ? exam : null;
    }),
  );
  return [...publicExams, ...checks.filter((exam) => exam != null)] as T[];
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
  imageUrl: string | null;
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
    .select(
      "id, prompt, image_url, options, subtopic, points, correct_index, correct_indexes, multi_select",
    )
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
        imageUrl: (q as { image_url?: string | null }).image_url ?? null,
        options: (q!.options as string[]) ?? [],
        subtopic: q!.subtopic,
        points: q!.points,
        multiSelect: Boolean((q as { multi_select?: boolean }).multi_select) || correct.length > 1,
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
  if (used >= exam.max_attempts) {
    const { consumeEntitlement } = await import("@/lib/play.server");
    const voucher = await consumeEntitlement(userId, "mock_voucher");
    if (!voucher) throw new Error("You have used all available attempts.");
  }

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

  // Run independent post-score work in parallel to keep submit snappy under load.
  const [streaks, , previousFails, rules, rank] = await Promise.all([
    updateStreaks(userId, passed, score),
    updateMastery(userId, exam.topic, perSubtopic),
    db
      .from("exam_attempts")
      .select("id")
      .eq("user_id", userId)
      .eq("exam_id", exam.id)
      .eq("status", "submitted")
      .eq("passed", false)
      .neq("id", attemptId)
      .limit(1),
    exam.enable_xp ? xpRules() : Promise.resolve({} as Record<string, number>),
    exam.enable_leaderboard ? examRank(exam.id, userId) : Promise.resolve(null),
  ]);

  const hadPriorFail = (previousFails.data ?? []).length > 0;
  const gains: { label: string; points: number }[] = [];

  if (exam.enable_xp) {
    const pending: {
      source: string;
      points: number;
      referenceId?: string | null;
      label: string;
    }[] = [];
    const queue = (code: string, label: string) => {
      const points = rules[code] ?? 0;
      if (points > 0) pending.push({ source: code, points, referenceId: attemptId, label });
    };
    queue("exam_completed", "Assessment completed");
    if (passed) queue("exam_passed", "Passed");
    if (passed && hadPriorFail) queue("exam_failed_retry", "Retried after a fail");
    if (score === 100) queue("perfect_score", "Perfect score");
    else if (score >= 95) queue("score_95", "Scored above 95%");
    else if (score >= 90) queue("score_90", "Scored above 90%");
    else if (score >= 85) queue("score_85", "Scored above 85%");
    else if (score >= 80) queue("score_80", "Scored above 80%");
    else if (score >= 70) queue("score_70", "Scored above 70%");
    if (streaks.pass >= 3) queue("streak_bonus_3", "3-pass streak bonus");
    if (rank?.rank && rank.rank <= 10 && rank.total >= 3) {
      queue("leaderboard_top10", "Top 10 on leaderboard");
    }
    await awardXpBatch(
      userId,
      pending.map(({ source, points, referenceId }) => ({
        source,
        points,
        ...(referenceId !== undefined ? { referenceId } : {}),
      })),
    );
    for (const row of pending) gains.push({ label: row.label, points: row.points });
  }

  const [newBadges] = await Promise.all([
    exam.enable_badges
      ? evaluateBadges(userId, {
          exam,
          attemptId,
          score,
          passed,
          durationSeconds,
          passStreak: streaks.pass,
          rank,
        })
      : Promise.resolve([] as BadgeRow[]),
    notify(userId, {
      kind: "result",
      title: `Result available — ${exam.title}`,
      body: `You scored ${score}% (${passed ? "PASSED" : "NOT PASSED"}).`,
      icon: passed ? "✅" : "📄",
      href: `/results/${attemptId}`,
      ctaLabel: "View result",
      email: false,
    }),
  ]);

  return summariseResult(userId, attemptId, { gains, newBadges, rank });
}

async function updateMastery(
  userId: string,
  topic: string,
  perSubtopic: Map<string, { correct: number; total: number }>,
) {
  const entries = [...perSubtopic.entries()];
  if (entries.length === 0) return;

  await Promise.all(
    entries.map(async ([subtopic, stats]) => {
      const { data: existing } = await db
        .from("topic_mastery")
        .select("correct_count, total_count")
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
    }),
  );
}

async function updateStreaks(userId: string, passed: boolean, score: number) {
  const now = new Date().toISOString();
  const result = { exam: 0, pass: 0, high_score: 0 };

  const apply = async (type: keyof typeof result, keep: boolean) => {
    const { data } = await db
      .from("user_streaks")
      .select("current_count, longest_count")
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

  await Promise.all([apply("exam", true), apply("pass", passed), apply("high_score", score >= 80)]);
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
  track?: string;
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
  const [{ data }, adminIds] = await Promise.all([
    db
      .from("exam_attempts")
      .select("user_id, score")
      .eq("exam_id", examId)
      .eq("status", "submitted"),
    loadAdminUserIds(),
  ]);
  const bestByUser = new Map<string, number>();
  const attemptsByUser = new Map<string, number>();
  for (const row of data ?? []) {
    if (adminIds.has(row.user_id)) continue;
    attemptsByUser.set(row.user_id, (attemptsByUser.get(row.user_id) ?? 0) + 1);
    const score = Number(row.score ?? 0);
    if (score > (bestByUser.get(row.user_id) ?? -1)) bestByUser.set(row.user_id, score);
  }
  const ordered = [...bestByUser.entries()].sort((a, b) =>
    compareScoreThenAttempts(
      { score: a[1], attempts: attemptsByUser.get(a[0]) ?? 0 },
      { score: b[1], attempts: attemptsByUser.get(b[0]) ?? 0 },
    ),
  );
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
    rank?: { rank: number | null; total: number; top: number; average: number } | null;
  },
) {
  const [{ data: badgeRows }, { data: owned }, stats] = await Promise.all([
    db.from("badges").select("*").eq("active", true),
    db.from("user_badges").select("badge_id").eq("user_id", userId),
    participantStats(userId),
  ]);
  const ownedSet = new Set((owned ?? []).map((b) => b.badge_id));
  const rank =
    ctx.rank !== undefined
      ? ctx.rank
      : ctx.exam.enable_leaderboard
        ? await examRank(ctx.exam.id, userId)
        : null;

  const needsTopicAverage = (badgeRows ?? []).some(
    (b) => !ownedSet.has(b.id) && b.condition_type === "topic_average",
  );
  const topicScores = new Map<string, number[]>();
  if (needsTopicAverage) {
    const topicRows = await db
      .from("exam_attempts")
      .select("score, exams!inner(topic)")
      .eq("user_id", userId)
      .eq("status", "submitted");
    for (const row of (topicRows.data ?? []) as unknown as {
      score: number;
      exams: { topic: string };
    }[]) {
      const list = topicScores.get(row.exams.topic) ?? [];
      list.push(Number(row.score ?? 0));
      topicScores.set(row.exams.topic, list);
    }
  }

  const previous = stats.attempts.filter(
    (a) => a.exam_id === ctx.exam.id && a.id !== ctx.attemptId,
  );
  const previousScore = previous.length ? Number(previous[previous.length - 1]!.score ?? 0) : null;
  const hadFailure = stats.attempts.some((a) => a.id !== ctx.attemptId && a.passed === false);

  const earned: BadgeRow[] = [];
  const badgeXp: { source: string; points: number }[] = [];
  const badgeNotices: Parameters<typeof notify>[1][] = [];

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
    if (badge.xp_reward > 0) {
      badgeXp.push({ source: `badge:${badge.code}`, points: badge.xp_reward });
    }
    badgeNotices.push({
      kind: "badge",
      title: `Badge earned — ${badge.name}`,
      body: `${badge.description}${badge.xp_reward ? ` +${badge.xp_reward} XP` : ""}`,
      icon: badge.icon,
      href: "/achievements",
      ctaLabel: "View achievements",
      email: false,
    });
  }

  await Promise.all([
    awardXpBatch(
      userId,
      badgeXp.map((row) => ({ ...row, referenceId: null })),
    ),
    ...badgeNotices.map((payload) => notify(userId, payload)),
  ]);

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
    rank?: { rank: number | null; total: number; top: number; average: number } | null;
  },
) {
  const { attempt, exam } = await loadAttempt(userId, attemptId);
  const showReview = exam.mode === "practice" || exam.mode === "assessment";

  const [{ data: keys }, xp, levels, rank] = await Promise.all([
    db
      .from("questions")
      .select(
        "id, prompt, image_url, options, correct_index, correct_indexes, multi_select, explanation, subtopic",
      )
      .in("id", attempt.question_ids),
    getXpTotal(userId),
    getLevels(),
    extras?.rank !== undefined
      ? Promise.resolve(extras.rank)
      : exam.enable_leaderboard && exam.show_rank
        ? examRank(exam.id, userId)
        : Promise.resolve(null),
  ]);
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
            imageUrl: (q as { image_url?: string | null }).image_url ?? null,
            options: (q!.options as string[]) ?? [],
            correctIndex: correctIndexes[0] ?? q!.correct_index,
            correctIndexes,
            multiSelect:
              Boolean((q as { multi_select?: boolean }).multi_select) || correctIndexes.length > 1,
            explanation: q!.explanation,
            subtopic: q!.subtopic,
            givenIndex: given[0] ?? null,
            givenIndexes: given,
            correct: sameIndexSet(given, correctIndexes),
          };
        })
    : [];

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
    career: careerDomains(
      (review ?? []).map((item) => ({
        topic: exam.topic,
        subtopic: item.subtopic || "general",
        mastery: item.correct ? 100 : 0,
        answered: 1,
        correct: item.correct ? 1 : 0,
      })),
    ),
    rank,
    level: resolveLevel(xp, levels),
    gains: extras?.gains ?? [],
    newBadges: (extras?.newBadges ?? []).map((b) => ({
      code: b.code,
      name: b.name,
      icon: b.icon,
      description: b.description,
      track: b.track,
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

export async function listLeaderboardExams(userId: string) {
  const { data: exams } = await db
    .from("exams")
    .select(
      "id, title, topic, access, duration_minutes, max_attempts, mode, pass_mark, question_count",
    )
    .eq("active", true)
    .eq("enable_leaderboard", true)
    .order("title", { ascending: true });

  const visible = await filterAccessibleExams(userId, exams ?? []);
  return visible.map((exam) => ({
    id: exam.id,
    title: exam.title,
    topic: exam.topic,
    durationMinutes: exam.duration_minutes,
    maxAttempts: exam.max_attempts,
    mode: exam.mode,
    passMark: exam.pass_mark,
    questionCount: exam.question_count,
  }));
}

export async function leaderboard(
  userId: string,
  scope: "global" | "organization" | "department" | "exam" | "topic",
  target?: string,
  examId?: string | null,
) {
  const { data: me } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
  const viewer = me as Profile | null;

  let nameMode: ExamRow["leaderboard_name_display"] = "first_initial";
  let examIdFilter: string | null = examId?.trim() || null;
  let topicFilter: string | null = null;

  // Legacy: scope=exam|topic with target
  if (scope === "exam" && target) examIdFilter = target;
  if (scope === "topic" && target) topicFilter = target;

  let examTitle: string | null = null;
  let examMeta: {
    durationMinutes: number;
    maxAttempts: number;
    mode: string;
    topic: string;
    passMark: number;
    questionCount: number;
  } | null = null;

  if (examIdFilter) {
    const exam = await getExam(examIdFilter);
    if (!exam) throw new Error("Assessment not found.");
    if (!exam.enable_leaderboard) {
      return {
        title: exam.title,
        examId: exam.id,
        disabled: true,
        rows: [],
        myRank: null,
        examMeta: null,
      };
    }
    nameMode = exam.leaderboard_name_display;
    examTitle = exam.title;
    examMeta = {
      durationMinutes: exam.duration_minutes,
      maxAttempts: exam.max_attempts,
      mode: exam.mode,
      topic: exam.topic,
      passMark: exam.pass_mark,
      questionCount: exam.question_count,
    };
  }

  let query = db
    .from("exam_attempts")
    .select("user_id, score, exam_id, duration_seconds, exams!inner(topic, enable_leaderboard)")
    .eq("status", "submitted");

  if (examIdFilter) query = query.eq("exam_id", examIdFilter);

  const { data: rows } = await query;
  let records = (rows ?? []) as unknown as {
    user_id: string;
    score: number;
    exam_id: string;
    duration_seconds: number | null;
    exams: { topic: string; enable_leaderboard: boolean };
  }[];
  records = records.filter((r) => r.exams.enable_leaderboard);

  if (topicFilter) {
    records = records.filter((r) => r.exams.topic === topicFilter);
  }

  const userIds = [...new Set(records.map((r) => r.user_id))];
  const [{ data: profiles }, adminIds] = await Promise.all([
    db
      .from("profiles")
      .select("id, full_name, display_name, organization, department, leaderboard_opt_out")
      .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
    loadAdminUserIds(),
  ]);
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const audienceScope = scope === "organization" || scope === "department" ? scope : "global";

  type BestAttempt = { score: number; durationSeconds: number | null };
  // Best score per exam per user (ties → faster time), plus total submitted attempts.
  const agg = new Map<string, { byExam: Map<string, BestAttempt>; attempts: number }>();
  for (const row of records) {
    const profile = profileMap.get(row.user_id);
    if (!profile) continue;
    if (adminIds.has(row.user_id)) continue;
    if (audienceScope === "organization") {
      if (!viewer?.organization || profile.organization !== viewer.organization) continue;
    }
    if (audienceScope === "department") {
      if (!viewer?.department || profile.department !== viewer.department) continue;
    }
    // Opted-out participants are excluded from public boards, but always see themselves.
    if (profile.leaderboard_opt_out && row.user_id !== userId) continue;

    const current = agg.get(row.user_id) ?? { byExam: new Map<string, BestAttempt>(), attempts: 0 };
    current.attempts += 1;
    const score = Number(row.score ?? 0);
    const durationSeconds = typeof row.duration_seconds === "number" ? row.duration_seconds : null;
    const prev = current.byExam.get(row.exam_id);
    const betterScore = !prev || score > prev.score;
    const sameScoreFaster =
      prev &&
      score === prev.score &&
      durationSeconds != null &&
      (prev.durationSeconds == null || durationSeconds < prev.durationSeconds);
    if (betterScore || sameScoreFaster) {
      current.byExam.set(row.exam_id, { score, durationSeconds });
    }
    agg.set(row.user_id, current);
  }

  const boardLabel = examTitle ?? (topicFilter ? `${topicFilter}` : "All assessments");
  let title = boardLabel;
  if (audienceScope === "organization" && viewer?.organization) {
    title = `${viewer.organization} · ${boardLabel}`;
  } else if (audienceScope === "department" && viewer?.department) {
    title = `${viewer.department} · ${boardLabel}`;
  }

  const ordered = [...agg.entries()]
    .map(([id, { byExam, attempts }]) => {
      const bests = [...byExam.values()];
      const score = examIdFilter
        ? Math.max(...bests.map((b) => b.score))
        : Math.round(bests.reduce((sum, value) => sum + value.score, 0) / bests.length);
      const durations = bests
        .map((b) => b.durationSeconds)
        .filter((value): value is number => typeof value === "number" && value >= 0);
      const durationSeconds =
        durations.length === 0
          ? null
          : examIdFilter
            ? Math.min(...durations)
            : Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length);
      return { id, score, exams: byExam.size, attempts, durationSeconds };
    })
    .sort(
      (a, b) => compareScoreThenAttempts(a, b) || b.exams - a.exams || a.id.localeCompare(b.id),
    );

  const rowsOut = ordered.slice(0, 50).map((entry, index) => {
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
      attempts: entry.attempts,
      durationSeconds: entry.durationSeconds,
      isMe: entry.id === userId,
    };
  });

  const myIndex = ordered.findIndex((entry) => entry.id === userId);
  return {
    title,
    examId: examIdFilter,
    disabled: false,
    rows: rowsOut,
    myRank: myIndex >= 0 ? { rank: myIndex + 1, total: ordered.length } : null,
    examMeta,
  };
}
