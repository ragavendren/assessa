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
  const done = completedArenaSegments({
    currentIndex: args.currentIndex,
    status: args.status,
    questionsPerSegment: args.questionsPerSegment,
    segmentCount: args.segmentCount,
  });
  const segmentWinners: ArenaSegmentWinner[] = [];
  for (const segment of done) {
    const scores = segmentTeamScores(args.answers, segment, args.questionsPerSegment);
    const winner = pickArenaWinner(
      args.teams.map((team) => ({
        id: team.id,
        name: team.name,
        score: scores.get(team.id)?.score ?? 0,
        correctCount: scores.get(team.id)?.correctCount ?? 0,
      })),
    );
    if (winner) {
      segmentWinners.push({
        segment,
        id: winner.id,
        name: winner.name,
        score: winner.score,
      });
    }
  }
  const currentSegmentWinner = done.includes(currentSeg)
    ? (segmentWinners.find((row) => row.segment === currentSeg) ?? null)
    : null;
  const leader = rows[0];
  const champion =
    args.status === "complete" && leader
      ? { id: leader.id, name: leader.name, score: leader.score }
      : null;
  return { rows, segmentWinners, currentSegmentWinner, champion };
}
