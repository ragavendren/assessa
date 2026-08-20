import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  arenaMarks,
  arenaSpeedBonuses,
  arenaSegmentOf,
  arenaTotalQuestions,
  buildArenaBoard,
  canPublishArenaSegment,
  coerceAnswerBonuses,
  completedArenaSegments,
  pickArenaWinner,
  pickExclusiveFirstLockWinner,
  rankArenaTeams,
  remainingMsAt,
  segmentTeamScores,
} from "./play.arena.ts";

describe("arenaMarks", () => {
  it("awards positives, subtracts wrongs, and ignores blanks", () => {
    assert.equal(arenaMarks(true, true, 2, 1), 2);
    assert.equal(arenaMarks(true, false, 2, 1), -1);
    assert.equal(arenaMarks(false, false, 2, 1), 0);
  });
});

describe("coerceAnswerBonuses", () => {
  it("recovers time bonus when marks include it but columns are zero", () => {
    assert.deepEqual(
      coerceAnswerBonuses({
        correct: true,
        marks: 5,
        timeBonus: 0,
        earlyLockBonus: 0,
        correctMarks: 4,
        earlyLockBonusMax: 0,
      }),
      { timeBonus: 1, earlyLockBonus: 0 },
    );
  });
});

describe("rankArenaTeams", () => {
  it("shares place on full ties and breaks ties by correct then speed", () => {
    const ranked = rankArenaTeams([
      { id: "a", score: 10, correctCount: 2, totalLockLatencyMs: 900 },
      { id: "b", score: 10, correctCount: 3, totalLockLatencyMs: 1200 },
      { id: "c", score: 10, correctCount: 2, totalLockLatencyMs: 400 },
      { id: "d", score: 8, correctCount: 1, totalLockLatencyMs: 100 },
    ]);
    assert.equal(ranked[0]?.id, "b");
    assert.equal(ranked[0]?.rank, 1);
    assert.equal(ranked[1]?.id, "c");
    assert.equal(ranked[1]?.rank, 2);
    assert.equal(ranked[2]?.id, "a");
    assert.equal(ranked[2]?.rank, 3);
    assert.equal(ranked[3]?.rank, 4);

    const tied = rankArenaTeams([
      { id: "x", score: 12, correctCount: 3, totalLockLatencyMs: 500 },
      { id: "y", score: 12, correctCount: 3, totalLockLatencyMs: 500 },
      { id: "z", score: 9, correctCount: 2, totalLockLatencyMs: 100 },
    ]);
    assert.equal(tied[0]?.rank, 1);
    assert.equal(tied[1]?.rank, 1);
    assert.equal(tied[0]?.tied, true);
    assert.equal(tied[2]?.rank, 3);
  });
});

describe("arenaSpeedBonuses", () => {
  it("scales time bonus by remaining ms and only pays early lock when awarded", () => {
    assert.deepEqual(
      arenaSpeedBonuses({
        correct: true,
        remainingMs: 30_000,
        durationSeconds: 30,
        timeBonusMax: 4,
        earlyLockBonus: 1,
      }),
      { timeBonus: 4, earlyLockBonus: 1 },
    );
    assert.deepEqual(
      arenaSpeedBonuses({
        correct: true,
        remainingMs: 10_000,
        durationSeconds: 30,
        timeBonusMax: 3,
        earlyLockBonus: 0,
      }),
      { timeBonus: 1, earlyLockBonus: 0 },
    );
    assert.deepEqual(
      arenaSpeedBonuses({
        correct: false,
        remainingMs: 30_000,
        durationSeconds: 30,
        timeBonusMax: 4,
        earlyLockBonus: 1,
      }),
      { timeBonus: 0, earlyLockBonus: 0 },
    );
  });
});

describe("pickExclusiveFirstLockWinner", () => {
  it("picks the earliest correct lock with deterministic ties", () => {
    assert.equal(
      pickExclusiveFirstLockWinner([
        { teamId: "b", firstLockedAt: "2026-08-20T10:00:00.200Z" },
        { teamId: "a", firstLockedAt: "2026-08-20T10:00:00.100Z" },
        { teamId: "c", firstLockedAt: "2026-08-20T10:00:00.100Z" },
      ]),
      "a",
    );
    assert.equal(pickExclusiveFirstLockWinner([{ teamId: "a", firstLockedAt: null }]), null);
  });
});

describe("remainingMsAt", () => {
  it("uses millisecond precision", () => {
    assert.equal(remainingMsAt("2026-08-20T10:00:00.250Z", "2026-08-20T10:00:30.000Z"), 29_750);
  });
});

describe("arenaSegmentOf", () => {
  it("maps a flat index into segment and offset", () => {
    assert.deepEqual(arenaSegmentOf(0, 4), { segment: 0, offset: 0 });
    assert.deepEqual(arenaSegmentOf(4, 4), { segment: 1, offset: 0 });
    assert.deepEqual(arenaSegmentOf(6, 4), { segment: 1, offset: 2 });
  });
});

describe("arenaTotalQuestions", () => {
  it("multiplies segments by questions per segment", () => {
    assert.equal(arenaTotalQuestions(3, 4), 12);
  });
});

describe("pickArenaWinner", () => {
  it("prefers score then correct count", () => {
    const winner = pickArenaWinner([
      { id: "a", score: 8, correctCount: 5 },
      { id: "b", score: 10, correctCount: 4 },
      { id: "c", score: 10, correctCount: 6 },
    ]);
    assert.equal(winner?.id, "c");
  });
});

describe("rankArenaTeams", () => {
  it("assigns dense ranks in score order", () => {
    const ranked = rankArenaTeams([
      { id: "a", score: 4, correctCount: 2 },
      { id: "b", score: 10, correctCount: 5 },
    ]);
    assert.equal(ranked[0]?.id, "b");
    assert.equal(ranked[0]?.rank, 1);
    assert.equal(ranked[1]?.rank, 2);
  });
});

describe("canPublishArenaSegment", () => {
  it("allows publish only after the last question of an unpublished segment is revealed", () => {
    assert.equal(
      canPublishArenaSegment({
        currentIndex: 3,
        status: "revealed",
        questionsPerSegment: 4,
        segmentCount: 3,
        publishedThroughSegment: -1,
      }),
      true,
    );
    assert.equal(
      canPublishArenaSegment({
        currentIndex: 2,
        status: "revealed",
        questionsPerSegment: 4,
        segmentCount: 3,
        publishedThroughSegment: -1,
      }),
      false,
    );
  });
});

describe("completedArenaSegments", () => {
  it("closes a segment only after its last question is revealed", () => {
    assert.deepEqual(
      completedArenaSegments({
        currentIndex: 3,
        status: "revealed",
        questionsPerSegment: 4,
        segmentCount: 3,
      }),
      [0],
    );
    assert.deepEqual(
      completedArenaSegments({
        currentIndex: 4,
        status: "question",
        questionsPerSegment: 4,
        segmentCount: 3,
      }),
      [0],
    );
    assert.deepEqual(
      completedArenaSegments({
        currentIndex: 11,
        status: "complete",
        questionsPerSegment: 4,
        segmentCount: 3,
      }),
      [0, 1, 2],
    );
  });
});

describe("segmentTeamScores", () => {
  it("sums marks and tracks wrong/bonus inside one segment", () => {
    const byTeam = segmentTeamScores(
      [
        { teamId: "a", questionIndex: 0, marks: 3, correct: true, timeBonus: 1, earlyLockBonus: 0 },
        { teamId: "a", questionIndex: 4, marks: 2, correct: true },
        { teamId: "b", questionIndex: 1, marks: -1, correct: false },
      ],
      0,
      4,
    );
    assert.equal(byTeam.get("a")?.score, 3);
    assert.equal(byTeam.get("a")?.bonusPoints, 1);
    assert.equal(byTeam.get("b")?.score, -1);
    assert.equal(byTeam.get("b")?.wrongCount, 1);
  });
});

describe("buildArenaBoard", () => {
  it("exposes segment winners, overall champion, and bonus columns", () => {
    const board = buildArenaBoard({
      teams: [
        { id: "a", name: "Alpha", score: 6, correctCount: 3, wrongCount: 1 },
        { id: "b", name: "Beta", score: 8, correctCount: 4, wrongCount: 0 },
      ],
      answers: [
        {
          teamId: "a",
          questionIndex: 0,
          marks: 2,
          correct: true,
          timeBonus: 0,
          earlyLockBonus: 0,
        },
        { teamId: "a", questionIndex: 1, marks: 2, correct: true },
        { teamId: "a", questionIndex: 2, marks: 2, correct: true },
        { teamId: "a", questionIndex: 3, marks: 0, correct: false },
        {
          teamId: "b",
          questionIndex: 0,
          marks: 3,
          correct: true,
          timeBonus: 1,
          earlyLockBonus: 0,
        },
        { teamId: "b", questionIndex: 1, marks: 2, correct: true },
        { teamId: "b", questionIndex: 2, marks: 2, correct: true },
        { teamId: "b", questionIndex: 3, marks: 2, correct: true },
      ],
      currentIndex: 3,
      status: "complete",
      questionsPerSegment: 4,
      segmentCount: 1,
      publishedThroughSegment: 0,
    });
    assert.equal(board.champion?.id, "b");
    assert.equal(board.currentSegmentWinner?.id, "b");
    assert.equal(board.rows[0]?.rank, 1);
    assert.equal(board.rows[0]?.bonusPoints, 1);
    assert.equal(board.allSegmentBoards.length, 1);
  });

  it("keeps unpublished segment standings off the public board", () => {
    const board = buildArenaBoard({
      teams: [
        { id: "a", name: "Alpha", score: 4, correctCount: 2, wrongCount: 0 },
        { id: "b", name: "Beta", score: 2, correctCount: 1, wrongCount: 1 },
      ],
      answers: [
        { teamId: "a", questionIndex: 0, marks: 2, correct: true },
        { teamId: "a", questionIndex: 1, marks: 2, correct: true },
        { teamId: "b", questionIndex: 0, marks: 2, correct: true },
        { teamId: "b", questionIndex: 1, marks: 0, correct: false },
      ],
      currentIndex: 1,
      status: "revealed",
      questionsPerSegment: 2,
      segmentCount: 2,
      publishedThroughSegment: -1,
    });
    assert.equal(board.segmentWinners.length, 0);
    assert.equal(board.allSegmentWinners[0]?.id, "a");
    assert.equal(board.segmentRows.length, 0);
  });
});
