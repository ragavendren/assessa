/**
 * Pool-sourced play engine. Never imported from client code.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import {
  allowedTopicsOf,
  calendarStreakNext,
  careerDomains,
  defaultRulesFor,
  hashSeed,
  mergePlayRules,
  normalizeAnswer,
  parseStoredRules,
  periodKeyFor,
  pickWithSeed,
  PLAY_KIND_META,
  PLAY_KINDS,
  playScore,
  rollReward,
  sameIndexSet,
  serializePlayRules,
  utcDateKey,
  type PlayKind,
  type PlayRules,
  type PlaySegment,
  type PlaySegmentMode,
  type RewardCode,
  type StoredPlayRules,
} from "@/lib/play.math";
import { awardXp, notify, notifyMany, requireAdmin } from "@/lib/platform.server";
import { normalizeTopicKey, topicsMatch } from "@/lib/question-selection.math";

const db = supabaseAdmin;
const AVATAR_IDS_FALLBACK = ["professional-1", "technical-1", "creative-1", "mascot-1", "robot-1"];

type PoolQ = {
  id: string;
  pool_id: string;
  prompt: string;
  image_url?: string | null;
  options: unknown;
  correct_index: number;
  correct_indexes: number[] | null;
  multi_select: boolean | null;
  explanation: string | null;
  topic: string;
  subtopic: string;
  difficulty: string;
  status: string;
};

function resolveIndexes(q: {
  correct_index: number;
  correct_indexes?: number[] | null;
  multi_select?: boolean | null;
}): { indexes: number[]; multiSelect: boolean } {
  const indexes =
    Array.isArray(q.correct_indexes) && q.correct_indexes.length
      ? q.correct_indexes.filter((n) => typeof n === "number")
      : [q.correct_index];
  return { indexes, multiSelect: Boolean(q.multi_select) || indexes.length > 1 };
}

function publicQuestion(q: PoolQ) {
  const { indexes } = resolveIndexes(q);
  return {
    id: q.id,
    prompt: q.prompt,
    imageUrl: q.image_url ?? null,
    options: Array.isArray(q.options) ? (q.options as string[]) : [],
    topic: q.topic,
    subtopic: q.subtopic,
    multiSelect: Boolean(q.multi_select) || indexes.length > 1,
    explanation: q.explanation ?? "",
  };
}

async function loadPoolQuestions(
  poolId?: string | null,
  topic?: string | null,
  allowedTopics?: string[] | null,
): Promise<PoolQ[]> {
  let query = db
    .from("pool_questions")
    .select(
      "id, pool_id, prompt, image_url, options, correct_index, correct_indexes, multi_select, explanation, topic, subtopic, difficulty, status",
    )
    .eq("status", "active");
  if (poolId) query = query.eq("pool_id", poolId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as PoolQ[];
  if (topic) {
    const matched = rows.filter((q) => topicsMatch(q.topic, topic));
    if (matched.length === 0) {
      throw new Error("No active pool questions for this topic.");
    }
    return matched;
  }
  if (allowedTopics?.length) {
    const matched = rows.filter((q) => allowedTopics.some((label) => topicsMatch(q.topic, label)));
    if (matched.length === 0) {
      throw new Error("No active pool questions in the topics enabled for this mode.");
    }
    return matched;
  }
  return rows;
}

async function largestPoolId(minCount: number, courseId?: string | null): Promise<string | null> {
  let allowed: Set<string> | null = null;
  if (courseId) {
    const { data: pools } = await db
      .from("question_pools")
      .select("id")
      .eq("course_id", courseId)
      .eq("status", "active");
    allowed = new Set((pools ?? []).map((pool) => pool.id));
    if (allowed.size === 0) return null;
  }
  const { data } = await db.from("pool_questions").select("pool_id").eq("status", "active");
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    if (allowed && !allowed.has(row.pool_id)) continue;
    counts.set(row.pool_id, (counts.get(row.pool_id) ?? 0) + 1);
  }
  let best: { id: string; n: number } | null = null;
  for (const [id, n] of counts) {
    if (n >= minCount && (!best || n > best.n)) best = { id, n };
  }
  if (best) return best.id;
  const first = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return first?.[0] ?? null;
}

type ResolvedChallenge = {
  id: string;
  rules: PlayRules;
  poolId: string | null;
  courseId: string | null;
  topic: string | null;
  allowedTopics: string[] | null;
};

function rulesJson(
  rules: PlayRules,
  allowedTopics: string[] | null,
  extras?: StoredPlayRules,
): Json {
  return serializePlayRules(rules, allowedTopics, extras) as Json;
}

async function playMenuEnabled(): Promise<boolean> {
  const { data, error } = await db
    .from("play_settings")
    .select("menu_enabled")
    .eq("id", "default")
    .maybeSingle();
  if (error) return true;
  return data?.menu_enabled !== false;
}

export async function getPlayMenuFlag() {
  return { menuEnabled: await playMenuEnabled() };
}

async function requirePlayMenu() {
  if (!(await playMenuEnabled())) {
    throw new Error("Play is turned off.");
  }
}

async function kindEnabled(kind: PlayKind): Promise<boolean> {
  if (!(await playMenuEnabled())) return false;
  const { data } = await db.from("challenges").select("status").eq("kind", kind);
  if (!data?.length) return true;
  return data.some((row) => row.status === "active");
}

function resolveGlobalChallenge(
  globalRows: Array<{
    id: string;
    pool_id: string | null;
    course_id: string | null;
    topic: string | null;
    rules: Json | null;
    status: string;
  }>,
  courseId?: string | null,
) {
  if (courseId) {
    const bound = globalRows.find((row) => row.course_id === courseId);
    if (bound) return bound.status === "active" ? bound : null;
  }
  return (
    globalRows.find((row) => !row.course_id && row.status === "active") ??
    globalRows.find((row) => row.status === "active") ??
    null
  );
}

async function ensureChallenge(args: {
  kind: PlayKind;
  poolId?: string | null;
  topic?: string | null;
  questionCount?: number;
  courseId?: string | null;
}): Promise<ResolvedChallenge> {
  const topic = args.topic?.trim() || null;
  const { data: rows } = await db
    .from("challenges")
    .select("id, pool_id, course_id, topic, rules, status, updated_at")
    .eq("kind", args.kind);
  const topicMatch = (rows ?? []).filter(
    (row) => topic && row.topic && topicsMatch(row.topic, topic),
  );
  const globalRows = (rows ?? []).filter((row) => !row.topic);
  const activeTopic = topicMatch.find((row) => row.status === "active");
  const activeGlobal = resolveGlobalChallenge(globalRows, args.courseId);
  const match = activeTopic ?? activeGlobal;
  if (!match) {
    if ((rows ?? []).length > 0) {
      throw new Error(`${PLAY_KIND_META[args.kind].label} is turned off.`);
    }
    const rules = defaultRulesFor(args.kind, args.questionCount);
    const { data, error } = await db
      .from("challenges")
      .insert({
        kind: args.kind,
        name: PLAY_KIND_META[args.kind].label,
        pool_id: args.poolId ?? null,
        topic: null,
        rules: rulesJson(rules, null),
        status: "active",
      })
      .select("id, pool_id, course_id, topic")
      .single();
    if (error) throw new Error(error.message);
    return {
      id: data.id,
      rules,
      poolId: data.pool_id,
      courseId: data.course_id,
      topic: data.topic,
      allowedTopics: null,
    };
  }
  const stored = parseStoredRules(match.rules);
  const rules = mergePlayRules(args.kind, stored, args.questionCount);
  const allowedTopics = allowedTopicsOf(stored);
  if (topic && allowedTopics?.length && !allowedTopics.some((label) => topicsMatch(label, topic))) {
    throw new Error("This topic is not enabled for play.");
  }
  return {
    id: match.id,
    rules,
    poolId: match.pool_id,
    courseId: match.course_id,
    topic: match.topic,
    allowedTopics,
  };
}

function instancePeriodKey(args: {
  kind: PlayKind;
  topic?: string | null;
  poolId?: string | null;
  count: number;
  matchId?: string | null;
  scenarioId?: string | null;
  sceneIndex?: number;
}): string {
  if (args.matchId) return `match:${args.matchId}`;
  if (args.scenarioId) return `escape:${args.scenarioId}:${args.sceneIndex ?? 0}`;
  const base = periodKeyFor(args.kind);
  if (PLAY_KIND_META[args.kind].period !== "open") return base;
  return `${base}:${args.topic ?? "all"}:${args.poolId ?? "any"}:${args.count}`;
}

async function ensureInstance(args: {
  challengeId: string;
  periodKey: string;
  poolId: string | null;
  topic: string | null;
  count: number;
  allowedTopics?: string[] | null;
}): Promise<{ id: string; questionIds: string[] }> {
  const { data: existing } = await db
    .from("challenge_instances")
    .select("id, question_ids")
    .eq("challenge_id", args.challengeId)
    .eq("period_key", args.periodKey)
    .maybeSingle();
  if (existing?.question_ids?.length) {
    return { id: existing.id, questionIds: existing.question_ids };
  }
  const bank = await loadPoolQuestions(args.poolId, args.topic, args.allowedTopics);
  if (bank.length === 0) throw new Error("No active pool questions available for this challenge.");
  const picked = pickWithSeed(
    bank,
    Math.min(args.count, bank.length),
    `${args.challengeId}:${args.periodKey}`,
  );
  const ids = picked.map((q) => q.id);
  const { data, error } = await db
    .from("challenge_instances")
    .upsert(
      { challenge_id: args.challengeId, period_key: args.periodKey, question_ids: ids },
      { onConflict: "challenge_id,period_key" },
    )
    .select("id, question_ids")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id, questionIds: data.question_ids };
}

async function loadQuestionsByIds(ids: string[]): Promise<PoolQ[]> {
  if (ids.length === 0) return [];
  const { data, error } = await db
    .from("pool_questions")
    .select(
      "id, pool_id, prompt, image_url, options, correct_index, correct_indexes, multi_select, explanation, topic, subtopic, difficulty, status",
    )
    .in("id", ids);
  if (error) throw new Error(error.message);
  const byId = new Map((data ?? []).map((q) => [q.id, q as PoolQ]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as PoolQ[];
}

async function hasDoubleXp(userId: string): Promise<boolean> {
  const { data } = await db
    .from("play_entitlements")
    .select("id, expires_at, remaining")
    .eq("user_id", userId)
    .eq("code", "double_xp")
    .gt("remaining", 0);
  const now = Date.now();
  return (data ?? []).some((row) => !row.expires_at || Date.parse(row.expires_at) > now);
}

async function grantEntitlement(userId: string, code: string, remaining = 1, hours?: number) {
  await db.from("play_entitlements").insert({
    user_id: userId,
    code,
    remaining,
    expires_at: hours ? new Date(Date.now() + hours * 3600_000).toISOString() : null,
  });
}

export async function consumeEntitlement(userId: string, code: string): Promise<boolean> {
  const { data } = await db
    .from("play_entitlements")
    .select("id, remaining, expires_at")
    .eq("user_id", userId)
    .eq("code", code)
    .gt("remaining", 0)
    .order("created_at", { ascending: true });
  const now = Date.now();
  const row = (data ?? []).find((item) => !item.expires_at || Date.parse(item.expires_at) > now);
  if (!row) return false;
  await db
    .from("play_entitlements")
    .update({ remaining: row.remaining - 1 })
    .eq("id", row.id);
  return true;
}

async function updateDailyStreak(userId: string): Promise<number> {
  const { data } = await db
    .from("user_streaks")
    .select("current_count, longest_count, last_activity_at")
    .eq("user_id", userId)
    .eq("streak_type", "daily")
    .maybeSingle();
  const next = calendarStreakNext(data?.last_activity_at, data?.current_count ?? 0);
  const longest = Math.max(data?.longest_count ?? 0, next.current);
  await db.from("user_streaks").upsert(
    {
      user_id: userId,
      streak_type: "daily",
      current_count: next.current,
      longest_count: longest,
      last_activity_at: new Date().toISOString(),
    },
    { onConflict: "user_id,streak_type" },
  );
  return next.current;
}

async function awardPlayXp(userId: string, source: string, points: number, referenceId: string) {
  const doubled = (await hasDoubleXp(userId)) ? points * 2 : points;
  if (doubled > 0) await awardXp(userId, source, doubled, referenceId);
  return doubled;
}

async function awardPlayBadges(
  userId: string,
  kind: PlayKind,
  extra: { dailyStreak?: number; weeklyRank?: number | null; livesLeft?: number | null },
) {
  const { data: catalog } = await db.from("badges").select("*").eq("active", true);
  const { data: owned } = await db.from("user_badges").select("badge_id").eq("user_id", userId);
  const have = new Set((owned ?? []).map((row) => row.badge_id));
  const earned: Array<{ code: string; name: string; icon: string }> = [];
  for (const badge of catalog ?? []) {
    if (have.has(badge.id)) continue;
    let ok = false;
    if (
      badge.condition_type === "daily_streak" &&
      (extra.dailyStreak ?? 0) >= Number(badge.condition_value)
    )
      ok = true;
    if (
      badge.condition_type === "weekly_top10" &&
      extra.weeklyRank != null &&
      extra.weeklyRank <= Number(badge.condition_value)
    )
      ok = true;
    if (badge.code === "speed_demon_play" && kind === "speed") ok = true;
    if (badge.code === "survivor" && kind === "survival" && (extra.livesLeft ?? 0) > 0) ok = true;
    if (!ok) continue;
    await db.from("user_badges").insert({ user_id: userId, badge_id: badge.id });
    if (badge.xp_reward > 0)
      await awardXp(userId, `badge:${badge.code}`, badge.xp_reward, badge.id);
    earned.push({ code: badge.code, name: badge.name, icon: badge.icon });
  }
  return earned;
}

async function updatePlayMastery(
  userId: string,
  questions: PoolQ[],
  answers: Record<string, number | number[]>,
) {
  const buckets = new Map<
    string,
    { topic: string; subtopic: string; correct: number; total: number }
  >();
  for (const q of questions) {
    const key = `${normalizeTopicKey(q.topic)}::${normalizeTopicKey(q.subtopic)}`;
    const bucket = buckets.get(key) ?? {
      topic: q.topic || "general",
      subtopic: q.subtopic || "general",
      correct: 0,
      total: 0,
    };
    bucket.total += 1;
    const { indexes } = resolveIndexes(q);
    if (sameIndexSet(normalizeAnswer(answers[q.id]), indexes)) bucket.correct += 1;
    buckets.set(key, bucket);
  }
  for (const bucket of buckets.values()) {
    const { data: existing } = await db
      .from("topic_mastery")
      .select("correct_count, total_count")
      .eq("user_id", userId)
      .eq("topic", bucket.topic)
      .eq("subtopic", bucket.subtopic)
      .maybeSingle();
    const correct = (existing?.correct_count ?? 0) + bucket.correct;
    const total = (existing?.total_count ?? 0) + bucket.total;
    await db.from("topic_mastery").upsert(
      {
        user_id: userId,
        topic: bucket.topic,
        subtopic: bucket.subtopic,
        correct_count: correct,
        total_count: total,
        mastery: total > 0 ? Math.round((correct / total) * 100) : 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,topic,subtopic" },
    );
  }
}

function remainingSeconds(endsAt: string | null | undefined): number {
  if (!endsAt) return 0;
  return Math.max(0, Math.round((Date.parse(endsAt) - Date.now()) / 1000));
}

function challengeIdsForCourse(
  rows: Array<{ id: string; course_id: string | null }>,
  courseId: string,
): string[] {
  const bound = rows.filter((row) => row.course_id === courseId);
  if (bound.length > 0) return bound.map((row) => row.id);
  return rows.filter((row) => !row.course_id).map((row) => row.id);
}

async function buildPlaySegments(
  challengeRows: Array<{
    id: string;
    kind: string;
    status: string;
    course_id: string | null;
    activity_id: string | null;
    pool_id: string | null;
    topic: string | null;
    rules: Json | null;
  }>,
  inventory: CatalogPool[],
  activities: Array<{ id: string; name: string }>,
): Promise<PlaySegment[]> {
  const enabled = enabledKinds(challengeRows);
  const globals = challengeRows.filter((row) => !row.topic);
  const courseIds = new Set<string>();
  for (const pool of inventory) courseIds.add(pool.courseId);
  for (const row of globals) {
    if (row.course_id) courseIds.add(row.course_id);
  }
  const { data: courses } = await db
    .from("courses")
    .select("id, name")
    .in("id", [...courseIds])
    .eq("status", "active")
    .order("name");
  const courseNameById = new Map((courses ?? []).map((row) => [row.id, row.name]));

  const segments: PlaySegment[] = [];
  for (const courseId of courseIds) {
    const pools = inventory.filter((pool) => pool.courseId === courseId);
    const modes: PlaySegmentMode[] = [];
    for (const kind of PLAY_KINDS) {
      if (kind === "knockout" || kind === "escape") continue;
      const bound = globals.find((row) => row.kind === kind && row.course_id === courseId);
      const fallback = globals.find(
        (row) => row.kind === kind && !row.course_id && !row.activity_id,
      );
      const row = bound ?? fallback;
      const kindOn = enabled[kind];
      const active = Boolean(row && row.status === "active" && kindOn);
      const stored = row ? parseStoredRules(row.rules) : null;
      const rules = mergePlayRules(kind, stored ?? undefined);
      const allowedTopics = allowedTopicsOf(stored);
      const filtered = filterCatalog(pools, {
        poolId: row?.pool_id ?? null,
        courseId: row?.course_id ?? courseId,
        allowedTopics,
      });
      const hasPool =
        kind === "flash"
          ? filtered.some((pool) => pool.questionCount > 0)
          : kind === "arena"
            ? filtered.some((pool) => pool.questionCount > 0)
            : filtered.some((pool) => pool.questionCount >= rules.questionCount);
      if (!active || !hasPool) continue;
      modes.push({
        kind,
        enabled: true,
        label: PLAY_KIND_META[kind].label,
        blurb: PLAY_KIND_META[kind].blurb,
        poolId: row?.pool_id ?? filtered[0]?.id ?? null,
        bindingCourseId: row?.course_id ?? courseId,
        questionCount: rules.questionCount,
        durationSeconds: rules.durationSeconds,
        lives: rules.lives,
        hasPool,
      });
    }
    if (modes.length === 0) continue;
    const name = courseNameById.get(courseId) ?? pools[0]?.courseName ?? "Course";
    segments.push({
      scope: "course",
      id: courseId,
      name,
      courseId,
      courseName: name,
      poolCount: pools.length,
      questionCount: pools.reduce((sum, pool) => sum + pool.questionCount, 0),
      modes,
    });
  }

  for (const activity of activities) {
    const modes: PlaySegmentMode[] = [];
    for (const kind of PLAY_KINDS) {
      if (kind === "knockout" || kind === "escape") continue;
      const row = globals.find((r) => r.kind === kind && r.activity_id === activity.id);
      if (!row || row.status !== "active" || !enabled[kind]) continue;
      const stored = parseStoredRules(row.rules);
      const rules = mergePlayRules(kind, stored ?? undefined);
      const filtered = filterCatalog(inventory, {
        poolId: row.pool_id ?? null,
        courseId: row.course_id ?? null,
        allowedTopics: allowedTopicsOf(stored),
      });
      const hasPool = filtered.some((pool) => pool.questionCount > 0);
      if (!hasPool && kind !== "arena") continue;
      modes.push({
        kind,
        enabled: true,
        label: PLAY_KIND_META[kind].label,
        blurb: PLAY_KIND_META[kind].blurb,
        poolId: row.pool_id ?? filtered[0]?.id ?? null,
        bindingCourseId: row.course_id ?? null,
        questionCount: rules.questionCount,
        durationSeconds: rules.durationSeconds,
        lives: rules.lives,
        hasPool,
      });
    }
    if (modes.length === 0) continue;
    const poolId = modes.find((m) => m.poolId)?.poolId;
    const pools = poolId ? inventory.filter((p) => p.id === poolId) : [];
    segments.push({
      scope: "activity",
      id: activity.id,
      name: activity.name,
      courseId: activity.id,
      courseName: activity.name,
      poolCount: pools.length,
      questionCount: pools.reduce((sum, pool) => sum + pool.questionCount, 0),
      modes,
    });
  }

  return segments.sort((a, b) => {
    if (a.scope !== b.scope) return a.scope === "course" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function listPlayHub(userId: string) {
  const today = utcDateKey();
  const week = periodKeyFor("weekly");
  const inventory = await loadCatalogInventory();
  const [
    { data: challengeRows },
    { data: dailyDone },
    { data: weekInstances },
    { data: weeklyDone },
    { data: streaks },
    { data: openSession },
    { data: matches },
    { data: scenarios },
    { data: tournaments },
    { data: activities },
    { data: arenas },
    menuFlag,
  ] = await Promise.all([
    db.from("challenges").select("id, kind, status, course_id, activity_id, pool_id, topic, rules"),
    db
      .from("play_sessions")
      .select("id, score, status, started_at")
      .eq("user_id", userId)
      .eq("kind", "daily")
      .gte("started_at", `${today}T00:00:00.000Z`)
      .order("started_at", { ascending: false })
      .limit(1),
    db.from("challenge_instances").select("id").eq("period_key", week),
    db
      .from("play_sessions")
      .select("id, score, status, instance_id")
      .eq("user_id", userId)
      .eq("kind", "weekly")
      .in("status", ["submitted", "game_over"])
      .limit(20),
    db
      .from("user_streaks")
      .select("*")
      .eq("user_id", userId)
      .eq("streak_type", "daily")
      .maybeSingle(),
    db
      .from("play_sessions")
      .select("id, kind, topic, current_index, started_at")
      .eq("user_id", userId)
      .eq("status", "in_progress")
      .order("started_at", { ascending: false })
      .limit(5),
    db
      .from("play_matches")
      .select("id, status, inviter_id, invitee_id, invitee_email, created_at")
      .or(`inviter_id.eq.${userId},invitee_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(8),
    db.from("escape_scenarios").select("id, name, intro, status").eq("status", "active"),
    db.from("play_tournaments").select("id, name, size, status").neq("status", "complete").limit(8),
    db.from("play_activities").select("id, name").eq("status", "active").order("name"),
    db
      .from("play_arenas")
      .select("id, name, activity_id, status")
      .in("status", ["lobby", "question", "locked", "revealed"])
      .order("created_at", { ascending: false })
      .limit(12),
    playMenuEnabled(),
  ]);

  const menuEnabled = menuFlag;
  const enabled = menuEnabled
    ? enabledKinds(challengeRows ?? [])
    : (Object.fromEntries(PLAY_KINDS.map((kind) => [kind, false])) as Record<PlayKind, boolean>);
  const segments = menuEnabled
    ? await buildPlaySegments(challengeRows ?? [], inventory, activities ?? [])
    : [];
  const weekInstanceIds = new Set((weekInstances ?? []).map((row) => row.id));
  const weeklySubmitted = (weeklyDone ?? []).filter(
    (row) =>
      row.status === "submitted" && (!row.instance_id || weekInstanceIds.has(row.instance_id)),
  );
  return {
    enabled,
    daily: {
      periodKey: today,
      completed: Boolean(dailyDone?.[0] && dailyDone[0].status !== "in_progress"),
      sessionId: dailyDone?.[0]?.id ?? null,
      challengeReady:
        enabled.daily && segments.some((s) => s.modes.some((m) => m.kind === "daily")),
    },
    weekly: {
      periodKey: week,
      completed: weeklySubmitted.length > 0,
    },
    streak: {
      current: streaks?.current_count ?? 0,
      longest: streaks?.longest_count ?? 0,
    },
    resume: (openSession ?? []).map((row) => ({
      id: row.id,
      kind: row.kind as PlayKind,
      topic: row.topic,
      index: row.current_index,
    })),
    matches: enabled.battle ? (matches ?? []) : [],
    scenarios: enabled.escape ? (scenarios ?? []) : [],
    tournaments: enabled.knockout ? (tournaments ?? []) : [],
    arenas: enabled.arena ? (arenas ?? []) : [],
    segments,
    menuEnabled,
  };
}

function enabledKinds(rows: Array<{ kind: string; status: string }>): Record<PlayKind, boolean> {
  const map = {} as Record<PlayKind, boolean>;
  for (const kind of PLAY_KINDS) {
    const ofKind = rows.filter((row) => row.kind === kind);
    map[kind] = ofKind.length === 0 || ofKind.some((row) => row.status === "active");
  }
  return map;
}

type CatalogPool = {
  id: string;
  name: string;
  courseId: string;
  courseName: string;
  topics: Array<{ label: string; count: number }>;
  questionCount: number;
};

async function loadCatalogInventory(): Promise<CatalogPool[]> {
  const { data: pools } = await db
    .from("question_pools")
    .select("id, name, course_id, courses(name)")
    .eq("status", "active");
  const { data: questions } = await db
    .from("pool_questions")
    .select("pool_id, topic")
    .eq("status", "active");
  const byPool = new Map<string, Map<string, { label: string; count: number }>>();
  for (const q of questions ?? []) {
    const key = normalizeTopicKey(q.topic) || "general";
    const poolMap = byPool.get(q.pool_id) ?? new Map();
    const current = poolMap.get(key) ?? { label: q.topic.trim() || "general", count: 0 };
    current.count += 1;
    poolMap.set(key, current);
    byPool.set(q.pool_id, poolMap);
  }
  return (pools ?? []).map((pool) => {
    const course = pool.courses as unknown as { name: string } | null;
    const topics = [...(byPool.get(pool.id)?.values() ?? [])].sort((a, b) => b.count - a.count);
    return {
      id: pool.id,
      name: pool.name,
      courseId: pool.course_id,
      courseName: course?.name ?? "Course",
      topics,
      questionCount: topics.reduce((sum, t) => sum + t.count, 0),
    };
  });
}

function filterCatalog(
  pools: CatalogPool[],
  challenge: {
    poolId: string | null;
    courseId: string | null;
    allowedTopics: string[] | null;
  } | null,
): CatalogPool[] {
  if (!challenge) return pools;
  let next = pools;
  if (challenge.poolId) next = next.filter((pool) => pool.id === challenge.poolId);
  else if (challenge.courseId) next = next.filter((pool) => pool.courseId === challenge.courseId);
  if (challenge.allowedTopics?.length) {
    next = next
      .map((pool) => {
        const topics = pool.topics.filter((item) =>
          challenge.allowedTopics!.some((label) => topicsMatch(label, item.label)),
        );
        return {
          ...pool,
          topics,
          questionCount: topics.reduce((sum, t) => sum + t.count, 0),
        };
      })
      .filter((pool) => pool.topics.length > 0);
  }
  return next;
}

export async function listTopicCatalog(kind: PlayKind = "topic", courseId?: string | null) {
  let inventory = await loadCatalogInventory();
  if (courseId) inventory = inventory.filter((pool) => pool.courseId === courseId);
  if (!(await kindEnabled(kind))) {
    return { pools: [] as CatalogPool[], enabled: false as const, courseId: courseId ?? null };
  }
  const { data: rows } = await db
    .from("challenges")
    .select("id, pool_id, course_id, topic, rules, status")
    .eq("kind", kind)
    .eq("status", "active");
  const globals = (rows ?? []).filter((row) => !row.topic);
  const global =
    (courseId
      ? resolveGlobalChallenge(globals, courseId)
      : globals.find((row) => !row.course_id)) ??
    globals[0] ??
    null;
  const stored = global ? parseStoredRules(global.rules) : null;
  const pools = filterCatalog(
    inventory,
    global
      ? {
          poolId: global.pool_id,
          courseId: global.course_id ?? courseId ?? null,
          allowedTopics: allowedTopicsOf(stored),
        }
      : courseId
        ? { poolId: null, courseId, allowedTopics: null }
        : null,
  );
  return { pools, enabled: true as const, courseId: courseId ?? global?.course_id ?? null };
}

export async function startPlaySession(
  userId: string,
  args: {
    kind: PlayKind;
    poolId?: string | null;
    topic?: string | null;
    questionCount?: number;
    courseId?: string | null;
    matchId?: string | null;
    scenarioId?: string | null;
    sceneIndex?: number;
  },
) {
  await requirePlayMenu();
  const kind = args.kind;
  if (kind === "arena") {
    throw new Error("Join Live Arena from Play — it is a hosted team event.");
  }
  const challenge = await ensureChallenge({
    kind,
    ...(args.topic != null ? { topic: args.topic } : {}),
    ...(args.questionCount !== undefined ? { questionCount: args.questionCount } : {}),
    ...(args.courseId !== undefined ? { courseId: args.courseId } : {}),
  });
  const rules = challenge.rules;
  const courseScope = args.courseId ?? challenge.courseId;
  const poolId =
    args.poolId ?? challenge.poolId ?? (await largestPoolId(rules.questionCount, courseScope));
  if (!poolId && kind !== "flash")
    throw new Error("Add pool questions before starting a challenge.");

  if (kind === "daily" || kind === "weekly" || kind === "team") {
    const period = periodKeyFor(kind);
    const { data: periodInstances } = await db
      .from("challenge_instances")
      .select("id")
      .eq("period_key", period);
    const instanceIds = (periodInstances ?? []).map((row) => row.id);
    if (instanceIds.length > 0) {
      const { data: prior } = await db
        .from("play_sessions")
        .select("id, status")
        .eq("user_id", userId)
        .eq("kind", kind)
        .in("instance_id", instanceIds);
      const open = (prior ?? []).find((row) => row.status === "in_progress");
      if (open) return { sessionId: open.id, resumed: true };
      if (rules.onePerPeriod && (prior ?? []).some((row) => row.status !== "in_progress")) {
        throw new Error("You already completed this challenge for the current period.");
      }
    }
  } else {
    const { data: open } = await db
      .from("play_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("kind", kind)
      .eq("status", "in_progress")
      .maybeSingle();
    if (open && !args.matchId && !args.scenarioId) return { sessionId: open.id, resumed: true };
  }

  let lives = rules.lives;
  if (kind === "survival") {
    const extraLife = await consumeEntitlement(userId, "extra_life");
    if (extraLife) lives = (lives ?? 3) + 1;
  }

  const period = instancePeriodKey({
    kind,
    topic: args.topic ?? challenge.topic,
    poolId,
    count: rules.questionCount,
    ...(args.matchId ? { matchId: args.matchId } : {}),
    ...(args.scenarioId ? { scenarioId: args.scenarioId } : {}),
    ...(args.sceneIndex !== undefined ? { sceneIndex: args.sceneIndex } : {}),
  });

  let questionIds: string[] = [];
  let instanceId: string | null = null;
  if (args.matchId) {
    const { data: match } = await db
      .from("play_matches")
      .select("id, instance_id, inviter_id, invitee_id, status")
      .eq("id", args.matchId)
      .maybeSingle();
    if (!match) throw new Error("Battle not found.");
    if (match.inviter_id !== userId && match.invitee_id !== userId)
      throw new Error("This battle is not yours.");
    if (match.instance_id) {
      const { data: inst } = await db
        .from("challenge_instances")
        .select("id, question_ids")
        .eq("id", match.instance_id)
        .single();
      if (inst) {
        instanceId = inst.id;
        questionIds = inst.question_ids;
      }
    }
  }
  if (questionIds.length === 0) {
    const inst = await ensureInstance({
      challengeId: challenge.id,
      periodKey: period,
      poolId,
      topic: args.topic ?? challenge.topic,
      count: rules.questionCount,
      ...(challenge.allowedTopics ? { allowedTopics: challenge.allowedTopics } : {}),
    });
    instanceId = inst.id;
    questionIds = inst.questionIds;
    if (args.matchId) {
      await db
        .from("play_matches")
        .update({ instance_id: inst.id, status: "ready" })
        .eq("id", args.matchId);
    }
  }

  const endsAt = rules.durationSeconds
    ? new Date(Date.now() + rules.durationSeconds * 1000).toISOString()
    : null;
  const questionEndsAt = rules.perQuestionSeconds
    ? new Date(Date.now() + rules.perQuestionSeconds * 1000).toISOString()
    : null;

  const { data, error } = await db
    .from("play_sessions")
    .insert({
      user_id: userId,
      challenge_id: challenge.id,
      instance_id: instanceId,
      match_id: args.matchId ?? null,
      kind,
      topic: args.topic ?? challenge.topic,
      question_ids: questionIds,
      lives_left: lives,
      ends_at: endsAt,
      question_ends_at: questionEndsAt,
      extra: {
        scenarioId: args.scenarioId ?? null,
        sceneIndex: args.sceneIndex ?? 0,
        rules: rulesJson(rules, challenge.allowedTopics),
      },
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { sessionId: data.id, resumed: false };
}

export async function loadPlayPaper(userId: string, sessionId: string) {
  const { data: session, error } = await db
    .from("play_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!session || session.user_id !== userId) throw new Error("Session not found.");
  const questions = await loadQuestionsByIds(session.question_ids);
  const kind = session.kind as PlayKind;
  const extra = (session.extra ?? {}) as {
    scenarioId?: string | null;
    sceneIndex?: number;
    rules?: StoredPlayRules;
  };
  const rules = mergePlayRules(kind, extra.rules, session.question_ids.length);
  return {
    session: {
      id: session.id,
      kind,
      topic: session.topic,
      status: session.status as "in_progress" | "submitted" | "game_over",
      currentIndex: session.current_index,
      livesLeft: session.lives_left,
      endsAt: session.ends_at,
      questionEndsAt: session.question_ends_at,
      answers: (session.answers ?? {}) as Record<string, number | number[]>,
      startedAt: session.started_at,
      score: session.score,
      correctCount: session.correct_count,
      scenarioId: extra.scenarioId ?? null,
      sceneIndex: extra.sceneIndex ?? 0,
      matchId: session.match_id,
      remaining: remainingSeconds(session.ends_at),
      rules,
    },
    questions: questions.map((q) => {
      const pub = publicQuestion(q);
      return { ...pub, explanation: undefined as string | undefined };
    }),
  };
}

export async function checkpointPlay(
  userId: string,
  sessionId: string,
  payload: { answers: Record<string, number | number[]>; currentIndex?: number },
) {
  const { data: session } = await db
    .from("play_sessions")
    .select("id, user_id, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.user_id !== userId) throw new Error("Session not found.");
  if (session.status !== "in_progress") return { ok: true as const };
  await db
    .from("play_sessions")
    .update({
      answers: payload.answers,
      current_index: payload.currentIndex ?? 0,
    })
    .eq("id", sessionId);
  return { ok: true as const };
}

function gradeAll(questions: PoolQ[], answers: Record<string, number | number[]>) {
  let correct = 0;
  for (const q of questions) {
    const { indexes } = resolveIndexes(q);
    if (sameIndexSet(normalizeAnswer(answers[q.id]), indexes)) correct += 1;
  }
  return correct;
}

function attemptedQuestions(
  kind: PlayKind,
  questions: PoolQ[],
  answers: Record<string, number | number[]>,
  currentIndex: number,
): PoolQ[] {
  if (kind !== "survival" && kind !== "rapid" && kind !== "escape") return questions;
  const answered = new Set(Object.keys(answers));
  const count = Math.max(currentIndex, answered.size);
  const sliced = questions.filter((q, i) => i < count || answered.has(q.id));
  return sliced.length > 0 ? sliced : questions.slice(0, Math.max(1, count));
}

export async function gradePlayItem(
  userId: string,
  sessionId: string,
  payload: { questionId: string; answer: number | number[] | null },
) {
  const paper = await loadPlayPaper(userId, sessionId);
  if (paper.session.status !== "in_progress") throw new Error("Session already finished.");
  const { data: raw } = await db.from("play_sessions").select("*").eq("id", sessionId).single();
  if (!raw) throw new Error("Session not found.");
  const questions = await loadQuestionsByIds(raw.question_ids);
  const question = questions.find((q) => q.id === payload.questionId);
  if (!question) throw new Error("Question not in this session.");
  const timedOut = raw.question_ends_at && Date.parse(raw.question_ends_at) < Date.now();
  const { indexes } = resolveIndexes(question);
  const given = timedOut ? [] : normalizeAnswer(payload.answer);
  const correct = given.length > 0 && sameIndexSet(given, indexes);
  const answers = { ...((raw.answers ?? {}) as Record<string, number | number[]>) };
  if (payload.answer != null && !timedOut) answers[payload.questionId] = payload.answer;
  const nextIndex = Math.min(raw.current_index + 1, questions.length);
  let lives = raw.lives_left;
  if (paper.session.rules.lives != null && !correct) lives = Math.max(0, (lives ?? 0) - 1);
  const dead = paper.session.rules.lives != null && (lives ?? 0) <= 0;
  const finished = dead || nextIndex >= questions.length;
  const rules = paper.session.rules;
  const questionEndsAt =
    !finished && rules.perQuestionSeconds
      ? new Date(Date.now() + rules.perQuestionSeconds * 1000).toISOString()
      : null;
  await db
    .from("play_sessions")
    .update({
      answers,
      current_index: nextIndex,
      lives_left: lives,
      question_ends_at: questionEndsAt,
      status: finished ? (dead ? "game_over" : "in_progress") : "in_progress",
    })
    .eq("id", sessionId);
  if (finished) {
    return {
      finished: true as const,
      ...(await finishPlaySession(userId, sessionId, answers)),
      correct,
      indexes,
      livesLeft: lives,
    };
  }
  return {
    finished: false as const,
    correct,
    indexes,
    explanation: question.explanation ?? "",
    livesLeft: lives,
    nextIndex,
    questionEndsAt,
  };
}

export async function finishPlaySession(
  userId: string,
  sessionId: string,
  answersInput?: Record<string, number | number[]>,
) {
  const { data: session } = await db
    .from("play_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.user_id !== userId) throw new Error("Session not found.");
  if (session.status !== "in_progress" && session.status !== "game_over") {
    return summarisePlay(userId, sessionId);
  }
  const questions = await loadQuestionsByIds(session.question_ids);
  const answers = answersInput ?? ((session.answers ?? {}) as Record<string, number | number[]>);
  const kind = session.kind as PlayKind;
  const bank = attemptedQuestions(kind, questions, answers, session.current_index);
  const correctCount = gradeAll(bank, answers);
  const extra = (session.extra ?? {}) as { rules?: StoredPlayRules };
  const rules = mergePlayRules(kind, extra.rules, session.question_ids.length);
  const remaining = remainingSeconds(session.ends_at);
  const scored = playScore({
    correctCount,
    remainingSeconds: remaining,
    timeBonus: rules.timeBonus,
  });
  const started = Date.parse(session.started_at);
  const durationSeconds = Math.max(1, Math.round((Date.now() - started) / 1000));
  const status =
    session.status === "game_over" || (rules.lives != null && (session.lives_left ?? 1) <= 0)
      ? "game_over"
      : "submitted";
  await db
    .from("play_sessions")
    .update({
      status,
      answers,
      score: scored.score,
      correct_count: correctCount,
      duration_seconds: durationSeconds,
      time_bonus: scored.timeBonus,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  await updatePlayMastery(userId, bank, answers);
  let dailyStreak: number | undefined;
  if (kind === "daily") dailyStreak = await updateDailyStreak(userId);
  const xp = rules.xpCode ? await awardPlayXp(userId, rules.xpCode, rules.xpPoints, sessionId) : 0;
  let weeklyRank: number | null = null;
  if (kind === "weekly") weeklyRank = await weeklyRankFor(userId, session.instance_id);
  const badges = await awardPlayBadges(userId, kind, {
    ...(dailyStreak !== undefined ? { dailyStreak } : {}),
    weeklyRank,
    livesLeft: session.lives_left,
  });
  if (session.match_id) await maybeCompleteMatch(session.match_id);

  return summarisePlay(userId, sessionId, {
    xp,
    badges,
    weeklyRank,
    ...(dailyStreak !== undefined ? { dailyStreak } : {}),
  });
}

async function weeklyRankFor(userId: string, instanceId: string | null): Promise<number | null> {
  if (!instanceId) return null;
  const { data } = await db
    .from("play_sessions")
    .select("user_id, score, duration_seconds")
    .eq("instance_id", instanceId)
    .eq("status", "submitted");
  const best = new Map<string, { score: number; duration: number }>();
  for (const row of data ?? []) {
    const score = Number(row.score ?? 0);
    const duration = Number(row.duration_seconds ?? 0);
    const prev = best.get(row.user_id);
    if (!prev || score > prev.score || (score === prev.score && duration < prev.duration)) {
      best.set(row.user_id, { score, duration });
    }
  }
  const ordered = [...best.entries()].sort(
    (a, b) => b[1].score - a[1].score || a[1].duration - b[1].duration,
  );
  const rank = ordered.findIndex(([id]) => id === userId) + 1;
  return rank || null;
}

async function maybeCompleteMatch(matchId: string) {
  const { data: sessions } = await db
    .from("play_sessions")
    .select("user_id, score, duration_seconds, status")
    .eq("match_id", matchId)
    .in("status", ["submitted", "game_over"]);
  if ((sessions ?? []).length < 2) return;
  const ranked = [...(sessions ?? [])].sort(
    (a, b) =>
      Number(b.score ?? 0) - Number(a.score ?? 0) ||
      Number(a.duration_seconds ?? 0) - Number(b.duration_seconds ?? 0),
  );
  const winner = ranked[0]?.user_id ?? null;
  await db.from("play_matches").update({ status: "complete", winner_id: winner }).eq("id", matchId);
  const { data: tmatch } = await db
    .from("play_tournament_matches")
    .select("id, tournament_id, round, slot")
    .eq("match_id", matchId)
    .maybeSingle();
  if (tmatch && winner) {
    await db.from("play_tournament_matches").update({ winner_id: winner }).eq("id", tmatch.id);
    await advanceTournament(tmatch.tournament_id, tmatch.round, tmatch.slot, winner);
  }
}

async function advanceTournament(
  tournamentId: string,
  round: number,
  slot: number,
  winnerId: string,
) {
  const nextRound = round + 1;
  const nextSlot = Math.floor(slot / 2);
  const { data: next } = await db
    .from("play_tournament_matches")
    .select("id, player_a, player_b")
    .eq("tournament_id", tournamentId)
    .eq("round", nextRound)
    .eq("slot", nextSlot)
    .maybeSingle();
  if (!next) {
    await db.from("play_tournaments").update({ status: "complete" }).eq("id", tournamentId);
    return;
  }
  const patch = slot % 2 === 0 ? { player_a: winnerId } : { player_b: winnerId };
  await db.from("play_tournament_matches").update(patch).eq("id", next.id);
}

export async function summarisePlay(
  userId: string,
  sessionId: string,
  extras?: {
    xp?: number;
    badges?: Array<{ code: string; name: string; icon: string }>;
    dailyStreak?: number;
    weeklyRank?: number | null;
  },
) {
  const { data: session } = await db
    .from("play_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.user_id !== userId) throw new Error("Session not found.");
  const questions = await loadQuestionsByIds(session.question_ids);
  const answers = (session.answers ?? {}) as Record<string, number | number[]>;
  const kind = session.kind as PlayKind;
  const bank = attemptedQuestions(kind, questions, answers, session.current_index);
  const review = bank.map((q) => {
    const { indexes, multiSelect } = resolveIndexes(q);
    const given = normalizeAnswer(answers[q.id]);
    return {
      id: q.id,
      prompt: q.prompt,
      imageUrl: q.image_url ?? null,
      options: Array.isArray(q.options) ? (q.options as string[]) : [],
      correctIndexes: indexes,
      givenIndexes: given,
      multiSelect,
      explanation: q.explanation,
      topic: q.topic,
      subtopic: q.subtopic,
      correct: sameIndexSet(given, indexes),
    };
  });
  const domains = careerDomains(
    review.reduce<
      Array<{ topic: string; subtopic: string; mastery: number; answered: number; correct: number }>
    >((acc, item) => {
      acc.push({
        topic: item.topic,
        subtopic: item.subtopic,
        mastery: item.correct ? 100 : 0,
        answered: 1,
        correct: item.correct ? 1 : 0,
      });
      return acc;
    }, []),
  );
  return {
    sessionId,
    kind,
    status: session.status,
    score: session.score ?? 0,
    correctCount: session.correct_count ?? 0,
    questionCount: bank.length,
    bankSize: session.question_ids.length,
    durationSeconds: session.duration_seconds ?? 0,
    timeBonus: session.time_bonus ?? 0,
    livesLeft: session.lives_left,
    topic: session.topic,
    review,
    domains,
    rewardEligible: mergePlayRules(
      session.kind as PlayKind,
      parseStoredRules((session.extra as { rules?: unknown } | null)?.rules),
    ).reward,
    xp: extras?.xp ?? 0,
    badges: extras?.badges ?? [],
    dailyStreak: extras?.dailyStreak,
    weeklyRank: extras?.weeklyRank ?? null,
  };
}

export async function rollPlayReward(userId: string, sessionId: string, source: "box" | "wheel") {
  const { data: session } = await db
    .from("play_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.user_id !== userId) throw new Error("Session not found.");
  if (session.status === "in_progress") throw new Error("Finish the challenge first.");
  const { data: existing } = await db
    .from("play_rewards")
    .select("id")
    .eq("session_id", sessionId)
    .eq("source", source)
    .maybeSingle();
  if (existing) throw new Error("Already claimed.");
  if (
    !mergePlayRules(
      session.kind as PlayKind,
      parseStoredRules((session.extra as { rules?: unknown } | null)?.rules),
    ).reward
  ) {
    throw new Error("This mode has no bonus roll.");
  }
  const row = rollReward();
  const payload: Json = { code: row.code };
  if (row.code === "xp_50") await awardPlayXp(userId, "play_reward", 50, sessionId);
  if (row.code === "xp_100") await awardPlayXp(userId, "play_reward", 100, sessionId);
  if (row.code === "double_xp") await grantEntitlement(userId, "double_xp", 1, 24);
  if (row.code === "extra_life") await grantEntitlement(userId, "extra_life", 1);
  if (row.code === "mock_voucher") await grantEntitlement(userId, "mock_voucher", 1);
  if (row.code === "avatar") {
    const { data: owned } = await db
      .from("play_entitlements")
      .select("code")
      .eq("user_id", userId)
      .like("code", "avatar:%");
    const have = new Set((owned ?? []).map((item) => item.code.replace("avatar:", "")));
    const next =
      AVATAR_IDS_FALLBACK.find((id) => !have.has(id)) ??
      AVATAR_IDS_FALLBACK[hashSeed(`${userId}:${sessionId}`) % AVATAR_IDS_FALLBACK.length];
    if (next) {
      await grantEntitlement(userId, `avatar:${next}`, 1);
      (payload as Record<string, Json>)["avatarId"] = next;
    }
  }
  if (row.code === "badge") {
    const { data: catalog } = await db
      .from("badges")
      .select("id, code, name, icon, xp_reward")
      .eq("active", true);
    const { data: owned } = await db.from("user_badges").select("badge_id").eq("user_id", userId);
    const have = new Set((owned ?? []).map((b) => b.badge_id));
    const gift = (catalog ?? []).find((b) => !have.has(b.id));
    if (gift) {
      await db.from("user_badges").insert({ user_id: userId, badge_id: gift.id });
      (payload as Record<string, Json>)["badge"] = {
        code: gift.code,
        name: gift.name,
        icon: gift.icon,
      };
    }
  }
  await db.from("play_rewards").insert({
    user_id: userId,
    session_id: sessionId,
    source,
    code: row.code,
    label: row.label,
    payload,
  });
  return { code: row.code as RewardCode, label: row.label, payload };
}

export async function listPlayLeaderboard(args: {
  kind: PlayKind;
  topic?: string | null;
  periodKey?: string | null;
  team?: boolean;
  courseId?: string | null;
}) {
  const period = args.periodKey ?? periodKeyFor(args.kind);
  const { data: challenges } = await db
    .from("challenges")
    .select("id, course_id")
    .eq("kind", args.kind);
  let ids = (challenges ?? []).map((c) => c.id);
  if (args.courseId) {
    ids = challengeIdsForCourse(challenges ?? [], args.courseId);
  }
  if (ids.length === 0) return { period, rows: [] as const };
  let instances = db
    .from("challenge_instances")
    .select("id, challenge_id, period_key")
    .in("challenge_id", ids);
  if (PLAY_KIND_META_PERIOD(args.kind) !== "open") instances = instances.eq("period_key", period);
  const { data: inst } = await instances;
  const instanceIds = (inst ?? []).map((i) => i.id);
  if (instanceIds.length === 0) return { period, rows: [] as const };
  let query = db
    .from("play_sessions")
    .select(
      "user_id, score, duration_seconds, correct_count, topic, profiles(full_name, display_name, department, leaderboard_opt_out)",
    )
    .in("instance_id", instanceIds)
    .in("status", ["submitted", "game_over"]);
  if (args.topic) query = query.eq("topic", args.topic);
  const { data } = await query;
  if (args.team) {
    const teams = new Map<string, { score: number; n: number }>();
    for (const row of data ?? []) {
      const profile = row.profiles as unknown as { department: string | null } | null;
      const team = profile?.department?.trim() || "Unassigned";
      const cur = teams.get(team) ?? { score: 0, n: 0 };
      cur.score += Number(row.score ?? 0);
      cur.n += 1;
      teams.set(team, cur);
    }
    const rows = [...teams.entries()]
      .map(([name, v]) => ({ name, score: v.n ? Math.round(v.score / v.n) : 0, attempts: v.n }))
      .sort((a, b) => b.score - a.score)
      .map((row, i) => ({ rank: i + 1, ...row }));
    return { period, rows };
  }
  const best = new Map<
    string,
    { name: string; score: number; duration: number; optOut: boolean }
  >();
  for (const row of data ?? []) {
    const profile = row.profiles as unknown as {
      full_name: string;
      display_name: string | null;
      leaderboard_opt_out: boolean;
    } | null;
    const score = Number(row.score ?? 0);
    const duration = Number(row.duration_seconds ?? 0);
    const prev = best.get(row.user_id);
    if (!prev || score > prev.score || (score === prev.score && duration < prev.duration)) {
      best.set(row.user_id, {
        name: profile?.display_name || profile?.full_name || "Participant",
        score,
        duration,
        optOut: Boolean(profile?.leaderboard_opt_out),
      });
    }
  }
  const rows = [...best.entries()]
    .sort((a, b) => b[1].score - a[1].score || a[1].duration - b[1].duration)
    .slice(0, 50)
    .map(([id, row], i) => ({
      rank: i + 1,
      userId: id,
      name: row.optOut ? "Hidden" : row.name,
      score: row.score,
      durationSeconds: row.duration,
    }));
  return { period, rows };
}

function PLAY_KIND_META_PERIOD(kind: PlayKind) {
  return kind === "daily" ? "day" : kind === "weekly" || kind === "team" ? "week" : "open";
}

export async function listFlashCards(
  userId: string,
  poolId: string,
  topic?: string | null,
  courseId?: string | null,
) {
  await requirePlayMenu();
  if (!(await kindEnabled("flash"))) return { cards: [] as const };
  const { data: row } = await db
    .from("challenges")
    .select("pool_id, course_id, rules")
    .eq("kind", "flash")
    .eq("status", "active")
    .is("topic", null)
    .maybeSingle();
  const allowedTopics = allowedTopicsOf(parseStoredRules(row?.rules));
  if (row?.course_id && courseId && row.course_id !== courseId) {
    return { cards: [] as const };
  }
  const boundPool = row?.pool_id ?? poolId;
  let bank: PoolQ[] = [];
  try {
    bank = await loadPoolQuestions(boundPool, topic, allowedTopics);
  } catch {
    return { cards: [] as const };
  }
  if (courseId) {
    const { data: pool } = await db
      .from("question_pools")
      .select("course_id")
      .eq("id", boundPool)
      .maybeSingle();
    if (pool?.course_id && pool.course_id !== courseId) return { cards: [] as const };
  }
  const cards = bank.filter((q) => (q.explanation ?? "").trim().length > 0).slice(0, 40);
  if (cards.length === 0) return { cards: [] as const };
  const { data: progress } = await db
    .from("flash_progress")
    .select("question_id, known")
    .eq("user_id", userId)
    .in(
      "question_id",
      cards.map((c) => c.id),
    );
  const known = new Map((progress ?? []).map((p) => [p.question_id, p.known]));
  return {
    cards: cards.map((q) => ({
      id: q.id,
      front: q.prompt,
      back: q.explanation ?? "",
      topic: q.topic,
      known: known.get(q.id) ?? null,
    })),
  };
}

export async function markFlash(userId: string, questionId: string, known: boolean) {
  await db.from("flash_progress").upsert({
    user_id: userId,
    question_id: questionId,
    known,
    updated_at: new Date().toISOString(),
  });
  return { ok: true as const };
}

export async function inviteBattle(userId: string, email: string) {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes("@")) throw new Error("Enter a valid email.");
  const { data: invitee } = await db
    .from("profiles")
    .select("id, email")
    .eq("email", trimmed)
    .maybeSingle();
  const challenge = await ensureChallenge({ kind: "battle" });
  const { data, error } = await db
    .from("play_matches")
    .insert({
      challenge_id: challenge.id,
      inviter_id: userId,
      invitee_id: invitee?.id ?? null,
      invitee_email: trimmed,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (invitee?.id) {
    await notify(invitee.id, {
      kind: "play_battle",
      title: "Battle challenge",
      body: "Someone invited you to a 1v1 play battle.",
      href: "/play/battle",
      icon: "⚔️",
    });
  }
  return { matchId: data.id };
}

export async function acceptBattle(userId: string, matchId: string) {
  const { data: match } = await db.from("play_matches").select("*").eq("id", matchId).maybeSingle();
  if (!match) throw new Error("Battle not found.");
  const { data: me } = await db.from("profiles").select("email").eq("id", userId).single();
  const allowed = match.invitee_id === userId || match.invitee_email === me?.email;
  if (!allowed) throw new Error("This invite is not for you.");
  await db.from("play_matches").update({ invitee_id: userId, status: "ready" }).eq("id", matchId);
  return startPlaySession(userId, { kind: "battle", matchId });
}

export async function listCareerReadiness(userId: string) {
  const { data } = await db
    .from("topic_mastery")
    .select("topic, subtopic, mastery, total_count, correct_count")
    .eq("user_id", userId);
  const rows = (data ?? []).map((m) => ({
    topic: m.topic,
    subtopic: m.subtopic,
    mastery: Number(m.mastery),
    answered: m.total_count ?? 0,
    correct: m.correct_count ?? 0,
  }));
  return {
    overall: rows.length ? Math.round(rows.reduce((s, r) => s + r.mastery, 0) / rows.length) : 0,
    domains: careerDomains(rows),
    weakest: [...rows].sort((a, b) => a.mastery - b.mastery).slice(0, 2),
  };
}

export async function listEscapeScenarios(opts?: { all?: boolean }) {
  if (!opts?.all && !(await kindEnabled("escape"))) return [];
  let query = db.from("escape_scenarios").select("*");
  if (!opts?.all) query = query.eq("status", "active");
  const { data: scenarios } = await query.order("created_at", { ascending: false });
  const { data: scenes } = await db.from("escape_scenes").select("*").order("sort_order");
  return (scenarios ?? []).map((s) => ({
    ...s,
    scenes: (scenes ?? []).filter((sc) => sc.scenario_id === s.id),
  }));
}

export async function startEscapeScene(userId: string, scenarioId: string, sceneIndex: number) {
  if (!(await kindEnabled("escape"))) throw new Error("Escape Room is turned off.");
  const { data: scenes } = await db
    .from("escape_scenes")
    .select("*")
    .eq("scenario_id", scenarioId)
    .order("sort_order");
  const scene = scenes?.[sceneIndex];
  if (!scene) throw new Error("Scene not found.");
  const { data: scenario } = await db
    .from("escape_scenarios")
    .select("pool_id")
    .eq("id", scenarioId)
    .single();
  return startPlaySession(userId, {
    kind: "escape",
    ...(scenario?.pool_id != null ? { poolId: scenario.pool_id } : {}),
    topic: scene.topic,
    questionCount: scene.question_count,
    scenarioId,
    sceneIndex,
  });
}

async function bootstrapPlayKinds() {
  const { data: existing } = await db.from("challenges").select("kind, topic");
  const have = new Set((existing ?? []).filter((row) => !row.topic).map((row) => row.kind));
  for (const kind of PLAY_KINDS) {
    if (have.has(kind)) continue;
    const rules = defaultRulesFor(kind);
    const { error } = await db.from("challenges").insert({
      kind,
      name: PLAY_KIND_META[kind].label,
      rules: rulesJson(rules, null),
      status: "active",
    });
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      throw new Error(error.message);
    }
  }
}

export async function adminListPlay(userId: string) {
  await requireAdmin(userId);
  await bootstrapPlayKinds();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [
    { data: challengeRows },
    { data: sessionRows },
    { data: courses },
    { data: activities },
    inventory,
    scenarios,
    tournaments,
    { data: arenas },
  ] = await Promise.all([
    db.from("challenges").select("*").order("kind"),
    db.from("play_sessions").select("kind").gte("started_at", since),
    db.from("courses").select("id, name").eq("status", "active").order("name"),
    db.from("play_activities").select("id, name, status").order("name"),
    loadCatalogInventory(),
    listEscapeScenarios({ all: true }),
    db.from("play_tournaments").select("*").order("created_at", { ascending: false }),
    db
      .from("play_arenas")
      .select("id, name, activity_id, status, segment_count, questions_per_segment, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  const sessionCounts = new Map<string, number>();
  for (const row of sessionRows ?? []) {
    sessionCounts.set(row.kind, (sessionCounts.get(row.kind) ?? 0) + 1);
  }
  const globals = (challengeRows ?? []).filter((row) => !row.topic);
  const byKind = new Map(globals.map((row) => [row.kind, row]));
  const challenges = PLAY_KINDS.map((kind) => {
    const row = byKind.get(kind);
    const stored = parseStoredRules(row?.rules);
    const rules = mergePlayRules(kind, stored);
    return {
      id: row?.id ?? "",
      kind,
      name: row?.name ?? PLAY_KIND_META[kind].label,
      courseId: row?.course_id ?? null,
      activityId: row?.activity_id ?? null,
      poolId: row?.pool_id ?? null,
      topic: row?.topic ?? null,
      status: (row?.status ?? "active") as "active" | "inactive",
      rules,
      allowedTopics: allowedTopicsOf(stored),
      segmentCount: stored?.segmentCount ?? (kind === "arena" ? 3 : null),
      questionsPerSegment: stored?.questionsPerSegment ?? (kind === "arena" ? 4 : null),
      correctMarks: stored?.correctMarks ?? (kind === "arena" ? 2 : null),
      wrongMarks: stored?.wrongMarks ?? (kind === "arena" ? 1 : null),
      sessions7d: sessionCounts.get(kind) ?? 0,
    };
  });
  return {
    menuEnabled: await playMenuEnabled(),
    challenges,
    courses: courses ?? [],
    activities: activities ?? [],
    pools: inventory,
    scenarios,
    tournaments: tournaments.data ?? [],
    arenas: arenas ?? [],
  };
}

async function notifyPlayAudience(payload: {
  kind: string;
  title: string;
  body: string;
  icon: string;
}) {
  try {
    const { data: people } = await db.from("profiles").select("id");
    await notifyMany(
      (people ?? []).map((row) => row.id),
      payload,
    );
  } catch (error) {
    console.error("[notifyPlayAudience] failed:", error);
  }
}

function playKindNotice(kind: PlayKind) {
  const meta = PLAY_KIND_META[kind];
  const icons: Record<PlayKind, string> = {
    topic: "🎯",
    daily: "📅",
    weekly: "📆",
    speed: "⚡",
    survival: "❤️",
    marathon: "🏃",
    flash: "🃏",
    rapid: "🔥",
    battle: "⚔️",
    team: "👥",
    knockout: "🏆",
    escape: "🚪",
    arena: "🏟️",
  };
  const kinds: Record<PlayKind, string> = {
    topic: "play_topics",
    daily: "play_mode",
    weekly: "play_mode",
    speed: "play_mode",
    survival: "play_mode",
    marathon: "play_mode",
    flash: "play_flash",
    rapid: "play_mode",
    battle: "play_battle",
    team: "play_team",
    knockout: "play_tournament",
    escape: "play_escape",
    arena: "play_arena",
  };
  return {
    kind: kinds[kind],
    title: `${meta.label} is on`,
    body: `${meta.blurb} Open Play to join.`,
    icon: icons[kind],
  };
}

export async function adminUpsertChallenge(
  userId: string,
  payload: {
    id?: string;
    kind: PlayKind;
    name: string;
    status: "active" | "inactive";
    courseId: string | null;
    activityId: string | null;
    poolId: string | null;
    allowedTopics: string[] | null;
    rules: StoredPlayRules;
  },
) {
  await requireAdmin(userId);
  await bootstrapPlayKinds();
  const previous = payload.id
    ? (await db.from("challenges").select("status").eq("id", payload.id).maybeSingle()).data?.status
    : (
        await db
          .from("challenges")
          .select("status")
          .eq("kind", payload.kind)
          .is("topic", null)
          .limit(1)
          .maybeSingle()
      ).data?.status;
  const rules = mergePlayRules(payload.kind, payload.rules);
  const stored = rulesJson(rules, payload.allowedTopics, payload.rules);
  const patch = {
    name: payload.name,
    course_id: payload.courseId,
    activity_id: payload.activityId,
    pool_id: payload.poolId,
    topic: null as string | null,
    rules: stored,
    status: payload.status,
    updated_at: new Date().toISOString(),
  };
  if (payload.id) {
    const { error } = await db
      .from("challenges")
      .update(patch)
      .eq("id", payload.id)
      .eq("kind", payload.kind);
    if (error) throw new Error(error.message);
    if (payload.status === "active" && previous !== "active") {
      await notifyPlayAudience(playKindNotice(payload.kind));
    }
    return { id: payload.id };
  }
  const { data: existing } = await db
    .from("challenges")
    .select("id")
    .eq("kind", payload.kind)
    .is("topic", null)
    .limit(1)
    .maybeSingle();
  if (existing) {
    const { error } = await db.from("challenges").update(patch).eq("id", existing.id);
    if (error) throw new Error(error.message);
    if (payload.status === "active" && previous !== "active") {
      await notifyPlayAudience(playKindNotice(payload.kind));
    }
    return { id: existing.id };
  }
  const { data, error } = await db
    .from("challenges")
    .insert({ kind: payload.kind, ...patch })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (payload.status === "active" && previous !== "active") {
    await notifyPlayAudience(playKindNotice(payload.kind));
  }
  return { id: data.id };
}

export async function adminSetKindStatus(
  userId: string,
  kind: PlayKind,
  status: "active" | "inactive",
) {
  await requireAdmin(userId);
  await bootstrapPlayKinds();
  const { data: current } = await db
    .from("challenges")
    .select("status")
    .eq("kind", kind)
    .is("topic", null);
  const wasActive = (current ?? []).some((row) => row.status === "active");
  const { error } = await db
    .from("challenges")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("kind", kind)
    .is("topic", null);
  if (error) throw new Error(error.message);
  if (status === "active" && !wasActive) {
    await notifyPlayAudience(playKindNotice(kind));
  }
  return { ok: true as const };
}

export async function adminSetPlayMenu(userId: string, menuEnabled: boolean) {
  await requireAdmin(userId);
  const wasOn = await playMenuEnabled();
  const { error } = await db.from("play_settings").upsert({
    id: "default",
    menu_enabled: menuEnabled,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  if (menuEnabled && !wasOn) {
    await notifyPlayAudience({
      kind: "play_launched",
      title: "Play is live",
      body: "Daily challenges, flash cards, survival and more are ready. Open Play to start.",
      icon: "🎮",
    });
  }
  return { menuEnabled };
}

export async function adminSetEscapeStatus(
  userId: string,
  scenarioId: string,
  status: "active" | "inactive",
) {
  await requireAdmin(userId);
  const { data: previous } = await db
    .from("escape_scenarios")
    .select("status, name")
    .eq("id", scenarioId)
    .maybeSingle();
  const { error } = await db
    .from("escape_scenarios")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", scenarioId);
  if (error) throw new Error(error.message);
  if (status === "active" && previous?.status !== "active") {
    await notifyPlayAudience({
      kind: "play_escape",
      title: `${previous?.name ?? "Escape room"} is live`,
      body: "A new escape scene is ready. Open Play to start.",
      icon: "🚪",
    });
  }
  return { ok: true as const };
}

export async function adminSaveEscape(
  userId: string,
  payload: {
    id?: string;
    name: string;
    intro: string;
    poolId?: string | null;
    courseId?: string | null;
    status?: "active" | "inactive";
    scenes: Array<{ title: string; body: string; topic: string; questionCount: number }>;
  },
) {
  await requireAdmin(userId);
  let id = payload.id;
  const status = payload.status ?? "active";
  const courseId = payload.courseId ?? null;
  const poolId = payload.poolId ?? null;
  let previousStatus: string | null = null;
  if (id) {
    const { data: existing } = await db
      .from("escape_scenarios")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    previousStatus = existing?.status ?? null;
    await db
      .from("escape_scenarios")
      .update({
        name: payload.name,
        intro: payload.intro,
        pool_id: poolId,
        course_id: courseId,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    await db.from("escape_scenes").delete().eq("scenario_id", id);
  } else {
    const { data, error } = await db
      .from("escape_scenarios")
      .insert({
        name: payload.name,
        intro: payload.intro,
        pool_id: poolId,
        course_id: courseId,
        status,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    id = data.id;
  }
  if (payload.scenes.length) {
    await db.from("escape_scenes").insert(
      payload.scenes.map((scene, i) => ({
        scenario_id: id,
        sort_order: i,
        title: scene.title,
        body: scene.body,
        topic: scene.topic,
        question_count: scene.questionCount,
      })),
    );
  }
  if (status === "active" && previousStatus !== "active") {
    await notifyPlayAudience({
      kind: "play_escape",
      title: `${payload.name} is live`,
      body: "A new escape scene is ready. Open Play to start.",
      icon: "🚪",
    });
  }
  return { id };
}

export async function adminCreateTournament(
  userId: string,
  payload: { name: string; size: 4 | 8 | 16 | 32; poolId?: string | null },
) {
  await requireAdmin(userId);
  const { data, error } = await db
    .from("play_tournaments")
    .insert({
      name: payload.name,
      size: payload.size,
      pool_id: payload.poolId ?? null,
      created_by: userId,
      status: "open",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await notifyPlayAudience({
    kind: "play_tournament",
    title: `${payload.name} is open`,
    body: `A ${payload.size}-player knockout is open. Join from Play before it starts.`,
    icon: "🏆",
  });
  return data;
}

export async function joinTournament(userId: string, tournamentId: string) {
  const { data: t } = await db
    .from("play_tournaments")
    .select("*")
    .eq("id", tournamentId)
    .maybeSingle();
  if (!t || t.status !== "open") throw new Error("Tournament is not open.");
  const { count } = await db
    .from("play_tournament_entrants")
    .select("user_id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);
  if ((count ?? 0) >= t.size) throw new Error("Tournament is full.");
  await db
    .from("play_tournament_entrants")
    .upsert({ tournament_id: tournamentId, user_id: userId });
  return { ok: true as const };
}

export async function adminStartTournament(userId: string, tournamentId: string) {
  await requireAdmin(userId);
  const { data: t } = await db.from("play_tournaments").select("*").eq("id", tournamentId).single();
  if (!t) throw new Error("Tournament not found.");
  const { data: entrants } = await db
    .from("play_tournament_entrants")
    .select("user_id")
    .eq("tournament_id", tournamentId);
  const players = (entrants ?? []).map((e) => e.user_id);
  if (players.length < 2) throw new Error("Need at least two players.");
  const size = t.size;
  const padded = [...players];
  while (padded.length < size) padded.push(padded[padded.length - 1]!);
  const rounds = Math.log2(size);
  await db.from("play_tournament_matches").delete().eq("tournament_id", tournamentId);
  const challenge = await ensureChallenge({ kind: "knockout", poolId: t.pool_id });
  for (let round = 0; round < rounds; round++) {
    const slots = size / 2 ** (round + 1);
    for (let slot = 0; slot < slots; slot++) {
      const a = round === 0 ? (padded[slot * 2] ?? null) : null;
      const b = round === 0 ? (padded[slot * 2 + 1] ?? null) : null;
      let matchId: string | null = null;
      if (round === 0 && a && b) {
        const { data: match } = await db
          .from("play_matches")
          .insert({ challenge_id: challenge.id, inviter_id: a, invitee_id: b, status: "ready" })
          .select("id")
          .single();
        matchId = match?.id ?? null;
      }
      await db.from("play_tournament_matches").insert({
        tournament_id: tournamentId,
        round,
        slot,
        player_a: a,
        player_b: b,
        match_id: matchId,
      });
    }
  }
  await db.from("play_tournaments").update({ status: "active" }).eq("id", tournamentId);
  await notifyPlayAudience({
    kind: "play_tournament",
    title: `${t.name} has started`,
    body: "The knockout bracket is live. Open Play to follow the matches.",
    icon: "🏆",
  });
  return { ok: true as const };
}

export async function getTournament(tournamentId: string) {
  const [{ data: t }, { data: entrants }, { data: matches }] = await Promise.all([
    db.from("play_tournaments").select("*").eq("id", tournamentId).maybeSingle(),
    db
      .from("play_tournament_entrants")
      .select("user_id, profiles(full_name)")
      .eq("tournament_id", tournamentId),
    db
      .from("play_tournament_matches")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("round")
      .order("slot"),
  ]);
  if (!t) throw new Error("Tournament not found.");
  return { tournament: t, entrants: entrants ?? [], matches: matches ?? [] };
}

export async function startKnockoutMatch(userId: string, matchId: string) {
  return startPlaySession(userId, { kind: "knockout", matchId });
}
