import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allocateByWeightage,
  finalizeAllocations,
  selectQuestionsFromPool,
  type BlueprintRuleInput,
  type SelectablePoolQuestion,
} from "./question-selection.math.ts";

describe("allocateByWeightage", () => {
  it("sums exactly to total", () => {
    const counts = allocateByWeightage([25, 20, 15, 15, 10, 10, 5], 30);
    assert.equal(
      counts.reduce((a, b) => a + b, 0),
      30,
    );
    assert.deepEqual(counts, [8, 6, 5, 4, 3, 3, 1]);
  });

  it("handles empty weights", () => {
    assert.deepEqual(allocateByWeightage([], 10), []);
  });
});

describe("finalizeAllocations", () => {
  const rules: BlueprintRuleInput[] = [
    {
      topic: "Lambda",
      weightage: 25,
      easy_percentage: 20,
      medium_percentage: 60,
      hard_percentage: 20,
    },
    {
      topic: "DynamoDB",
      weightage: 20,
      easy_percentage: 20,
      medium_percentage: 60,
      hard_percentage: 20,
    },
    { topic: "S3", weightage: 15, easy_percentage: 20, medium_percentage: 60, hard_percentage: 20 },
    {
      topic: "API Gateway",
      weightage: 15,
      easy_percentage: 20,
      medium_percentage: 60,
      hard_percentage: 20,
    },
    {
      topic: "Security",
      weightage: 10,
      easy_percentage: 20,
      medium_percentage: 60,
      hard_percentage: 20,
    },
    {
      topic: "CI/CD",
      weightage: 10,
      easy_percentage: 20,
      medium_percentage: 60,
      hard_percentage: 20,
    },
    {
      topic: "Monitoring",
      weightage: 5,
      easy_percentage: 20,
      medium_percentage: 60,
      hard_percentage: 20,
    },
  ];

  it("totals requested question count", () => {
    const alloc = finalizeAllocations(rules, 30);
    assert.equal(
      alloc.reduce((s, a) => s + a.count, 0),
      30,
    );
  });

  it("rejects non-100 weightage", () => {
    assert.throws(() => finalizeAllocations([{ ...rules[0]!, weightage: 50 }], 10));
  });
});

describe("selectQuestionsFromPool", () => {
  it("selects without shortage when inventory is enough", () => {
    const eligible: SelectablePoolQuestion[] = [];
    for (let i = 0; i < 20; i++) {
      eligible.push({
        id: `q-${i}`,
        topic: "Lambda",
        subtopic: "general",
        difficulty: i % 3 === 0 ? "easy" : i % 3 === 1 ? "medium" : "hard",
      });
    }
    const result = selectQuestionsFromPool({
      allocations: [
        {
          topic: "Lambda",
          subtopic: null,
          count: 8,
          weightage: 100,
          easy_percentage: 20,
          medium_percentage: 60,
          hard_percentage: 20,
          difficulties: { easy: 2, medium: 5, hard: 1 },
        },
      ],
      eligible,
      random: () => 0.5,
    });
    assert.equal(result.selectedIds.length, 8);
    assert.equal(result.shortages.length, 0);
  });

  it("reports shortage when pool is exhausted", () => {
    const eligible: SelectablePoolQuestion[] = [
      { id: "a", topic: "Lambda", subtopic: "general", difficulty: "medium" },
      { id: "b", topic: "Lambda", subtopic: "general", difficulty: "medium" },
    ];
    const result = selectQuestionsFromPool({
      allocations: [
        {
          topic: "Lambda",
          subtopic: null,
          count: 5,
          weightage: 100,
          easy_percentage: 20,
          medium_percentage: 60,
          hard_percentage: 20,
          difficulties: { easy: 1, medium: 3, hard: 1 },
        },
      ],
      eligible,
      random: () => 0.1,
    });
    assert.ok(result.shortages.length > 0);
    assert.ok(result.selectedIds.length < 5);
  });
});
