/**
 * Live Arena: hosted timed team quiz. Server-only.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  arenaMarks,
  arenaSegmentOf,
  arenaTotalQuestions,
  autoLockIfExpired,
  buildArenaBoard,
  pickArenaWinner,
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
  }>,
  members: Array<{ team_id: string }> | null,
) {
  const counts = memberCounts(members);
  return buildArenaBoard({
    teams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      score: team.score,
      correctCount: team.correct_count,
      wrongCount: team.wrong_count,
      members: counts.get(team.id) ?? 0,
    })),
    answers: answers.map((row) => ({
      teamId: row.team_id,
      questionIndex: row.question_index,
      marks: row.marks,
      correct: row.correct,
    })),
    currentIndex: arena.current_index,
    status: arena.status,
    questionsPerSegment: arena.questions_per_segment,
    segmentCount: arena.segment_count,
  });
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
    activityId: string;
    poolId: string;
    courseId?: string | null;
    segmentCount: number;
    questionsPerSegment: number;
    perQuestionSeconds: number;
    correctMarks: number;
    wrongMarks: number;
  },
) {
  await requireAdmin(userId);
  const total = arenaTotalQuestions(payload.segmentCount, payload.questionsPerSegment);
  const { data: poolQs, error: qError } = await db
    .from("pool_questions")
    .select("id, prompt, image_url, options, correct_indexes, multi_select, explanation, status")
    .eq("pool_id", payload.poolId)
    .eq("status", "active");
  if (qError) throw new Error(qError.message);
  const eligible = (poolQs ?? []).filter((row) => parseOptions(row.options).length >= 2);
  if (eligible.length < total) {
    throw new Error(`Need at least ${total} active pool questions for this arena.`);
  }
  const picked = pickWithSeed(eligible, total, `${payload.name}:${Date.now()}`);
  const { data: arena, error } = await db
    .from("play_arenas")
    .insert({
      name: payload.name,
      activity_id: payload.activityId,
      course_id: payload.courseId ?? null,
      pool_id: payload.poolId,
      status: "lobby",
      segment_count: payload.segmentCount,
      questions_per_segment: payload.questionsPerSegment,
      per_question_seconds: payload.perQuestionSeconds,
      correct_marks: payload.correctMarks,
      wrong_marks: payload.wrongMarks,
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
    };
  });
  const { error: insertQ } = await db.from("play_arena_questions").insert(rows);
  if (insertQ) throw new Error(insertQ.message);

  await notifyEveryone({
    kind: "play_arena",
    title: `${payload.name} lobby is open`,
    body: "Pick a team name and join Live Arena from Play.",
    icon: "🏟️",
  });
  return { id: arena.id };
}

export async function listOpenArenas(activityId?: string | null) {
  let query = db
    .from("play_arenas")
    .select(
      "id, name, activity_id, status, segment_count, questions_per_segment, per_question_seconds",
    )
    .in("status", ["lobby", "question", "locked", "revealed", "complete"]);
  if (activityId) query = query.eq("activity_id", activityId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { arenas: data ?? [] };
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
  const { error } = await db.from("play_arena_answers").upsert({
    arena_id: arena.id,
    team_id: teamId,
    question_index: arena.current_index,
    answer_indexes: indexes,
    submitted_at: new Date().toISOString(),
    correct: null,
    marks: 0,
  });
  if (error) throw new Error(error.message);
  return { ok: true as const };
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
    db.from("play_arena_members").select("team_id").eq("arena_id", arena.id),
    db
      .from("play_arena_answers")
      .select("team_id, question_index, marks, correct")
      .eq("arena_id", arena.id),
    teamId
      ? db
          .from("play_arena_answers")
          .select("answer_indexes, correct, marks")
          .eq("arena_id", arena.id)
          .eq("team_id", teamId)
          .eq("question_index", arena.current_index)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const q = (questions ?? [])[arena.current_index] ?? null;
  const revealed = arena.status === "revealed" || arena.status === "complete";
  const myTeam = (teams ?? []).find((t) => t.id === teamId) ?? null;
  const board = arenaBoard(arena, teams ?? [], answers ?? [], members ?? []);

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
    },
    teams: (teams ?? []).map((t) => ({ id: t.id, name: t.name })),
    myTeam: myTeam
      ? {
          id: myTeam.id,
          name: myTeam.name,
          score: myTeam.score,
          correctCount: myTeam.correct_count,
          wrongCount: myTeam.wrong_count,
        }
      : null,
    question: q
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
    myResult: revealed && myAnswer ? { correct: myAnswer.correct, marks: myAnswer.marks } : null,
    board: {
      visible: revealed,
      ...board,
    },
  };
}

export async function getArenaHostState(userId: string, arenaId: string) {
  await requireAdmin(userId);
  const arena = await syncLock(await loadArena(arenaId));
  const [{ data: questions }, { data: teams }, { data: members }, { data: answers }] =
    await Promise.all([
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
        .order("score", { ascending: false }),
      db.from("play_arena_members").select("team_id, user_id").eq("arena_id", arena.id),
      db
        .from("play_arena_answers")
        .select("team_id, question_index, answer_indexes, correct, marks")
        .eq("arena_id", arena.id),
    ]);
  const q = (questions ?? [])[arena.current_index] ?? null;
  const currentByTeam = new Map(
    (answers ?? [])
      .filter((row) => row.question_index === arena.current_index)
      .map((row) => [row.team_id, row]),
  );
  const memberCount = memberCounts(members ?? []);
  const board = arenaBoard(arena, teams ?? [], answers ?? [], members ?? []);
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
      correctMarks: arena.correct_marks,
      wrongMarks: arena.wrong_marks,
    },
    question: q
      ? {
          prompt: q.prompt,
          imageUrl: q.image_url,
          options: parseOptions(q.options),
          correctIndexes: q.correct_indexes,
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
        submitted: Boolean(ans),
        answerIndexes: ans?.answer_indexes ?? [],
        correct: ans?.correct ?? null,
        marks: ans?.marks ?? 0,
      };
    }),
    board: {
      visible: true,
      ...board,
    },
  };
}

export async function adminArenaAction(
  userId: string,
  payload: { arenaId: string; action: "start" | "lock" | "reveal" | "next" | "finish" },
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
    if (arena.status !== "locked" && arena.status !== "question") {
      throw new Error("Lock the question before revealing.");
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
    for (const team of teams ?? []) {
      const ans = byTeam.get(team.id);
      const answered = Boolean(ans && (ans.answer_indexes?.length ?? 0) > 0);
      const correct = answered ? sameIndexSet(ans!.answer_indexes, key) : false;
      const marks = arenaMarks(answered, correct, arena.correct_marks, arena.wrong_marks);
      if (ans) {
        await db
          .from("play_arena_answers")
          .update({ correct, marks })
          .eq("arena_id", arena.id)
          .eq("team_id", team.id)
          .eq("question_index", arena.current_index);
      }
      await db
        .from("play_arena_teams")
        .update({
          score: team.score + marks,
          correct_count: team.correct_count + (correct ? 1 : 0),
          wrong_count: team.wrong_count + (answered && !correct ? 1 : 0),
        })
        .eq("id", team.id);
    }
    const { error } = await db
      .from("play_arenas")
      .update({ status: "revealed", updated_at: now.toISOString() })
      .eq("id", arena.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  }

  if (payload.action === "finish") {
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
        updated_at: now.toISOString(),
      })
      .eq("id", arena.id);
    if (error) throw new Error(error.message);
    if (winnerRow) {
      await notifyEveryone({
        kind: "play_arena",
        title: `${arena.name} winner: ${winnerRow.name}`,
        body: `Final score ${winnerRow.score}. Open Play to see your team's card.`,
        icon: "🏆",
      });
    }
    return { ok: true as const };
  }

  throw new Error("Unknown action.");
}

export async function adminListArenas(userId: string) {
  await requireAdmin(userId);
  const { data, error } = await db
    .from("play_arenas")
    .select("id, name, activity_id, status, segment_count, questions_per_segment, created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return { arenas: data ?? [] };
}

export async function adminDeleteArena(userId: string, arenaId: string) {
  await requireAdmin(userId);
  await db.from("play_arenas").update({ winner_team_id: null }).eq("id", arenaId);
  const { error } = await db.from("play_arenas").delete().eq("id", arenaId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}
