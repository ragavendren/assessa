import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PLAY_KINDS, type PlayKind } from "@/lib/play.math";

const kindSchema = z.enum(PLAY_KINDS);
const uuid = z.string().uuid();

/** Accept number inputs that may arrive as floats from `<input type="number">`. */
function zWhole(min: number, max: number) {
  return z.preprocess((value) => Math.trunc(Number(value)), z.number().int().min(min).max(max));
}

function zWholeOptional(min: number, max: number) {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return undefined;
    return Math.trunc(Number(value));
  }, z.number().int().min(min).max(max).optional());
}

export const getPlayHub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listPlayHub } = await import("@/lib/play.server");
    return listPlayHub(context.userId);
  });

export const getPlayFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getPlayMenuFlag } = await import("@/lib/play.server");
    return getPlayMenuFlag();
  });

export const getPlayCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        kind: kindSchema.optional(),
        courseId: uuid.optional().nullable(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { listTopicCatalog } = await import("@/lib/play.server");
    return listTopicCatalog(data?.kind ?? "topic", data?.courseId ?? null);
  });

export const getCareerReadiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listCareerReadiness } = await import("@/lib/play.server");
    return listCareerReadiness(context.userId);
  });

export const beginPlay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        kind: kindSchema,
        poolId: uuid.optional().nullable(),
        topic: z.string().trim().max(80).optional().nullable(),
        questionCount: z.number().int().min(1).max(100).optional(),
        courseId: uuid.optional().nullable(),
        matchId: uuid.optional().nullable(),
        scenarioId: uuid.optional().nullable(),
        sceneIndex: z.number().int().min(0).max(20).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { startPlaySession } = await import("@/lib/play.server");
    return startPlaySession(context.userId, {
      kind: data.kind as PlayKind,
      ...(data.poolId !== undefined ? { poolId: data.poolId } : {}),
      ...(data.topic !== undefined ? { topic: data.topic } : {}),
      ...(data.questionCount !== undefined ? { questionCount: data.questionCount } : {}),
      ...(data.courseId !== undefined ? { courseId: data.courseId } : {}),
      ...(data.matchId !== undefined ? { matchId: data.matchId } : {}),
      ...(data.scenarioId !== undefined ? { scenarioId: data.scenarioId } : {}),
      ...(data.sceneIndex !== undefined ? { sceneIndex: data.sceneIndex } : {}),
    });
  });

export const getPlayPaper = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ sessionId: uuid }).parse(input))
  .handler(async ({ context, data }) => {
    const { loadPlayPaper } = await import("@/lib/play.server");
    return loadPlayPaper(context.userId, data.sessionId);
  });

export const savePlayProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        sessionId: uuid,
        answers: z.record(z.union([z.number(), z.array(z.number())])),
        currentIndex: z.number().int().min(0).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { checkpointPlay } = await import("@/lib/play.server");
    return checkpointPlay(context.userId, data.sessionId, {
      answers: data.answers,
      ...(data.currentIndex !== undefined ? { currentIndex: data.currentIndex } : {}),
    });
  });

export const answerPlayItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        sessionId: uuid,
        questionId: uuid,
        answer: z.union([z.number(), z.array(z.number())]).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { gradePlayItem } = await import("@/lib/play.server");
    return gradePlayItem(context.userId, data.sessionId, {
      questionId: data.questionId,
      answer: data.answer,
    });
  });

export const finishPlay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        sessionId: uuid,
        answers: z.record(z.union([z.number(), z.array(z.number())])).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { finishPlaySession } = await import("@/lib/play.server");
    return finishPlaySession(context.userId, data.sessionId, data.answers);
  });

export const getPlayResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ sessionId: uuid }).parse(input))
  .handler(async ({ context, data }) => {
    const { summarisePlay } = await import("@/lib/play.server");
    return summarisePlay(context.userId, data.sessionId);
  });

export const claimPlayReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ sessionId: uuid, source: z.enum(["box", "wheel"]) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { rollPlayReward } = await import("@/lib/play.server");
    const row = await rollPlayReward(context.userId, data.sessionId, data.source);
    return { code: row.code, label: row.label, payload: row.payload as Record<string, string> };
  });

export const getPlayBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        kind: kindSchema,
        topic: z.string().trim().max(80).optional().nullable(),
        team: z.boolean().optional(),
        courseId: uuid.optional().nullable(),
        activityId: uuid.optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { listPlayLeaderboard } = await import("@/lib/play.server");
    return listPlayLeaderboard({
      kind: data.kind as PlayKind,
      ...(data.topic !== undefined ? { topic: data.topic } : {}),
      ...(data.team !== undefined ? { team: data.team } : {}),
      ...(data.courseId !== undefined ? { courseId: data.courseId } : {}),
      ...(data.activityId !== undefined ? { activityId: data.activityId } : {}),
    });
  });

export const getFlashDeck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        poolId: uuid,
        topic: z.string().trim().max(80).optional().nullable(),
        courseId: uuid.optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { listFlashCards } = await import("@/lib/play.server");
    return listFlashCards(context.userId, data.poolId, data.topic, data.courseId);
  });

export const saveFlashCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ questionId: uuid, known: z.boolean() }).parse(input))
  .handler(async ({ context, data }) => {
    const { markFlash } = await import("@/lib/play.server");
    return markFlash(context.userId, data.questionId, data.known);
  });

export const sendBattleInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ email: z.string().email() }).parse(input))
  .handler(async ({ context, data }) => {
    const { inviteBattle } = await import("@/lib/play.server");
    return inviteBattle(context.userId, data.email);
  });

export const joinBattle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ matchId: uuid }).parse(input))
  .handler(async ({ context, data }) => {
    const { acceptBattle } = await import("@/lib/play.server");
    return acceptBattle(context.userId, data.matchId);
  });

export const getEscapeRooms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ courseId: uuid.nullable().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { listEscapeScenarios } = await import("@/lib/play.server");
    return listEscapeScenarios({ courseId: data?.courseId ?? null });
  });

export const listPlayTournaments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ courseId: uuid.nullable().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { listOpenTournaments } = await import("@/lib/play.server");
    return listOpenTournaments({ courseId: data?.courseId ?? null });
  });

export const beginEscapeScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ scenarioId: uuid, sceneIndex: z.number().int().min(0).max(20) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { startEscapeScene } = await import("@/lib/play.server");
    return startEscapeScene(context.userId, data.scenarioId, data.sceneIndex);
  });

export const getTournamentDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ tournamentId: uuid }).parse(input))
  .handler(async ({ data }) => {
    const { getTournament } = await import("@/lib/play.server");
    return getTournament(data.tournamentId);
  });

export const enterTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ tournamentId: uuid }).parse(input))
  .handler(async ({ context, data }) => {
    const { joinTournament } = await import("@/lib/play.server");
    return joinTournament(context.userId, data.tournamentId);
  });

export const beginKnockoutMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ matchId: uuid }).parse(input))
  .handler(async ({ context, data }) => {
    const { startKnockoutMatch } = await import("@/lib/play.server");
    return startKnockoutMatch(context.userId, data.matchId);
  });

export const getAdminPlay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { adminListPlay } = await import("@/lib/play.server");
    return adminListPlay(context.userId);
  });

export const saveEscapeScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: uuid.optional(),
        name: z.string().trim().min(2).max(120),
        intro: z.string().trim().max(2000),
        poolId: uuid.optional().nullable(),
        courseId: uuid.optional().nullable(),
        status: z.enum(["active", "inactive"]).optional(),
        scenes: z
          .array(
            z.object({
              title: z.string().trim().min(1).max(120),
              body: z.string().trim().max(2000),
              topic: z.string().trim().min(1).max(80),
              questionCount: z.number().int().min(1).max(20),
            }),
          )
          .max(12),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { adminSaveEscape } = await import("@/lib/play.server");
    return adminSaveEscape(context.userId, {
      name: data.name,
      intro: data.intro,
      scenes: data.scenes,
      ...(data.id !== undefined ? { id: data.id } : {}),
      ...(data.poolId !== undefined ? { poolId: data.poolId } : {}),
      ...(data.courseId !== undefined ? { courseId: data.courseId } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    });
  });

export const createPlayTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(120),
        size: z.union([z.literal(4), z.literal(8), z.literal(16), z.literal(32)]),
        poolId: uuid.optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { adminCreateTournament } = await import("@/lib/play.server");
    return adminCreateTournament(context.userId, {
      name: data.name,
      size: data.size,
      ...(data.poolId !== undefined ? { poolId: data.poolId } : {}),
    });
  });

export const startPlayTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ tournamentId: uuid }).parse(input))
  .handler(async ({ context, data }) => {
    const { adminStartTournament } = await import("@/lib/play.server");
    return adminStartTournament(context.userId, data.tournamentId);
  });

const playRulesSchema = z.object({
  questionCount: z.number().int().min(1).max(100),
  durationSeconds: z.number().int().min(0).max(18_000).nullable(),
  perQuestionSeconds: z.number().int().min(0).max(600).nullable(),
  lives: z.number().int().min(0).max(20).nullable(),
  timeBonus: z.boolean(),
  onePerPeriod: z.boolean(),
  xpPoints: z.number().int().min(0).max(500),
  reward: z.boolean(),
  perItem: z.boolean(),
  segmentCount: z.number().int().min(1).max(12).optional(),
  questionsPerSegment: z.number().int().min(1).max(20).optional(),
  correctMarks: z.number().int().min(0).max(20).optional(),
  wrongMarks: z.number().int().min(0).max(20).optional(),
});

export const savePlayChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: uuid.optional(),
        kind: kindSchema,
        name: z.string().trim().min(2).max(120),
        status: z.enum(["active", "inactive"]),
        courseId: uuid.nullable(),
        activityId: uuid.nullable(),
        poolId: uuid.nullable(),
        allowedTopics: z.array(z.string().trim().min(1).max(80)).max(80).nullable(),
        rules: playRulesSchema,
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { adminUpsertChallenge } = await import("@/lib/play.server");
    return adminUpsertChallenge(context.userId, {
      kind: data.kind as PlayKind,
      name: data.name,
      status: data.status,
      courseId: data.courseId,
      activityId: data.activityId,
      poolId: data.poolId,
      allowedTopics: data.allowedTopics,
      rules: {
        questionCount: data.rules.questionCount,
        durationSeconds: data.rules.durationSeconds || null,
        perQuestionSeconds: data.rules.perQuestionSeconds || null,
        lives: data.rules.lives || null,
        timeBonus: data.rules.timeBonus,
        onePerPeriod: data.rules.onePerPeriod,
        xpPoints: data.rules.xpPoints,
        reward: data.rules.reward,
        perItem: data.rules.perItem,
        segmentCount: data.rules.segmentCount ?? null,
        questionsPerSegment: data.rules.questionsPerSegment ?? null,
        correctMarks: data.rules.correctMarks ?? null,
        wrongMarks: data.rules.wrongMarks ?? null,
      },
      ...(data.id ? { id: data.id } : {}),
    });
  });

export const setPlayKindStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ kind: kindSchema, status: z.enum(["active", "inactive"]) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { adminSetKindStatus } = await import("@/lib/play.server");
    return adminSetKindStatus(context.userId, data.kind as PlayKind, data.status);
  });

export const setPlayMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ menuEnabled: z.boolean() }).parse(input))
  .handler(async ({ context, data }) => {
    const { adminSetPlayMenu } = await import("@/lib/play.server");
    return adminSetPlayMenu(context.userId, data.menuEnabled);
  });

export const setEscapeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ scenarioId: uuid, status: z.enum(["active", "inactive"]) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { adminSetEscapeStatus } = await import("@/lib/play.server");
    return adminSetEscapeStatus(context.userId, data.scenarioId, data.status);
  });

export const savePlayActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: uuid.optional(),
        name: z.string().trim().min(2).max(80),
        status: z.enum(["active", "inactive"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { adminUpsertActivity } = await import("@/lib/play.arena.server");
    return adminUpsertActivity(context.userId, {
      name: data.name,
      ...(data.id ? { id: data.id } : {}),
      ...(data.status ? { status: data.status } : {}),
    });
  });

export const deletePlayActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: uuid }).parse(input))
  .handler(async ({ context, data }) => {
    const { adminDeleteActivity } = await import("@/lib/play.arena.server");
    return adminDeleteActivity(context.userId, data.id);
  });

export const createLiveArena = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(120),
        activityId: uuid.nullable().optional(),
        poolId: uuid,
        courseId: uuid.nullable().optional(),
        segmentCount: zWhole(1, 12),
        questionsPerSegment: zWhole(1, 20),
        perQuestionSeconds: zWhole(5, 600),
        correctMarks: zWhole(0, 20),
        wrongMarks: zWhole(0, 20),
        timeBonusMax: zWholeOptional(0, 50),
        earlyLockBonus: zWholeOptional(0, 50),
        teamCount: zWholeOptional(0, 32),
        teamNames: z.array(z.string().trim().min(0).max(40)).max(32).optional(),
        allowOpenTeams: z.boolean().optional(),
        blueprintId: uuid.nullable().optional(),
        avoidRepeats: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { adminCreateArena } = await import("@/lib/play.arena.server");
    return adminCreateArena(context.userId, {
      name: data.name,
      activityId: data.activityId ?? null,
      poolId: data.poolId,
      courseId: data.courseId ?? null,
      blueprintId: data.blueprintId ?? null,
      avoidRepeats: data.avoidRepeats !== false,
      segmentCount: data.segmentCount,
      questionsPerSegment: data.questionsPerSegment,
      perQuestionSeconds: data.perQuestionSeconds,
      correctMarks: data.correctMarks,
      wrongMarks: data.wrongMarks,
      timeBonusMax: data.timeBonusMax ?? 0,
      earlyLockBonus: data.earlyLockBonus ?? 0,
      teamCount: data.teamCount ?? 0,
      teamNames: data.teamNames ?? [],
      allowOpenTeams: data.allowOpenTeams !== false,
    });
  });

export const listLiveArenas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        activityId: uuid.nullable().optional(),
        courseId: uuid.nullable().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { listOpenArenas } = await import("@/lib/play.arena.server");
    return listOpenArenas({
      activityId: data?.activityId ?? null,
      courseId: data?.courseId ?? null,
    });
  });

export const joinLiveArena = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        arenaId: uuid,
        teamName: z.string().trim().min(2).max(40).optional(),
        teamId: uuid.optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { joinArena } = await import("@/lib/play.arena.server");
    return joinArena(context.userId, {
      arenaId: data.arenaId,
      ...(data.teamName ? { teamName: data.teamName } : {}),
      ...(data.teamId ? { teamId: data.teamId } : {}),
    });
  });

export const getArenaPlayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ arenaId: uuid }).parse(input))
  .handler(async ({ context, data }) => {
    const { getArenaPlayerState } = await import("@/lib/play.arena.server");
    return getArenaPlayerState(context.userId, data.arenaId);
  });

export const submitArenaAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({ arenaId: uuid, answer: z.array(z.number().int().min(0).max(20)).max(8) })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { submitArenaAnswer: submit } = await import("@/lib/play.arena.server");
    return submit(context.userId, { arenaId: data.arenaId, answer: data.answer });
  });

export const getArenaHost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ arenaId: uuid }).parse(input))
  .handler(async ({ context, data }) => {
    const { getArenaHostState } = await import("@/lib/play.arena.server");
    return getArenaHostState(context.userId, data.arenaId);
  });

export const runArenaAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        arenaId: uuid,
        action: z.enum(["start", "lock", "reveal", "next", "publishSegment", "finish"]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { adminArenaAction } = await import("@/lib/play.arena.server");
    return adminArenaAction(context.userId, data);
  });

export const deleteLiveArena = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ arenaId: uuid }).parse(input))
  .handler(async ({ context, data }) => {
    const { adminDeleteArena } = await import("@/lib/play.arena.server");
    return adminDeleteArena(context.userId, data.arenaId);
  });

export const setLiveArenaListed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ arenaId: uuid, listed: z.boolean() }).parse(input))
  .handler(async ({ context, data }) => {
    const { adminSetArenaListed } = await import("@/lib/play.arena.server");
    return adminSetArenaListed(context.userId, data.arenaId, data.listed);
  });

export const setTournamentListed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ tournamentId: uuid, listed: z.boolean() }).parse(input))
  .handler(async ({ context, data }) => {
    const { adminSetTournamentListed } = await import("@/lib/play.server");
    return adminSetTournamentListed(context.userId, data.tournamentId, data.listed);
  });

export const updateLiveArena = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        arenaId: uuid,
        name: z.string().trim().min(2).max(120),
        perQuestionSeconds: zWhole(5, 600),
        correctMarks: zWhole(0, 20),
        wrongMarks: zWhole(0, 20),
        timeBonusMax: zWhole(0, 50),
        earlyLockBonus: zWhole(0, 50),
        allowOpenTeams: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { adminUpdateArena } = await import("@/lib/play.arena.server");
    return adminUpdateArena(context.userId, data);
  });

export const updatePlayTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        tournamentId: uuid,
        name: z.string().trim().min(2).max(120),
        size: z.union([z.literal(4), z.literal(8), z.literal(16), z.literal(32)]),
        poolId: uuid.nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { adminUpdateTournament } = await import("@/lib/play.server");
    return adminUpdateTournament(context.userId, {
      tournamentId: data.tournamentId,
      name: data.name,
      size: data.size,
      ...(data.poolId !== undefined ? { poolId: data.poolId } : {}),
    });
  });

export const spinArenaParticipant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ arenaId: uuid, source: z.enum(["lobby", "all"]) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { adminArenaSpinPick } = await import("@/lib/play.arena.server");
    return adminArenaSpinPick(context.userId, data);
  });

export const splitArenaTeams = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        arenaId: uuid,
        teamCount: z.number().int().min(1).max(32),
        perTeam: z.number().int().min(1).max(50).nullable().optional(),
        source: z.enum(["lobby", "all"]),
        userIds: z.array(uuid).max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { adminArenaSplitTeams } = await import("@/lib/play.arena.server");
    return adminArenaSplitTeams(context.userId, {
      arenaId: data.arenaId,
      teamCount: data.teamCount,
      perTeam: data.perTeam ?? null,
      source: data.source,
      userIds: data.userIds,
    });
  });
