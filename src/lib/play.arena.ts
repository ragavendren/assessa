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

export function remainingSecondsAt(
  lockedAt: string | null | undefined,
  questionEndsAt: string | null,
) {
  if (!lockedAt || !questionEndsAt) return 0;
  return Math.max(0, Math.round((Date.parse(questionEndsAt) - Date.parse(lockedAt)) / 1000));
}

export function arenaSpeedBonuses(args: {
  correct: boolean;
  remainingSeconds: number;
  durationSeconds: number;
  timeBonusMax: number;
  earlyLockBonus: number;
}): { timeBonus: number; earlyLockBonus: number } {
  if (!args.correct) return { timeBonus: 0, earlyLockBonus: 0 };
  const duration = Math.max(1, args.durationSeconds);
  const remaining = Math.max(0, Math.min(duration, args.remainingSeconds));
  const timeBonus =
    args.timeBonusMax > 0 ? Math.round((args.timeBonusMax * remaining) / duration) : 0;
  const earlyLockBonus =
    args.earlyLockBonus > 0 && remaining * 2 >= duration ? args.earlyLockBonus : 0;
  return { timeBonus, earlyLockBonus };
}

export function arenaQuestionMarks(args: {
  answered: boolean;
  correct: boolean;
  correctMarks: number;
  wrongMarks: number;
  remainingSeconds: number;
  durationSeconds: number;
  timeBonusMax: number;
  earlyLockBonus: number;
}): { marks: number; timeBonus: number; earlyLockBonus: number } {
  const base = arenaMarks(args.answered, args.correct, args.correctMarks, args.wrongMarks);
  const speed = arenaSpeedBonuses({
    correct: args.answered && args.correct,
    remainingSeconds: args.remainingSeconds,
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

export function pickArenaWinner<T extends { id: string; score: number; correctCount: number }>(
  teams: T[],
): T | null {
  if (teams.length === 0) return null;
  return rankArenaTeams(teams)[0] ?? null;
}

export function rankArenaTeams<T extends { id: string; score: number; correctCount: number }>(
  teams: T[],
): Array<T & { rank: number }> {
  return [...teams]
    .sort(
      (a, b) => b.score - a.score || b.correctCount - a.correctCount || a.id.localeCompare(b.id),
    )
    .map((team, index) => ({ ...team, rank: index + 1 }));
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
  T extends { teamId: string; questionIndex: number; marks: number; correct: boolean | null },
>(answers: T[], segment: number, questionsPerSegment: number) {
  const { start, end } = segmentQuestionRange(segment, questionsPerSegment);
  const byTeam = new Map<string, { score: number; correctCount: number }>();
  for (const row of answers) {
    if (row.questionIndex < start || row.questionIndex >= end) continue;
    const current = byTeam.get(row.teamId) ?? { score: 0, correctCount: 0 };
    current.score += row.marks;
    if (row.correct) current.correctCount += 1;
    byTeam.set(row.teamId, current);
  }
  return byTeam;
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
  score: number;
  correctCount: number;
  wrongCount: number;
  members: number;
  segmentScore: number;
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
  answers: Array<{ teamId: string; questionIndex: number; marks: number; correct: boolean | null }>;
  segment: number;
  questionsPerSegment: number;
}): ArenaBoardRow[] {
  const scores = segmentTeamScores(args.answers, args.segment, args.questionsPerSegment);
  return rankArenaTeams(
    args.teams.map((team) => ({
      id: team.id,
      name: team.name,
      score: scores.get(team.id)?.score ?? 0,
      correctCount: scores.get(team.id)?.correctCount ?? 0,
      wrongCount: 0,
      members: team.members ?? 0,
    })),
  ).map((team) => ({
    id: team.id,
    name: team.name,
    rank: team.rank,
    score: team.score,
    correctCount: team.correctCount,
    wrongCount: team.wrongCount,
    members: team.members ?? 0,
    segmentScore: team.score,
  }));
}

function winnersForSegments(
  teams: Array<{ id: string; name: string }>,
  answers: Array<{ teamId: string; questionIndex: number; marks: number; correct: boolean | null }>,
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
  answers: Array<{ teamId: string; questionIndex: number; marks: number; correct: boolean | null }>;
  currentIndex: number;
  status: string;
  questionsPerSegment: number;
  segmentCount: number;
  publishedThroughSegment?: number;
}) {
  const currentSeg = arenaSegmentOf(args.currentIndex, args.questionsPerSegment).segment;
  const currentScores = segmentTeamScores(args.answers, currentSeg, args.questionsPerSegment);
  const rows: ArenaBoardRow[] = rankArenaTeams(args.teams).map((team) => ({
    id: team.id,
    name: team.name,
    rank: team.rank,
    score: team.score,
    correctCount: team.correctCount,
    wrongCount: team.wrongCount,
    members: team.members ?? 0,
    segmentScore: currentScores.get(team.id)?.score ?? 0,
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
  const segmentRows =
    latestPublished != null
      ? rankSegmentTeams({
          teams: args.teams,
          answers: args.answers,
          segment: latestPublished,
          questionsPerSegment: args.questionsPerSegment,
        })
      : [];
  const leader = rows[0];
  const champion =
    args.status === "complete" && leader
      ? { id: leader.id, name: leader.name, score: leader.score }
      : null;
  return {
    rows,
    segmentRows,
    publishedSegment: latestPublished ?? null,
    segmentWinners,
    allSegmentWinners,
    currentSegmentWinner,
    champion,
  };
}
