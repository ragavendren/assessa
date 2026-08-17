import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveMultiSelect } from "./question-choice-mode.ts";

describe("resolveMultiSelect", () => {
  it("treats multiple correct answers as multi-select (AWS choose TWO)", () => {
    assert.deepEqual(resolveMultiSelect({ correctCount: 2 }), { multiSelect: true });
  });

  it("keeps a single correct answer as single-select", () => {
    assert.deepEqual(resolveMultiSelect({ correctCount: 1 }), { multiSelect: false });
  });

  it("honours explicit multi_select even with one answer", () => {
    assert.deepEqual(resolveMultiSelect({ correctCount: 1, multiRaw: "true" }), {
      multiSelect: true,
    });
  });

  it("honours question_type tokens", () => {
    assert.equal(resolveMultiSelect({ correctCount: 1, typeRaw: "multi" }).multiSelect, true);
    assert.equal(resolveMultiSelect({ correctCount: 1, typeRaw: "single" }).multiSelect, false);
  });

  it("errors when type is single but several answers are given", () => {
    const result = resolveMultiSelect({ correctCount: 2, typeRaw: "single" });
    assert.equal(result.multiSelect, false);
    assert.match(result.error ?? "", /single/i);
  });
});
