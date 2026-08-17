import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allowedTopicsOf,
  calendarStreakNext,
  careerDomains,
  defaultRulesFor,
  isoWeekKey,
  mergePlayRules,
  pickWithSeed,
  playScore,
  rewardXp,
  utcDateKey,
} from "./play.math.ts";

describe("period keys", () => {
  it("formats UTC date and ISO week", () => {
    const date = new Date("2026-08-17T08:00:00.000Z");
    assert.equal(utcDateKey(date), "2026-08-17");
    assert.equal(isoWeekKey(date), "2026-W34");
  });
});

describe("pickWithSeed", () => {
  it("is deterministic for the same seed", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
    assert.deepEqual(pickWithSeed(items, 4, "2026-08-17"), pickWithSeed(items, 4, "2026-08-17"));
    assert.notDeepEqual(pickWithSeed(items, 4, "2026-08-17"), pickWithSeed(items, 4, "2026-08-18"));
  });
});

describe("playScore", () => {
  it("adds remaining seconds when time bonus is on", () => {
    assert.deepEqual(playScore({ correctCount: 18, remainingSeconds: 42, timeBonus: true }), {
      score: 1842,
      timeBonus: 42,
    });
    assert.deepEqual(playScore({ correctCount: 18, remainingSeconds: 42, timeBonus: false }), {
      score: 1800,
      timeBonus: 0,
    });
  });
});

describe("careerDomains", () => {
  it("rolls subtopics into parent skill bars", () => {
    const domains = careerDomains([
      { topic: "Compute", subtopic: "Lambda", mastery: 90, answered: 10, correct: 9 },
      { topic: "Compute", subtopic: "EC2", mastery: 70, answered: 10, correct: 7 },
      { topic: "Security", subtopic: "IAM", mastery: 50, answered: 4, correct: 2 },
    ]);
    assert.equal(domains.find((d) => d.topic === "Compute")?.mastery, 80);
    assert.equal(domains.find((d) => d.topic === "Security")?.mastery, 50);
  });
});

describe("calendarStreakNext", () => {
  it("increments on consecutive days and resets after a gap", () => {
    assert.equal(calendarStreakNext("2026-08-16T12:00:00.000Z", 14, "2026-08-17").current, 15);
    assert.equal(calendarStreakNext("2026-08-14T12:00:00.000Z", 14, "2026-08-17").current, 1);
    assert.equal(calendarStreakNext("2026-08-17T01:00:00.000Z", 4, "2026-08-17").current, 4);
  });
});

describe("defaultRulesFor", () => {
  it("locks daily to 10 questions / 10 minutes / 100 XP", () => {
    const rules = defaultRulesFor("daily");
    assert.equal(rules.questionCount, 10);
    assert.equal(rules.durationSeconds, 600);
    assert.equal(rules.xpPoints, 100);
  });
});

describe("mergePlayRules", () => {
  it("overlays admin duration, XP, and topic allow-list", () => {
    const rules = mergePlayRules("daily", {
      questionCount: 12,
      durationSeconds: 480,
      xpPoints: 150,
      allowedTopics: ["IAM", "Lambda"],
    });
    assert.equal(rules.questionCount, 12);
    assert.equal(rules.durationSeconds, 480);
    assert.equal(rules.xpPoints, 150);
    assert.equal(rules.onePerPeriod, true);
    assert.deepEqual(allowedTopicsOf({ allowedTopics: ["IAM", " Lambda ", "IAM"] }), [
      "IAM",
      "Lambda",
    ]);
  });
});

describe("rewardXp", () => {
  it("maps XP prizes and ignores cosmetics", () => {
    assert.equal(rewardXp("xp_50"), 50);
    assert.equal(rewardXp("xp_100"), 100);
    assert.equal(rewardXp("badge"), 0);
  });
});
