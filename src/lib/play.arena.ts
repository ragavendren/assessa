/** Live Arena scoring — timed team rounds with negative marks. */

export function arenaMarks(
  answered: boolean,
  correct: boolean,
  correctMarks: number,
  wrongMarks: number,
): number {
  if (!answered) return 0;
  if (correct) return Math.max(0, correctMarks);
  return -Math.abs(wrongMarks);
}

/** Remaining question time in whole seconds (display / coarse UI). */
export function remainingSecondsAt(
  lockedAt: string | null | undefined,
  questionEndsAt: string | null,
) {
  return Math.max(0, Math.round(remainingMsAt(lockedAt, questionEndsAt) / 1000));
}

/** Remaining question time in milliseconds for competitive scoring. */
export function remainingMsAt(lockedAt: string | null | undefined, questionEndsAt: string | null) {
  if (!lockedAt || !questionEndsAt) return 0;
  const locked = Date.parse(lockedAt);
  const ends = Date.parse(questionEndsAt);
  if (Number.isNaN(locked) || Number.isNaN(ends)) return 0;
  return Math.max(0, ends - locked);
}

export function arenaSpeedBonuses(args: {
  correct: boolean;
  remainingMs: number;
  durationSeconds: number;
  timeBonusMax: number;
  /** Pass the configured early-lock amount only when this team won exclusive first-lock. */
  earlyLockBonus: number;
}): { timeBonus: number; earlyLockBonus: number } {
  if (!args.correct) return { timeBonus: 0, earlyLockBonus: 0 };
  const durationMs = Math.max(1, args.durationSeconds) * 1000;
  const remaining = Math.max(0, Math.min(durationMs, args.remainingMs));
  const scaled = (args.timeBonusMax * remaining) / durationMs;
  // Round half up so max=1 still awards +1 whenever ≥50% of the timer remains.
  const timeBonus =
    args.timeBonusMax > 0 ? Math.min(args.timeBonusMax, Math.floor(scaled + 0.5)) : 0;
  return {
    timeBonus,
    earlyLockBonus: args.earlyLockBonus > 0 ? Math.trunc(args.earlyLockBonus) : 0,
  };
}

/**
 * Recover time/first-lock split when marks already include bonuses but columns were left at 0
 * (legacy rows / partial writes). Leaderboard Time / First columns use this.
 */
export function coerceAnswerBonuses(args: {
  correct: boolean | null;
  marks: number;
  timeBonus: number;
  earlyLockBonus: number;
  correctMarks: number;
  earlyLockBonusMax: number;
}): { timeBonus: number; earlyLockBonus: number } {
  if (args.timeBonus > 0 || args.earlyLockBonus > 0) {
    return { timeBonus: args.timeBonus, earlyLockBonus: args.earlyLockBonus };
  }
  if (args.correct !== true) return { timeBonus: 0, earlyLockBonus: 0 };
  const extra = Math.max(0, args.marks - Math.max(0, args.correctMarks));
  if (extra <= 0) return { timeBonus: 0, earlyLockBonus: 0 };
  if (args.earlyLockBonusMax > 0 && extra >= args.earlyLockBonusMax) {
    return {
      earlyLockBonus: args.earlyLockBonusMax,
      timeBonus: Math.max(0, extra - args.earlyLockBonusMax),
    };
  }
  return { timeBonus: extra, earlyLockBonus: 0 };
}

/**
 * Among correct teams, pick the single earliest first-lock (ms).
 * Tie-break by team id for determinism.
 */
export function pickExclusiveFirstLockWinner(
  candidates: Array<{ teamId: string; firstLockedAt: string | null | undefined }>,
): string | null {
  const eligible = candidates
    .filter((row) => row.firstLockedAt)
    .map((row) => ({ teamId: row.teamId, at: Date.parse(row.firstLockedAt!) }))
    .filter((row) => !Number.isNaN(row.at));
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => a.at - b.at || a.teamId.localeCompare(b.teamId));
  return eligible[0]?.teamId ?? null;
}

export function arenaQuestionMarks(args: {
  answered: boolean;
  correct: boolean;
  correctMarks: number;
  wrongMarks: number;
  remainingMs: number;
  durationSeconds: number;
  timeBonusMax: number;
  earlyLockBonus: number;
}): { marks: number; timeBonus: number; earlyLockBonus: number } {
  const base = arenaMarks(args.answered, args.correct, args.correctMarks, args.wrongMarks);
  const speed = arenaSpeedBonuses({
    correct: args.answered && args.correct,
    remainingMs: args.remainingMs,
    durationSeconds: args.durationSeconds,
    timeBonusMax: args.timeBonusMax,
    earlyLockBonus: args.earlyLockBonus,
  });
  return {
    marks: base + speed.timeBonus + speed.earlyLockBonus,
    timeBonus: speed.timeBonus,
    earlyLockBonus: speed.earlyLockBonus,
  };
}

export function arenaTotalQuestions(segmentCount: number, questionsPerSegment: number) {
  return Math.max(1, segmentCount) * Math.max(1, questionsPerSegment);
}

export function arenaSegmentOf(index: number, questionsPerSegment: number) {
  const per = Math.max(1, questionsPerSegment);
  return {
    segment: Math.floor(index / per),
    offset: index % per,
  };
}

export function pickArenaWinner<T extends ArenaRankable>(teams: T[]): T | null {
  if (teams.length === 0) return null;
  return rankArenaTeams(teams)[0] ?? null;
}

export type ArenaRankable = {
  id: string;
  score: number;
  correctCount: number;
  /** Lower is faster. Missing latency sorts last. */
  totalLockLatencyMs?: number;
};

function compareArenaStanding(a: ArenaRankable, b: ArenaRankable) {
  const aLat = a.totalLockLatencyMs ?? Number.MAX_SAFE_INTEGER;
  const bLat = b.totalLockLatencyMs ?? Number.MAX_SAFE_INTEGER;
  return (
    b.score - a.score || b.correctCount - a.correctCount || aLat - bLat || a.id.localeCompare(b.id)
  );
}

function sameArenaStanding(a: ArenaRankable, b: ArenaRankable) {
  return (
    a.score === b.score &&
    a.correctCount === b.correctCount &&
    (a.totalLockLatencyMs ?? Number.MAX_SAFE_INTEGER) ===
      (b.totalLockLatencyMs ?? Number.MAX_SAFE_INTEGER)
  );
}

/** Competition ranking: ties share place (1,1,3). Order: score → correct → fastest → id. */
export function rankArenaTeams<T extends ArenaRankable>(
  teams: T[],
): Array<T & { rank: number; tied: boolean }> {
  const sorted = [...teams].sort(compareArenaStanding);
  const ranks: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    ranks[i] = i === 0 || !sameArenaStanding(sorted[i - 1]!, sorted[i]!) ? i + 1 : ranks[i - 1]!;
  }
  return sorted.map((team, index) => ({
    ...team,
    rank: ranks[index]!,
    tied: sorted.filter((other) => sameArenaStanding(other, team)).length > 1,
  }));
}

export function isLastQuestionOfSegment(index: number, questionsPerSegment: number) {
  return arenaSegmentOf(index, questionsPerSegment).offset === Math.max(1, questionsPerSegment) - 1;
}

export function segmentQuestionRange(segment: number, questionsPerSegment: number) {
  const per = Math.max(1, questionsPerSegment);
  const start = segment * per;
  return { start, end: start + per };
}

export function completedArenaSegments(args: {
  currentIndex: number;
  status: string;
  questionsPerSegment: number;
  segmentCount: number;
}) {
  const current = arenaSegmentOf(args.currentIndex, args.questionsPerSegment).segment;
  const revealed = args.status === "revealed" || args.status === "complete";
  const endOfCurrent = isLastQuestionOfSegment(args.currentIndex, args.questionsPerSegment);
  const done: number[] = [];
  for (let segment = 0; segment < args.segmentCount; segment++) {
    if (args.status === "complete" || segment < current) done.push(segment);
    else if (segment === current && endOfCurrent && revealed) done.push(segment);
  }
  return done;
}

export function isArenaKeyVisible(status: string) {
  return status === "locked" || status === "revealed" || status === "complete";
}

/** Question stem is live only during play — hidden in lobby and after overall announce. */
export function isArenaQuestionVisible(status: string) {
  return status === "question" || status === "locked" || status === "revealed";
}

export function nextSegmentToPublish(publishedThroughSegment: number) {
  return publishedThroughSegment + 1;
}

export function canPublishArenaSegment(args: {
  currentIndex: number;
  status: string;
  questionsPerSegment: number;
  segmentCount: number;
  publishedThroughSegment: number;
}) {
  if (args.status !== "revealed") return false;
  const current = arenaSegmentOf(args.currentIndex, args.questionsPerSegment).segment;
  const next = nextSegmentToPublish(args.publishedThroughSegment);
  return (
    next === current &&
    next < args.segmentCount &&
    isLastQuestionOfSegment(args.currentIndex, args.questionsPerSegment)
  );
}

export function publicArenaSegments(publishedThroughSegment: number, segmentCount: number) {
  const done: number[] = [];
  const last = Math.min(publishedThroughSegment, segmentCount - 1);
  for (let segment = 0; segment <= last; segment++) done.push(segment);
  return done;
}

export function segmentTeamScores<
  T extends {
    teamId: string;
    questionIndex: number;
    marks: number;
    correct: boolean | null;
    timeBonus?: number;
    earlyLockBonus?: number;
    lockLatencyMs?: number | null;
  },
>(answers: T[], segment: number, questionsPerSegment: number) {
  const { start, end } = segmentQuestionRange(segment, questionsPerSegment);
  const byTeam = new Map<
    string,
    {
      score: number;
      correctCount: number;
      wrongCount: number;
      timeBonus: number;
      earlyLockBonus: number;
      bonusPoints: number;
      totalLockLatencyMs: number;
    }
  >();
  for (const row of answers) {
    if (row.questionIndex < start || row.questionIndex >= end) continue;
    const current = byTeam.get(row.teamId) ?? {
      score: 0,
      correctCount: 0,
      wrongCount: 0,
      timeBonus: 0,
      earlyLockBonus: 0,
      bonusPoints: 0,
      totalLockLatencyMs: 0,
    };
    current.score += row.marks;
    if (row.correct === true) current.correctCount += 1;
    if (row.correct === false) current.wrongCount += 1;
    const time = row.timeBonus ?? 0;
    const early = row.earlyLockBonus ?? 0;
    current.timeBonus += time;
    current.earlyLockBonus += early;
    current.bonusPoints += time + early;
    if (row.lockLatencyMs != null && row.lockLatencyMs >= 0) {
      current.totalLockLatencyMs += row.lockLatencyMs;
    }
    byTeam.set(row.teamId, current);
  }
  return byTeam;
}

/** Standings after questions `0..throughIndex` inclusive (`throughIndex < 0` → empty). */
export function standingsThroughQuestion(args: {
  teams: Array<{ id: string; name?: string; members?: number }>;
  answers: Array<{
    teamId: string;
    questionIndex: number;
    marks: number;
    correct: boolean | null;
    timeBonus?: number;
    earlyLockBonus?: number;
    lockLatencyMs?: number | null;
  }>;
  throughIndex: number;
}): Map<string, { rank: number; score: number; correctCount: number; totalLockLatencyMs: number }> {
  const tallies = new Map<
    string,
    { score: number; correctCount: number; totalLockLatencyMs: number }
  >();
  for (const team of args.teams) {
    tallies.set(team.id, { score: 0, correctCount: 0, totalLockLatencyMs: 0 });
  }
  for (const row of args.answers) {
    if (row.questionIndex < 0 || row.questionIndex > args.throughIndex) continue;
    const current = tallies.get(row.teamId) ?? {
      score: 0,
      correctCount: 0,
      totalLockLatencyMs: 0,
    };
    current.score += row.marks;
    if (row.correct === true) current.correctCount += 1;
    if (row.lockLatencyMs != null && row.lockLatencyMs >= 0) {
      current.totalLockLatencyMs += row.lockLatencyMs;
    }
    tallies.set(row.teamId, current);
  }
  const ranked = rankArenaTeams(
    args.teams.map((team) => {
      const stats = tallies.get(team.id)!;
      return {
        id: team.id,
        score: stats.score,
        correctCount: stats.correctCount,
        totalLockLatencyMs: stats.totalLockLatencyMs,
      };
    }),
  );
  return new Map(
    ranked.map((row) => [
      row.id,
      {
        rank: row.rank,
        score: row.score,
        correctCount: row.correctCount,
        totalLockLatencyMs: row.totalLockLatencyMs ?? 0,
      },
    ]),
  );
}

export function rankDeltaBetween(
  before: Map<string, { rank: number }>,
  after: Map<string, { rank: number }>,
  teamId: string,
): number | null {
  const prev = before.get(teamId)?.rank;
  const next = after.get(teamId)?.rank;
  if (prev == null || next == null) return null;
  return prev - next;
}

export function autoLockIfExpired(
  status: string,
  questionEndsAt: string | null,
  now = Date.now(),
): boolean {
  if (status !== "question" || !questionEndsAt) return false;
  return new Date(questionEndsAt).getTime() <= now;
}

export type ArenaBoardRow = {
  id: string;
  name: string;
  rank: number;
  /** Positive = moved up since previous checkpoint. */
  rankDelta: number | null;
  tied: boolean;
  score: number;
  correctCount: number;
  wrongCount: number;
  members: number;
  memberNames?: string[];
  segmentScore: number;
  timeBonus: number;
  earlyLockBonus: number;
  bonusPoints: number;
  totalLockLatencyMs: number;
};

export type ArenaSegmentWinner = {
  segment: number;
  id: string;
  name: string;
  score: number;
};

export function rankSegmentTeams(args: {
  teams: Array<{
    id: string;
    name: string;
    members?: number;
  }>;
  answers: Array<{
    teamId: string;
    questionIndex: number;
    marks: number;
    correct: boolean | null;
    timeBonus?: number;
    earlyLockBonus?: number;
    lockLatencyMs?: number | null;
  }>;
  segment: number;
  questionsPerSegment: number;
}): ArenaBoardRow[] {
  const { start, end } = segmentQuestionRange(args.segment, args.questionsPerSegment);
  const scores = segmentTeamScores(args.answers, args.segment, args.questionsPerSegment);
  const before = standingsThroughQuestion({
    teams: args.teams,
    answers: args.answers,
    throughIndex: start - 1,
  });
  const after = standingsThroughQuestion({
    teams: args.teams,
    answers: args.answers,
    throughIndex: end - 1,
  });
  return rankArenaTeams(
    args.teams.map((team) => {
      const stats = scores.get(team.id);
      return {
        id: team.id,
        name: team.name,
        score: stats?.score ?? 0,
        correctCount: stats?.correctCount ?? 0,
        wrongCount: stats?.wrongCount ?? 0,
        members: team.members ?? 0,
        timeBonus: stats?.timeBonus ?? 0,
        earlyLockBonus: stats?.earlyLockBonus ?? 0,
        bonusPoints: stats?.bonusPoints ?? 0,
        totalLockLatencyMs: stats?.totalLockLatencyMs ?? 0,
      };
    }),
  ).map((team) => ({
    id: team.id,
    name: team.name,
    rank: team.rank,
    rankDelta: rankDeltaBetween(before, after, team.id),
    tied: team.tied,
    score: team.score,
    correctCount: team.correctCount,
    wrongCount: team.wrongCount,
    members: team.members ?? 0,
    segmentScore: team.score,
    timeBonus: team.timeBonus,
    earlyLockBonus: team.earlyLockBonus,
    bonusPoints: team.bonusPoints,
    totalLockLatencyMs: team.totalLockLatencyMs,
  }));
}

function winnersForSegments(
  teams: Array<{ id: string; name: string }>,
  answers: Array<{
    teamId: string;
    questionIndex: number;
    marks: number;
    correct: boolean | null;
    timeBonus?: number;
    earlyLockBonus?: number;
    lockLatencyMs?: number | null;
  }>,
  segments: number[],
  questionsPerSegment: number,
): ArenaSegmentWinner[] {
  const winners: ArenaSegmentWinner[] = [];
  for (const segment of segments) {
    const scores = segmentTeamScores(answers, segment, questionsPerSegment);
    const winner = pickArenaWinner(
      teams.map((team) => ({
        id: team.id,
        name: team.name,
        score: scores.get(team.id)?.score ?? 0,
        correctCount: scores.get(team.id)?.correctCount ?? 0,
        totalLockLatencyMs: scores.get(team.id)?.totalLockLatencyMs ?? 0,
      })),
    );
    if (winner) {
      winners.push({
        segment,
        id: winner.id,
        name: winner.name,
        score: winner.score,
      });
    }
  }
  return winners;
}

export function buildArenaBoard(args: {
  teams: Array<{
    id: string;
    name: string;
    score: number;
    correctCount: number;
    wrongCount: number;
    members?: number;
  }>;
  answers: Array<{
    teamId: string;
    questionIndex: number;
    marks: number;
    correct: boolean | null;
    timeBonus?: number;
    earlyLockBonus?: number;
    lockLatencyMs?: number | null;
  }>;
  currentIndex: number;
  status: string;
  questionsPerSegment: number;
  segmentCount: number;
  publishedThroughSegment?: number;
}) {
  const currentSeg = arenaSegmentOf(args.currentIndex, args.questionsPerSegment).segment;
  const currentScores = segmentTeamScores(args.answers, currentSeg, args.questionsPerSegment);
  const overallBonus = new Map<
    string,
    {
      timeBonus: number;
      earlyLockBonus: number;
      bonusPoints: number;
      totalLockLatencyMs: number;
    }
  >();
  for (const row of args.answers) {
    const current = overallBonus.get(row.teamId) ?? {
      timeBonus: 0,
      earlyLockBonus: 0,
      bonusPoints: 0,
      totalLockLatencyMs: 0,
    };
    const time = row.timeBonus ?? 0;
    const early = row.earlyLockBonus ?? 0;
    current.timeBonus += time;
    current.earlyLockBonus += early;
    current.bonusPoints += time + early;
    if (row.lockLatencyMs != null && row.lockLatencyMs >= 0) {
      current.totalLockLatencyMs += row.lockLatencyMs;
    }
    overallBonus.set(row.teamId, current);
  }

  const throughIndex =
    args.status === "lobby" || args.status === "draft"
      ? -1
      : args.status === "question"
        ? args.currentIndex - 1
        : args.currentIndex;
  const previousStandings = standingsThroughQuestion({
    teams: args.teams,
    answers: args.answers,
    throughIndex: throughIndex - 1,
  });
  const currentStandings = standingsThroughQuestion({
    teams: args.teams,
    answers: args.answers,
    throughIndex,
  });

  const rows: ArenaBoardRow[] = rankArenaTeams(
    args.teams.map((team) => {
      const bonus = overallBonus.get(team.id);
      return {
        id: team.id,
        name: team.name,
        score: team.score,
        correctCount: team.correctCount,
        wrongCount: team.wrongCount,
        members: team.members ?? 0,
        totalLockLatencyMs: bonus?.totalLockLatencyMs ?? 0,
        timeBonus: bonus?.timeBonus ?? 0,
        earlyLockBonus: bonus?.earlyLockBonus ?? 0,
        bonusPoints: bonus?.bonusPoints ?? 0,
      };
    }),
  ).map((team) => ({
    id: team.id,
    name: team.name,
    rank: team.rank,
    rankDelta: rankDeltaBetween(previousStandings, currentStandings, team.id),
    tied: team.tied,
    score: team.score,
    correctCount: team.correctCount,
    wrongCount: team.wrongCount,
    members: team.members ?? 0,
    segmentScore: currentScores.get(team.id)?.score ?? 0,
    timeBonus: team.timeBonus,
    earlyLockBonus: team.earlyLockBonus,
    bonusPoints: team.bonusPoints,
    totalLockLatencyMs: team.totalLockLatencyMs,
  }));

  const completed = completedArenaSegments({
    currentIndex: args.currentIndex,
    status: args.status,
    questionsPerSegment: args.questionsPerSegment,
    segmentCount: args.segmentCount,
  });
  const published = publicArenaSegments(
    args.publishedThroughSegment ?? (args.status === "complete" ? args.segmentCount - 1 : -1),
    args.segmentCount,
  );
  const allSegmentWinners = winnersForSegments(
    args.teams,
    args.answers,
    completed,
    args.questionsPerSegment,
  );
  const segmentWinners = winnersForSegments(
    args.teams,
    args.answers,
    published,
    args.questionsPerSegment,
  );
  const latestPublished = published.at(-1);
  const currentSegmentWinner =
    latestPublished != null
      ? (segmentWinners.find((row) => row.segment === latestPublished) ?? null)
      : null;
  const allSegmentBoards = [...new Set([...completed, currentSeg])]
    .sort((a, b) => a - b)
    .map((segment) => ({
      segment,
      rows: rankSegmentTeams({
        teams: args.teams,
        answers: args.answers,
        segment,
        questionsPerSegment: args.questionsPerSegment,
      }),
    }));
  const publishedSegmentBoards = published.map((segment) => ({
    segment,
    rows: rankSegmentTeams({
      teams: args.teams,
      answers: args.answers,
      segment,
      questionsPerSegment: args.questionsPerSegment,
    }),
  }));
  const segmentRows =
    latestPublished != null
      ? (publishedSegmentBoards.find((row) => row.segment === latestPublished)?.rows ?? [])
      : [];
  const leader = rows.find((row) => row.rank === 1) ?? rows[0] ?? null;
  const champion =
    args.status === "complete" && leader
      ? { id: leader.id, name: leader.name, score: leader.score }
      : null;
  return {
    rows,
    segmentRows,
    allSegmentBoards,
    publishedSegmentBoards,
    publishedSegment: latestPublished ?? null,
    segmentWinners,
    allSegmentWinners,
    currentSegmentWinner,
    champion,
  };
}
