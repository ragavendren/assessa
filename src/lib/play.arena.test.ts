import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  arenaMarks,
  arenaSegmentOf,
  arenaTotalQuestions,
  buildArenaBoard,
  completedArenaSegments,
  pickArenaWinner,
  rankArenaTeams,
  segmentTeamScores,
} from "./play.arena.ts";

describe("arenaMarks", () => {
  it("awards positives, subtracts wrongs, and ignores blanks", () => {
    assert.equal(arenaMarks(true, true, 2, 1), 2);
    assert.equal(arenaMarks(true, false, 2, 1), -1);
    assert.equal(arenaMarks(false, false, 2, 1), 0);
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
  it("sums marks inside one segment", () => {
    const byTeam = segmentTeamScores(
      [
        { teamId: "a", questionIndex: 0, marks: 2, correct: true },
        { teamId: "a", questionIndex: 4, marks: 2, correct: true },
        { teamId: "b", questionIndex: 1, marks: -1, correct: false },
      ],
      0,
      4,
    );
    assert.equal(byTeam.get("a")?.score, 2);
    assert.equal(byTeam.get("b")?.score, -1);
  });
});

describe("buildArenaBoard", () => {
  it("exposes segment winners and the overall champion", () => {
    const board = buildArenaBoard({
      teams: [
        { id: "a", name: "Alpha", score: 6, correctCount: 3, wrongCount: 1 },
        { id: "b", name: "Beta", score: 8, correctCount: 4, wrongCount: 0 },
      ],
      answers: [
        { teamId: "a", questionIndex: 0, marks: 2, correct: true },
        { teamId: "a", questionIndex: 1, marks: 2, correct: true },
        { teamId: "a", questionIndex: 2, marks: 2, correct: true },
        { teamId: "a", questionIndex: 3, marks: 0, correct: false },
        { teamId: "b", questionIndex: 0, marks: 2, correct: true },
        { teamId: "b", questionIndex: 1, marks: 2, correct: true },
        { teamId: "b", questionIndex: 2, marks: 2, correct: true },
        { teamId: "b", questionIndex: 3, marks: 2, correct: true },
      ],
      currentIndex: 3,
      status: "complete",
      questionsPerSegment: 4,
      segmentCount: 1,
    });
    assert.equal(board.champion?.id, "b");
    assert.equal(board.currentSegmentWinner?.id, "b");
    assert.equal(board.rows[0]?.rank, 1);
  });
});
