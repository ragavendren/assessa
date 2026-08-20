/**
 * Live Arena: hosted timed team quiz. Server-only.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  arenaQuestionMarks,
  arenaSegmentOf,
  arenaTotalQuestions,
  autoLockIfExpired,
  buildArenaBoard,
  canPublishArenaSegment,
  coerceAnswerBonuses,
  isArenaKeyVisible,
  isArenaQuestionVisible,
  pickArenaWinner,
  pickExclusiveFirstLockWinner,
  remainingMsAt,
  rankDeltaBetween,
  standingsThroughQuestion,
} from "@/lib/play.arena";
import { pickWithSeed, sameIndexSet } from "@/lib/play.math";
import { notifyMany, requireAdmin } from "@/lib/platform.server";

const db = supabaseAdmin;

type ArenaStatus = "draft" | "lobby" | "question" | "locked" | "revealed" | "complete";

async function notifyEveryone(payload: {
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
    console.error("[arena notify] failed:", error);
  }
}

async function loadArena(arenaId: string) {
  const { data, error } = await db.from("play_arenas").select("*").eq("id", arenaId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Arena not found.");
  return data;
}

async function syncLock(arena: Awaited<ReturnType<typeof loadArena>>) {
  if (!autoLockIfExpired(arena.status, arena.question_ends_at)) return arena;
  const { data, error } = await db
    .from("play_arenas")
    .update({ status: "locked", updated_at: new Date().toISOString() })
    .eq("id", arena.id)
    .eq("status", "question")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? { ...arena, status: "locked" };
}

function parseOptions(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map((item) => String(item)) : [];
}

function memberCounts(rows: Array<{ team_id: string }> | null) {
  const map = new Map<string, number>();
  for (const row of rows ?? []) {
    map.set(row.team_id, (map.get(row.team_id) ?? 0) + 1);
  }
  return map;
}

function withMemberNames<T extends { id: string }>(
  rows: T[],
  participants: Array<{ teamId: string; name: string }>,
): Array<T & { memberNames: string[] }> {
  const byTeam = new Map<string, string[]>();
  for (const person of participants) {
    const list = byTeam.get(person.teamId) ?? [];
    list.push(person.name);
    byTeam.set(person.teamId, list);
  }
  for (const list of byTeam.values()) list.sort((a, b) => a.localeCompare(b));
  return rows.map((row) => ({
    ...row,
    memberNames: byTeam.get(row.id) ?? [],
  }));
}

function arenaBoard(
  arena: Awaited<ReturnType<typeof loadArena>>,
  teams: Array<{
    id: string;
    name: string;
    score: number;
    correct_count: number;
    wrong_count: number;
  }>,
  answers: Array<{
    team_id: string;
    question_index: number;
    marks: number;
    correct: boolean | null;
    time_bonus?: number | null;
    early_lock_bonus?: number | null;
    lock_latency_ms?: number | null;
  }>,
  members: Array<{ team_id: string }> | null,
) {
  const counts = memberCounts(members);
  const correctMarks = arena.correct_marks ?? 0;
  const earlyLockBonusMax = arena.early_lock_bonus ?? 0;
  return buildArenaBoard({
    teams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      score: team.score,
      correctCount: team.correct_count,
      wrongCount: team.wrong_count,
      members: counts.get(team.id) ?? 0,
    })),
    answers: answers.map((row) => {
      const coerced = coerceAnswerBonuses({
        correct: row.correct,
        marks: row.marks ?? 0,
        timeBonus: row.time_bonus ?? 0,
        earlyLockBonus: row.early_lock_bonus ?? 0,
        correctMarks,
        earlyLockBonusMax,
      });
      return {
        teamId: row.team_id,
        questionIndex: row.question_index,
        marks: row.marks,
        correct: row.correct,
        timeBonus: coerced.timeBonus,
        earlyLockBonus: coerced.earlyLockBonus,
        lockLatencyMs: row.lock_latency_ms ?? null,
      };
    }),
    currentIndex: arena.current_index,
    status: arena.status,
    questionsPerSegment: arena.questions_per_segment,
    segmentCount: arena.segment_count,
    publishedThroughSegment: arena.published_through_segment ?? -1,
  });
}

async function syncTeamTotals(arenaId: string) {
  const [{ data: teams, error: teamError }, { data: answers, error: answerError }] =
    await Promise.all([
      db.from("play_arena_teams").select("id").eq("arena_id", arenaId),
      db.from("play_arena_answers").select("team_id, marks, correct").eq("arena_id", arenaId),
    ]);
  if (teamError) throw new Error(teamError.message);
  if (answerError) throw new Error(answerError.message);
  const totals = new Map<string, { score: number; correctCount: number; wrongCount: number }>();
  for (const team of teams ?? []) {
    totals.set(team.id, { score: 0, correctCount: 0, wrongCount: 0 });
  }
  for (const row of answers ?? []) {
    const current = totals.get(row.team_id) ?? { score: 0, correctCount: 0, wrongCount: 0 };
    current.score += row.marks;
    if (row.correct === true) current.correctCount += 1;
    if (row.correct === false) current.wrongCount += 1;
    totals.set(row.team_id, current);
  }
  for (const [id, row] of totals) {
    const { error } = await db
      .from("play_arena_teams")
      .update({
        score: row.score,
        correct_count: row.correctCount,
        wrong_count: row.wrongCount,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }
}

export async function adminListActivities(userId: string) {
  await requireAdmin(userId);
  const { data, error } = await db.from("play_activities").select("*").order("name");
  if (error) throw new Error(error.message);
  return { activities: data ?? [] };
}

export async function adminUpsertActivity(
  userId: string,
  payload: { id?: string; name: string; status?: "active" | "inactive" },
) {
  await requireAdmin(userId);
  const status = payload.status ?? "active";
  if (payload.id) {
    const { data, error } = await db
      .from("play_activities")
      .update({ name: payload.name, status, updated_at: new Date().toISOString() })
      .eq("id", payload.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }
  const { data, error } = await db
    .from("play_activities")
    .insert({ name: payload.name, status })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function adminDeleteActivity(userId: string, id: string) {
  await requireAdmin(userId);
  const { error } = await db.from("play_activities").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function adminCreateArena(
  userId: string,
  payload: {
    name: string;
    activityId?: string | null;
    poolId: string;
    courseId?: string | null;
    blueprintId?: string | null;
    avoidRepeats?: boolean;
    segmentCount: number;
    questionsPerSegment: number;
    perQuestionSeconds: number;
    correctMarks: number;
    wrongMarks: number;
    timeBonusMax?: number;
    earlyLockBonus?: number;
    teamCount?: number | null;
    teamNames?: string[];
    allowOpenTeams?: boolean;
  },
) {
  await requireAdmin(userId);
  const total = arenaTotalQuestions(payload.segmentCount, payload.questionsPerSegment);
  const avoidRepeats = payload.avoidRepeats !== false;
  const courseId = payload.courseId ?? null;
  const blueprintId = payload.blueprintId ?? null;

  const { data: poolMeta, error: poolMetaError } = await db
    .from("question_pools")
    .select("id, course_id")
    .eq("id", payload.poolId)
    .maybeSingle();
  if (poolMetaError) throw new Error(poolMetaError.message);
  if (!poolMeta) throw new Error("Question pool not found.");
  const resolvedCourseId = courseId ?? poolMeta.course_id ?? null;

  let usedIds = new Set<string>();
  if (avoidRepeats) {
    const { data: priorArenas, error: priorError } = await db
      .from("play_arenas")
      .select("id")
      .eq("pool_id", payload.poolId);
    if (priorError) throw new Error(priorError.message);
    const arenaIds = (priorArenas ?? []).map((row) => row.id);
    if (arenaIds.length > 0) {
      const { data: usedRows, error: usedError } = await db
        .from("play_arena_questions")
        .select("source_question_id")
        .in("arena_id", arenaIds)
        .not("source_question_id", "is", null);
      if (usedError) throw new Error(usedError.message);
      usedIds = new Set(
        (usedRows ?? [])
          .map((row) => row.source_question_id)
          .filter((id): id is string => Boolean(id)),
      );
    }
  }

  let picked: Array<{
    id: string;
    prompt: string;
    image_url: string | null;
    options: unknown;
    correct_indexes: number[] | null;
    multi_select: boolean | null;
    explanation: string | null;
  }> = [];

  if (blueprintId) {
    if (!resolvedCourseId) {
      throw new Error("Pick a pool with a course before using a blueprint.");
    }
    const { previewOrSelectQuestions } = await import("@/lib/question-selection.server");
    const result = await previewOrSelectQuestions(db, {
      poolId: payload.poolId,
      blueprintId,
      courseId: resolvedCourseId,
      questionCount: total,
      reusePolicy: avoidRepeats ? "no_reuse_course" : "allow_reuse",
      allowPreviouslyUsed: !avoidRepeats,
    });
    if (!result.ok) {
      const detail = result.shortages
        .map((row) => `${row.topic}: need ${row.required}, have ${row.available}`)
        .join("; ");
      throw new Error(`Blueprint cannot fill this arena (${detail || "shortage"}).`);
    }
    // Also drop arena-used ids if avoidRepeats (exam exclusion may not cover arenas)
    const idSet = new Set(result.selectedPoolQuestionIds.filter((id) => !usedIds.has(id)));
    if (idSet.size < total && avoidRepeats) {
      throw new Error(
        `Not enough unused blueprint questions after excluding prior arenas (need ${total}, have ${idSet.size}).`,
      );
    }
    const orderedIds = result.selectedPoolQuestionIds.filter((id) => idSet.has(id)).slice(0, total);
    const { data: selectedRows, error: selectedError } = await db
      .from("pool_questions")
      .select("id, prompt, image_url, options, correct_indexes, multi_select, explanation")
      .in("id", orderedIds);
    if (selectedError) throw new Error(selectedError.message);
    const byId = new Map((selectedRows ?? []).map((row) => [row.id, row]));
    picked = orderedIds
      .map((id) => byId.get(id))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  } else {
    const { data: poolQs, error: qError } = await db
      .from("pool_questions")
      .select("id, prompt, image_url, options, correct_indexes, multi_select, explanation, status")
      .eq("pool_id", payload.poolId)
      .eq("status", "active");
    if (qError) throw new Error(qError.message);
    const eligible = (poolQs ?? []).filter(
      (row) => parseOptions(row.options).length >= 2 && (!avoidRepeats || !usedIds.has(row.id)),
    );
    if (eligible.length < total) {
      throw new Error(
        avoidRepeats
          ? `Need at least ${total} unused active pool questions (have ${eligible.length}). Turn off “Avoid repeats” or add more questions.`
          : `Need at least ${total} active pool questions for this arena.`,
      );
    }
    picked = pickWithSeed(eligible, total, `${payload.name}:${Date.now()}`);
  }

  if (picked.length < total) {
    throw new Error(`Could only select ${picked.length} of ${total} questions.`);
  }

  const teamCount = payload.teamCount != null && payload.teamCount > 0 ? payload.teamCount : 0;
  if (teamCount > 32) throw new Error("Precreate at most 32 teams.");
  const allowOpenTeams = payload.allowOpenTeams !== false;
  const { data: arena, error } = await db
    .from("play_arenas")
    .insert({
      name: payload.name,
      activity_id: payload.activityId ?? null,
      course_id: resolvedCourseId,
      pool_id: payload.poolId,
      blueprint_id: blueprintId,
      avoid_repeats: avoidRepeats,
      status: "lobby",
      listed: false,
      segment_count: payload.segmentCount,
      questions_per_segment: payload.questionsPerSegment,
      per_question_seconds: payload.perQuestionSeconds,
      correct_marks: payload.correctMarks,
      wrong_marks: payload.wrongMarks,
      time_bonus_max: payload.timeBonusMax ?? 0,
      early_lock_bonus: payload.earlyLockBonus ?? 0,
      allow_open_teams: allowOpenTeams,
      created_by: userId,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const rows = picked.map((q, index) => {
    const loc = arenaSegmentOf(index, payload.questionsPerSegment);
    const indexes = Array.isArray(q.correct_indexes) ? q.correct_indexes : [0];
    return {
      arena_id: arena.id,
      sort_order: index,
      segment_index: loc.segment,
      prompt: q.prompt,
      image_url: q.image_url,
      options: q.options,
      correct_indexes: indexes,
      multi_select: Boolean(q.multi_select) || indexes.length > 1,
      explanation: q.explanation ?? "",
      source_question_id: q.id,
    };
  });
  const { error: insertQ } = await db.from("play_arena_questions").insert(rows);
  if (insertQ) throw new Error(insertQ.message);

  if (teamCount > 0) {
    const { defaultTeamNames } = await import("@/lib/presence");
    const names = defaultTeamNames(teamCount, payload.teamNames);
    const { error: teamError } = await db.from("play_arena_teams").insert(
      names.map((name) => ({
        arena_id: arena.id,
        name,
        created_by: userId,
      })),
    );
    if (teamError) throw new Error(teamError.message);
  }

  await notifyEveryone({
    kind: "play_arena",
    title: `${payload.name} lobby is open`,
    body:
      teamCount > 0
        ? "Join a Live Arena team from Play."
        : "Pick a team name and join Live Arena from Play.",
    icon: "🏟️",
  });
  return { id: arena.id };
}

export async function listOpenArenas(filters?: {
  activityId?: string | null;
  courseId?: string | null;
}) {
  let query = db
    .from("play_arenas")
    .select(
      "id, name, activity_id, course_id, status, listed, segment_count, questions_per_segment, per_question_seconds, courses(name)",
    )
    .eq("listed", true)
    .in("status", ["lobby", "question", "locked", "revealed", "complete"]);
  if (filters?.activityId) query = query.eq("activity_id", filters.activityId);
  if (filters?.courseId) query = query.eq("course_id", filters.courseId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return {
    arenas: (data ?? []).map((row) => {
      const course = row.courses as unknown as { name: string } | null;
      return {
        id: row.id,
        name: row.name,
        activity_id: row.activity_id,
        course_id: row.course_id,
        courseName: course?.name ?? null,
        status: row.status,
        segment_count: row.segment_count,
        questions_per_segment: row.questions_per_segment,
        per_question_seconds: row.per_question_seconds,
      };
    }),
  };
}

export async function joinArena(
  userId: string,
  payload: { arenaId: string; teamName?: string; teamId?: string },
) {
  const { data: menu } = await db
    .from("play_settings")
    .select("menu_enabled")
    .eq("id", "default")
    .maybeSingle();
  if (menu?.menu_enabled === false) throw new Error("Play is turned off.");
  const arena = await loadArena(payload.arenaId);
  if (arena.status === "draft") throw new Error("This arena is not open yet.");

  const { data: existing } = await db
    .from("play_arena_members")
    .select("team_id")
    .eq("arena_id", arena.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return { teamId: existing.team_id };
  if (arena.status === "complete") {
    throw new Error("This arena has finished. Open the link to view the scoreboard.");
  }

  let teamId = payload.teamId ?? null;
  if (teamId) {
    const { data: team } = await db
      .from("play_arena_teams")
      .select("id")
      .eq("id", teamId)
      .eq("arena_id", arena.id)
      .maybeSingle();
    if (!team) throw new Error("Team not found.");
  } else {
    const name = (payload.teamName ?? "").trim();
    if (name.length < 2) throw new Error("Choose a team name (at least 2 characters).");
    const { data: clash } = await db
      .from("play_arena_teams")
      .select("id")
      .eq("arena_id", arena.id)
      .ilike("name", name)
      .maybeSingle();
    if (clash) {
      teamId = clash.id;
    } else {
      if (arena.allow_open_teams === false) {
        throw new Error("This arena only allows the precreated teams. Join one of those.");
      }
      const { data: created, error } = await db
        .from("play_arena_teams")
        .insert({ arena_id: arena.id, name, created_by: userId })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      teamId = created.id;
    }
  }

  const { error: memberError } = await db.from("play_arena_members").insert({
    arena_id: arena.id,
    team_id: teamId,
    user_id: userId,
  });
  if (memberError) throw new Error(memberError.message);
  return { teamId };
}

async function memberTeam(arenaId: string, userId: string) {
  const { data } = await db
    .from("play_arena_members")
    .select("team_id")
    .eq("arena_id", arenaId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.team_id ?? null;
}

export async function submitArenaAnswer(
  userId: string,
  payload: { arenaId: string; answer: number[] },
) {
  const arena = await syncLock(await loadArena(payload.arenaId));
  if (arena.status !== "question") throw new Error("Answering is closed for this question.");
  const teamId = await memberTeam(arena.id, userId);
  if (!teamId) throw new Error("Join a team first.");
  const indexes = [...new Set(payload.answer.filter((n) => Number.isInteger(n) && n >= 0))];
  if (indexes.length === 0) throw new Error("Pick at least one option before locking.");

  const { data, error } = await db.rpc("play_arena_lock_answer", {
    p_arena_id: arena.id,
    p_team_id: teamId,
    p_question_index: arena.current_index,
    p_answer_indexes: indexes,
    p_client_locked_at: null,
  });
  if (error) throw new Error(error.message);
  const result = (data ?? {}) as {
    ok?: boolean;
    modified?: boolean;
    firstLockedAt?: string;
    submittedAt?: string;
    lockLatencyMs?: number | null;
  };
  return {
    ok: true as const,
    modified: Boolean(result.modified),
    firstLockedAt: result.firstLockedAt ?? null,
    lockLatencyMs: result.lockLatencyMs ?? null,
  };
}

export async function getArenaPlayerState(userId: string, arenaId: string) {
  const arena = await syncLock(await loadArena(arenaId));
  const teamId = await memberTeam(arena.id, userId);
  const [
    { data: questions },
    { data: teams },
    { data: members },
    { data: answers },
    { data: myAnswer },
  ] = await Promise.all([
    db
      .from("play_arena_questions")
      .select(
        "sort_order, segment_index, prompt, image_url, options, multi_select, correct_indexes, explanation",
      )
      .eq("arena_id", arena.id)
      .order("sort_order"),
    db
      .from("play_arena_teams")
      .select("id, name, score, correct_count, wrong_count")
      .eq("arena_id", arena.id),
    db.from("play_arena_members").select("team_id, user_id").eq("arena_id", arena.id),
    db
      .from("play_arena_answers")
      .select("team_id, question_index, marks, correct, time_bonus, early_lock_bonus")
      .eq("arena_id", arena.id),
    teamId
      ? db
          .from("play_arena_answers")
          .select("answer_indexes, correct, marks, first_locked_at, time_bonus, early_lock_bonus")
          .eq("arena_id", arena.id)
          .eq("team_id", teamId)
          .eq("question_index", arena.current_index)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const memberUserIds = [...new Set((members ?? []).map((row) => row.user_id))];
  const { data: memberProfiles } =
    memberUserIds.length > 0
      ? await db
          .from("profiles")
          .select("id, full_name, display_name, email")
          .in("id", memberUserIds)
      : {
          data: [] as Array<{
            id: string;
            full_name: string | null;
            display_name: string | null;
            email: string | null;
          }>,
        };
  const profileById = new Map((memberProfiles ?? []).map((row) => [row.id, row]));
  const namedParticipants = (members ?? []).map((row) => {
    const profile = profileById.get(row.user_id);
    return {
      teamId: row.team_id,
      name: profile?.display_name || profile?.full_name || profile?.email || "Participant",
    };
  });

  const q = (questions ?? [])[arena.current_index] ?? null;
  const questionLive = isArenaQuestionVisible(arena.status);
  const revealed = arena.status === "revealed";
  const overallVisible = arena.status === "complete";
  const showResult = revealed || overallVisible;
  const myTeam = (teams ?? []).find((t) => t.id === teamId) ?? null;
  const board = arenaBoard(arena, teams ?? [], answers ?? [], members ?? []);
  const myRow = myTeam ? board.rows.find((row) => row.id === myTeam.id) : null;
  const boardRows = withMemberNames(board.rows, namedParticipants);
  const segmentRows = withMemberNames(board.segmentRows, namedParticipants);

  return {
    arena: {
      id: arena.id,
      name: arena.name,
      status: arena.status as ArenaStatus,
      segmentCount: arena.segment_count,
      questionsPerSegment: arena.questions_per_segment,
      perQuestionSeconds: arena.per_question_seconds,
      currentIndex: arena.current_index,
      questionEndsAt: arena.question_ends_at,
      totalQuestions: questions?.length ?? 0,
      publishedThroughSegment: arena.published_through_segment ?? -1,
      allowOpenTeams: arena.allow_open_teams !== false,
      correctMarks: arena.correct_marks,
      wrongMarks: arena.wrong_marks,
      timeBonusMax: arena.time_bonus_max ?? 0,
      earlyLockBonus: arena.early_lock_bonus ?? 0,
    },
    teams: (teams ?? []).map((t) => ({ id: t.id, name: t.name })),
    myTeam: myTeam
      ? {
          id: myTeam.id,
          name: myTeam.name,
          score: myTeam.score,
          correctCount: myTeam.correct_count,
          wrongCount: myTeam.wrong_count,
          rank: overallVisible ? (myRow?.rank ?? null) : null,
        }
      : null,
    question:
      q && questionLive
        ? {
            prompt: q.prompt,
            imageUrl: q.image_url,
            options: parseOptions(q.options),
            multiSelect: q.multi_select,
            segment: q.segment_index,
            offset: arenaSegmentOf(q.sort_order, arena.questions_per_segment).offset,
            ...(revealed ? { correctIndexes: q.correct_indexes, explanation: q.explanation } : {}),
          }
        : null,
    myAnswer: myAnswer?.answer_indexes ?? [],
    myResult:
      showResult && myAnswer
        ? {
            correct: myAnswer.correct,
            marks: myAnswer.marks,
            timeBonus: myAnswer.time_bonus ?? 0,
            earlyLockBonus: myAnswer.early_lock_bonus ?? 0,
          }
        : null,
    board: {
      overallVisible,
      segmentVisible: board.publishedSegment != null,
      publishedSegment: board.publishedSegment,
      rows: overallVisible ? boardRows : [],
      segmentRows,
      publishedSegmentBoards: board.publishedSegmentBoards.map((seg) => ({
        ...seg,
        rows: withMemberNames(seg.rows, namedParticipants),
      })),
      segmentWinners: board.segmentWinners,
      currentSegmentWinner: board.currentSegmentWinner,
      champion: board.champion,
    },
  };
}

export async function getArenaHostState(userId: string, arenaId: string) {
  await requireAdmin(userId);
  const arena = await syncLock(await loadArena(arenaId));
  const [
    { data: questions },
    { data: teams },
    { data: members },
    { data: answers },
    { data: profiles },
  ] = await Promise.all([
    db
      .from("play_arena_questions")
      .select(
        "sort_order, segment_index, prompt, image_url, options, correct_indexes, multi_select",
      )
      .eq("arena_id", arena.id)
      .order("sort_order"),
    db
      .from("play_arena_teams")
      .select("id, name, score, correct_count, wrong_count")
      .eq("arena_id", arena.id)
      .order("name"),
    db.from("play_arena_members").select("team_id, user_id").eq("arena_id", arena.id),
    db
      .from("play_arena_answers")
      .select(
        "team_id, question_index, answer_indexes, correct, marks, first_locked_at, submitted_at, time_bonus, early_lock_bonus, lock_latency_ms",
      )
      .eq("arena_id", arena.id),
    db.from("profiles").select("id, full_name, email, avatar_id, last_seen_at").order("full_name"),
  ]);
  const { isUserOnline, presenceStatus } = await import("@/lib/presence");
  const profileById = new Map((profiles ?? []).map((row) => [row.id, row]));
  const teamById = new Map((teams ?? []).map((row) => [row.id, row]));
  const participants = (members ?? []).map((row) => {
    const profile = profileById.get(row.user_id);
    const team = teamById.get(row.team_id);
    const lastSeenAt = profile?.last_seen_at ?? null;
    return {
      userId: row.user_id,
      name: profile?.full_name || profile?.email || "Participant",
      email: profile?.email ?? "",
      avatarId: profile?.avatar_id ?? null,
      teamId: row.team_id,
      teamName: team?.name ?? "Team",
      lastSeenAt,
      online: isUserOnline(lastSeenAt),
      presence: presenceStatus(lastSeenAt),
    };
  });
  const directory = (profiles ?? []).map((profile) => {
    const lastSeenAt = profile.last_seen_at ?? null;
    return {
      userId: profile.id,
      name: profile.full_name || profile.email,
      email: profile.email,
      avatarId: profile.avatar_id,
      lastSeenAt,
      online: isUserOnline(lastSeenAt),
      presence: presenceStatus(lastSeenAt),
      inArena: (members ?? []).some((row) => row.user_id === profile.id),
    };
  });
  const q = (questions ?? [])[arena.current_index] ?? null;
  const questionLive = isArenaQuestionVisible(arena.status);
  const currentAnswers = (answers ?? []).filter(
    (row) => row.question_index === arena.current_index,
  );
  const currentByTeam = new Map(currentAnswers.map((row) => [row.team_id, row]));
  const memberCount = memberCounts(members ?? []);
  const board = arenaBoard(arena, teams ?? [], answers ?? [], members ?? []);
  const showKey = isArenaKeyVisible(arena.status);
  const publishReady = canPublishArenaSegment({
    currentIndex: arena.current_index,
    status: arena.status,
    questionsPerSegment: arena.questions_per_segment,
    segmentCount: arena.segment_count,
    publishedThroughSegment: arena.published_through_segment ?? -1,
  });
  const questionStartedMs = arena.question_started_at
    ? Date.parse(arena.question_started_at)
    : null;
  const coercedAnswers = (answers ?? []).map((ans) => {
    const c = coerceAnswerBonuses({
      correct: ans.correct,
      marks: ans.marks ?? 0,
      timeBonus: ans.time_bonus ?? 0,
      earlyLockBonus: ans.early_lock_bonus ?? 0,
      correctMarks: arena.correct_marks ?? 0,
      earlyLockBonusMax: arena.early_lock_bonus ?? 0,
    });
    return {
      teamId: ans.team_id,
      questionIndex: ans.question_index,
      marks: ans.marks ?? 0,
      correct: ans.correct,
      timeBonus: c.timeBonus,
      earlyLockBonus: c.earlyLockBonus,
      lockLatencyMs: ans.lock_latency_ms ?? null,
      firstLockedAt: ans.first_locked_at ?? ans.submitted_at ?? null,
      rawTimeBonus: ans.time_bonus ?? 0,
      rawEarlyLockBonus: ans.early_lock_bonus ?? 0,
    };
  });
  // Persist recovered bonus columns when marks already include them but DB fields are 0.
  void Promise.all(
    coercedAnswers
      .filter(
        (row) =>
          (row.timeBonus > 0 && row.rawTimeBonus === 0) ||
          (row.earlyLockBonus > 0 && row.rawEarlyLockBonus === 0),
      )
      .map((row) =>
        db
          .from("play_arena_answers")
          .update({
            time_bonus: row.timeBonus,
            early_lock_bonus: row.earlyLockBonus,
          })
          .eq("arena_id", arena.id)
          .eq("team_id", row.teamId)
          .eq("question_index", row.questionIndex),
      ),
  );
  const teamRefs = (teams ?? []).map((team) => ({ id: team.id, name: team.name }));
  const standingCache = new Map<number, ReturnType<typeof standingsThroughQuestion>>();
  function standingsAt(throughIndex: number) {
    const key = throughIndex;
    let hit = standingCache.get(key);
    if (!hit) {
      hit = standingsThroughQuestion({
        teams: teamRefs,
        answers: coercedAnswers,
        throughIndex,
      });
      standingCache.set(key, hit);
    }
    return hit;
  }
  const lockEvents = currentAnswers
    .map((row) => {
      const team = teamById.get(row.team_id);
      const lockedAt = row.first_locked_at ?? row.submitted_at;
      const lockedMs = lockedAt ? Date.parse(lockedAt) : NaN;
      const coerced = coerceAnswerBonuses({
        correct: row.correct,
        marks: row.marks ?? 0,
        timeBonus: row.time_bonus ?? 0,
        earlyLockBonus: row.early_lock_bonus ?? 0,
        correctMarks: arena.correct_marks ?? 0,
        earlyLockBonusMax: arena.early_lock_bonus ?? 0,
      });
      return {
        teamId: row.team_id,
        teamName: team?.name ?? "Team",
        firstLockedAt: lockedAt,
        lockLatencyMs:
          row.lock_latency_ms ??
          (questionStartedMs != null && !Number.isNaN(lockedMs)
            ? Math.max(0, lockedMs - questionStartedMs)
            : null),
        submitted: Boolean(row.answer_indexes?.length),
        correct: showKey ? (row.correct ?? null) : null,
        marks: showKey ? (row.marks ?? 0) : 0,
        timeBonus: showKey ? coerced.timeBonus : 0,
        earlyLockBonus: showKey ? coerced.earlyLockBonus : 0,
      };
    })
    .sort(
      (a, b) =>
        (a.lockLatencyMs ?? Number.MAX_SAFE_INTEGER) -
          (b.lockLatencyMs ?? Number.MAX_SAFE_INTEGER) || a.teamName.localeCompare(b.teamName),
    );
  return {
    arena: {
      id: arena.id,
      name: arena.name,
      status: arena.status as ArenaStatus,
      segmentCount: arena.segment_count,
      questionsPerSegment: arena.questions_per_segment,
      perQuestionSeconds: arena.per_question_seconds,
      currentIndex: arena.current_index,
      questionEndsAt: arena.question_ends_at,
      questionStartedAt: arena.question_started_at,
      totalQuestions: questions?.length ?? 0,
      correctMarks: arena.correct_marks,
      wrongMarks: arena.wrong_marks,
      timeBonusMax: arena.time_bonus_max ?? 0,
      earlyLockBonus: arena.early_lock_bonus ?? 0,
      publishedThroughSegment: arena.published_through_segment ?? -1,
      publishSegmentReady: publishReady,
      allowOpenTeams: arena.allow_open_teams !== false,
    },
    participants,
    directory,
    lockEvents,
    question:
      q && questionLive
        ? {
            prompt: q.prompt,
            imageUrl: q.image_url,
            options: parseOptions(q.options),
            ...(showKey ? { correctIndexes: q.correct_indexes } : {}),
            multiSelect: q.multi_select,
            segment: q.segment_index,
          }
        : null,
    teams: (teams ?? []).map((team) => {
      const ans = currentByTeam.get(team.id);
      return {
        id: team.id,
        name: team.name,
        score: team.score,
        correctCount: team.correct_count,
        wrongCount: team.wrong_count,
        members: memberCount.get(team.id) ?? 0,
        submitted: Boolean(ans && (ans.answer_indexes?.length ?? 0) > 0),
        answerIndexes: showKey ? (ans?.answer_indexes ?? []) : [],
        correct: showKey ? (ans?.correct ?? null) : null,
        marks: showKey ? (ans?.marks ?? 0) : 0,
        timeBonus: showKey ? (ans?.time_bonus ?? 0) : 0,
        earlyLockBonus: showKey ? (ans?.early_lock_bonus ?? 0) : 0,
        firstLockedAt: ans?.first_locked_at ?? null,
        lockLatencyMs: ans?.lock_latency_ms ?? null,
      };
    }),
    board: {
      overallVisible: arena.status === "complete",
      segmentVisible: true,
      publishedSegment: board.publishedSegment,
      rows: withMemberNames(board.rows, participants),
      segmentRows: withMemberNames(board.segmentRows, participants),
      allSegmentBoards: board.allSegmentBoards.map((seg) => ({
        ...seg,
        rows: withMemberNames(seg.rows, participants),
      })),
      publishedSegmentBoards: board.publishedSegmentBoards.map((seg) => ({
        ...seg,
        rows: withMemberNames(seg.rows, participants),
      })),
      segmentWinners: board.allSegmentWinners,
      currentSegmentWinner: board.allSegmentWinners.find(
        (row) =>
          row.segment === arenaSegmentOf(arena.current_index, arena.questions_per_segment).segment,
      ),
      champion: board.champion,
    },
    questionMeta: (questions ?? []).map((row) => ({
      index: row.sort_order,
      segment: row.segment_index,
      label: `Q${row.sort_order + 1}`,
    })),
    answerLedger: coercedAnswers.map((row) => {
      const lockLatencyMs =
        row.lockLatencyMs ??
        (questionStartedMs != null && row.firstLockedAt && row.questionIndex === arena.current_index
          ? Math.max(0, Date.parse(row.firstLockedAt) - questionStartedMs)
          : null);
      return {
        teamId: row.teamId,
        questionIndex: row.questionIndex,
        segment: arenaSegmentOf(row.questionIndex, arena.questions_per_segment).segment,
        correct: row.correct,
        marks: row.marks,
        timeBonus: row.timeBonus,
        earlyLockBonus: row.earlyLockBonus,
        firstLockedAt: row.firstLockedAt,
        lockLatencyMs,
        rankDelta: rankDeltaBetween(
          standingsAt(row.questionIndex - 1),
          standingsAt(row.questionIndex),
          row.teamId,
        ),
      };
    }),
  };
}

export async function adminArenaAction(
  userId: string,
  payload: {
    arenaId: string;
    action: "start" | "lock" | "reveal" | "next" | "publishSegment" | "finish";
  },
) {
  await requireAdmin(userId);
  const arena = await syncLock(await loadArena(payload.arenaId));
  const now = new Date();

  if (payload.action === "start" || payload.action === "next") {
    const nextIndex = payload.action === "next" ? arena.current_index + 1 : arena.current_index;
    const { count } = await db
      .from("play_arena_questions")
      .select("id", { count: "exact", head: true })
      .eq("arena_id", arena.id);
    if (nextIndex >= (count ?? 0)) throw new Error("No more questions. Finish the arena.");
    if (payload.action === "next" && arena.status !== "revealed") {
      throw new Error("Reveal this question before moving on.");
    }
    if (payload.action === "next") {
      const leaving = arenaSegmentOf(arena.current_index, arena.questions_per_segment).segment;
      const entering = arenaSegmentOf(nextIndex, arena.questions_per_segment).segment;
      if (leaving !== entering && (arena.published_through_segment ?? -1) < leaving) {
        throw new Error("Publish this segment’s results before starting the next segment.");
      }
    }
    const ends = new Date(now.getTime() + arena.per_question_seconds * 1000).toISOString();
    const { error } = await db
      .from("play_arenas")
      .update({
        status: "question",
        current_index: nextIndex,
        question_started_at: now.toISOString(),
        question_ends_at: ends,
        updated_at: now.toISOString(),
      })
      .eq("id", arena.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  }

  if (payload.action === "lock") {
    const { error } = await db
      .from("play_arenas")
      .update({ status: "locked", updated_at: now.toISOString() })
      .eq("id", arena.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  }

  if (payload.action === "reveal") {
    if (arena.status !== "locked") {
      throw new Error("Lock answers before revealing the key.");
    }
    const { data: question } = await db
      .from("play_arena_questions")
      .select("correct_indexes")
      .eq("arena_id", arena.id)
      .eq("sort_order", arena.current_index)
      .maybeSingle();
    if (!question) throw new Error("Question missing.");
    const key = question.correct_indexes ?? [];
    const { data: teams } = await db.from("play_arena_teams").select("*").eq("arena_id", arena.id);
    const { data: answers } = await db
      .from("play_arena_answers")
      .select("*")
      .eq("arena_id", arena.id)
      .eq("question_index", arena.current_index);
    const byTeam = new Map((answers ?? []).map((row) => [row.team_id, row]));
    const correctCandidates: Array<{ teamId: string; firstLockedAt: string | null }> = [];
    for (const team of teams ?? []) {
      const ans = byTeam.get(team.id);
      const answered = Boolean(ans && (ans.answer_indexes?.length ?? 0) > 0);
      const correct = answered ? sameIndexSet(ans!.answer_indexes, key) : false;
      if (correct) {
        correctCandidates.push({
          teamId: team.id,
          firstLockedAt: ans?.first_locked_at ?? ans?.submitted_at ?? null,
        });
      }
    }
    const firstLockWinnerId = pickExclusiveFirstLockWinner(correctCandidates);
    for (const team of teams ?? []) {
      const ans = byTeam.get(team.id);
      const answered = Boolean(ans && (ans.answer_indexes?.length ?? 0) > 0);
      const correct = answered ? sameIndexSet(ans!.answer_indexes, key) : false;
      const graded = arenaQuestionMarks({
        answered,
        correct,
        correctMarks: arena.correct_marks,
        wrongMarks: arena.wrong_marks,
        remainingMs: remainingMsAt(
          ans?.first_locked_at ?? ans?.submitted_at,
          arena.question_ends_at,
        ),
        durationSeconds: arena.per_question_seconds,
        timeBonusMax: arena.time_bonus_max ?? 0,
        earlyLockBonus:
          correct && team.id === firstLockWinnerId ? (arena.early_lock_bonus ?? 0) : 0,
      });
      if (ans) {
        const { error: gradeError } = await db
          .from("play_arena_answers")
          .update({
            correct,
            marks: graded.marks,
            time_bonus: graded.timeBonus,
            early_lock_bonus: graded.earlyLockBonus,
          })
          .eq("arena_id", arena.id)
          .eq("team_id", team.id)
          .eq("question_index", arena.current_index);
        if (gradeError) throw new Error(gradeError.message);
      }
    }
    await syncTeamTotals(arena.id);
    const { error } = await db
      .from("play_arenas")
      .update({ status: "revealed", updated_at: now.toISOString() })
      .eq("id", arena.id);
    if (error) throw new Error(error.message);
    return { ok: true as const, firstLockWinnerId };
  }

  if (payload.action === "publishSegment") {
    if (
      !canPublishArenaSegment({
        currentIndex: arena.current_index,
        status: arena.status,
        questionsPerSegment: arena.questions_per_segment,
        segmentCount: arena.segment_count,
        publishedThroughSegment: arena.published_through_segment ?? -1,
      })
    ) {
      throw new Error("Finish and reveal the last question of this segment first.");
    }
    await syncTeamTotals(arena.id);
    const segment = arenaSegmentOf(arena.current_index, arena.questions_per_segment).segment;
    const { error } = await db
      .from("play_arenas")
      .update({
        published_through_segment: segment,
        updated_at: now.toISOString(),
      })
      .eq("id", arena.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  }

  if (payload.action === "finish") {
    const { count } = await db
      .from("play_arena_questions")
      .select("id", { count: "exact", head: true })
      .eq("arena_id", arena.id);
    if (arena.current_index < (count ?? 1) - 1 || arena.status !== "revealed") {
      throw new Error("Reveal the last question before publishing overall results.");
    }
    if ((arena.published_through_segment ?? -1) < arena.segment_count - 1) {
      throw new Error("Publish every segment’s results before the overall leaderboard.");
    }
    await syncTeamTotals(arena.id);
    const { data: teams } = await db
      .from("play_arena_teams")
      .select("id, score, correct_count")
      .eq("arena_id", arena.id);
    const winner = pickArenaWinner(
      (teams ?? []).map((t) => ({ id: t.id, score: t.score, correctCount: t.correct_count })),
    );
    const { data: winnerRow } = winner
      ? await db.from("play_arena_teams").select("name, score").eq("id", winner.id).maybeSingle()
      : { data: null };
    const { error } = await db
      .from("play_arenas")
      .update({
        status: "complete",
        winner_team_id: winner?.id ?? null,
        published_through_segment: arena.segment_count - 1,
        updated_at: now.toISOString(),
      })
      .eq("id", arena.id);
    if (error) throw new Error(error.message);
    if (winnerRow) {
      await notifyEveryone({
        kind: "play_arena",
        title: `${arena.name} winner: ${winnerRow.name}`,
        body: `Final score ${winnerRow.score}. Open Play to see the overall leaderboard.`,
        icon: "🏆",
      });
    }
    return { ok: true as const };
  }

  throw new Error("Unknown action.");
}

export async function adminArenaSpinPick(
  userId: string,
  payload: { arenaId: string; source: "lobby" | "all" },
) {
  await requireAdmin(userId);
  const arena = await loadArena(payload.arenaId);
  const { data: members } = await db
    .from("play_arena_members")
    .select("user_id")
    .eq("arena_id", arena.id);
  let userIds = (members ?? []).map((row) => row.user_id);
  if (payload.source === "all") {
    const { data: profiles } = await db.from("profiles").select("id");
    userIds = (profiles ?? []).map((row) => row.id);
  }
  if (userIds.length === 0) throw new Error("No participants available to spin.");
  const { shuffleList } = await import("@/lib/presence");
  const [pickedId] = shuffleList(userIds);
  const { data: profile } = await db
    .from("profiles")
    .select("id, full_name, email, avatar_id")
    .eq("id", pickedId!)
    .maybeSingle();
  return {
    userId: pickedId!,
    name: profile?.full_name || profile?.email || "Participant",
    email: profile?.email ?? "",
    avatarId: profile?.avatar_id ?? null,
  };
}

export async function adminArenaSplitTeams(
  userId: string,
  payload: {
    arenaId: string;
    teamCount: number;
    perTeam?: number | null;
    source: "lobby" | "all";
    userIds?: string[];
  },
) {
  await requireAdmin(userId);
  const arena = await loadArena(payload.arenaId);
  if (arena.status === "complete") throw new Error("This arena has already finished.");
  const teamCount = Math.max(1, Math.min(32, Math.floor(payload.teamCount)));
  const { defaultTeamNames, splitUsersIntoTeams } = await import("@/lib/presence");

  let pool = [...new Set(payload.userIds?.filter(Boolean) ?? [])];
  if (pool.length === 0) {
    if (payload.source === "lobby") {
      const { data: members } = await db
        .from("play_arena_members")
        .select("user_id")
        .eq("arena_id", arena.id);
      pool = (members ?? []).map((row) => row.user_id);
    } else {
      const { data: profiles } = await db.from("profiles").select("id");
      pool = (profiles ?? []).map((row) => row.id);
    }
  }
  if (pool.length === 0) throw new Error("No users to assign.");

  const { data: existingTeams } = await db
    .from("play_arena_teams")
    .select("id, name")
    .eq("arena_id", arena.id)
    .order("created_at");
  const teams = [...(existingTeams ?? [])];
  while (teams.length < teamCount) {
    const name = defaultTeamNames(teamCount)[teams.length]!;
    const { data: created, error } = await db
      .from("play_arena_teams")
      .insert({ arena_id: arena.id, name, created_by: userId })
      .select("id, name")
      .single();
    if (error) {
      const { data: alt, error: altError } = await db
        .from("play_arena_teams")
        .insert({
          arena_id: arena.id,
          name: `${name} (${teams.length + 1})`,
          created_by: userId,
        })
        .select("id, name")
        .single();
      if (altError) throw new Error(altError.message);
      teams.push(alt);
    } else {
      teams.push(created);
    }
  }
  const targetTeams = teams.slice(0, teamCount);

  const buckets = splitUsersIntoTeams(pool, targetTeams.length, payload.perTeam);
  for (const userIdToMove of pool) {
    await db
      .from("play_arena_members")
      .delete()
      .eq("arena_id", arena.id)
      .eq("user_id", userIdToMove);
  }
  const rows: Array<{ arena_id: string; team_id: string; user_id: string }> = [];
  buckets.forEach((bucket, index) => {
    const team = targetTeams[index];
    if (!team) return;
    for (const uid of bucket) {
      rows.push({ arena_id: arena.id, team_id: team.id, user_id: uid });
    }
  });
  if (rows.length > 0) {
    const { error } = await db.from("play_arena_members").insert(rows);
    if (error) throw new Error(error.message);
  }
  return {
    ok: true as const,
    assigned: rows.length,
    teams: targetTeams.map((team, index) => ({
      id: team.id,
      name: team.name,
      members: buckets[index]?.length ?? 0,
    })),
  };
}

export async function adminListArenas(userId: string) {
  await requireAdmin(userId);
  const { data, error } = await db
    .from("play_arenas")
    .select(
      "id, name, activity_id, status, listed, segment_count, questions_per_segment, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return { arenas: data ?? [] };
}

export async function adminSetArenaListed(userId: string, arenaId: string, listed: boolean) {
  await requireAdmin(userId);
  const { error } = await db
    .from("play_arenas")
    .update({ listed, updated_at: new Date().toISOString() })
    .eq("id", arenaId);
  if (error) throw new Error(error.message);
  return { ok: true as const, listed };
}

export async function adminUpdateArena(
  userId: string,
  payload: {
    arenaId: string;
    name: string;
    perQuestionSeconds: number;
    correctMarks: number;
    wrongMarks: number;
    timeBonusMax: number;
    earlyLockBonus: number;
    allowOpenTeams: boolean;
  },
) {
  await requireAdmin(userId);
  const { data: existing, error: loadError } = await db
    .from("play_arenas")
    .select("id, status, listed")
    .eq("id", payload.arenaId)
    .maybeSingle();
  if (loadError) throw new Error(loadError.message);
  if (!existing) throw new Error("Arena not found.");
  if (existing.status === "complete") {
    throw new Error("Finished arenas cannot be edited.");
  }
  const { error } = await db
    .from("play_arenas")
    .update({
      name: payload.name,
      per_question_seconds: payload.perQuestionSeconds,
      correct_marks: payload.correctMarks,
      wrong_marks: payload.wrongMarks,
      time_bonus_max: payload.timeBonusMax,
      early_lock_bonus: payload.earlyLockBonus,
      allow_open_teams: payload.allowOpenTeams,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.arenaId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function adminDeleteArena(userId: string, arenaId: string) {
  await requireAdmin(userId);
  await db.from("play_arenas").update({ winner_team_id: null }).eq("id", arenaId);
  const { error } = await db.from("play_arenas").delete().eq("id", arenaId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}
