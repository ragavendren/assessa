import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePoolQuestionsCsv, poolQuestionCsvTemplate } from "./pool-questions-csv.ts";
import { parseQuestionsCsv } from "./questions-csv.ts";

describe("parsePoolQuestionsCsv", () => {
  it("parses the template as one single-select and one multi-select row", () => {
    const { questions, errors } = parsePoolQuestionsCsv(poolQuestionCsvTemplate());
    assert.deepEqual(errors, []);
    assert.equal(questions.length, 2);
    assert.equal(questions[0]?.multiSelect, false);
    assert.deepEqual(questions[0]?.correctIndexes, [1]);
    assert.equal(questions[1]?.multiSelect, true);
    assert.deepEqual(questions[1]?.correctIndexes, [0, 2]);
  });

  it("treats A|C as multi-select without multi_select=true", () => {
    const csv = [
      "prompt,option_a,option_b,option_c,option_d,correct_answers,topic,difficulty",
      "Which TWO apply?,ECS,RDS,EKS,S3,A|C,Compute,medium",
    ].join("\n");
    const { questions, errors } = parsePoolQuestionsCsv(csv);
    assert.deepEqual(errors, []);
    assert.equal(questions[0]?.multiSelect, true);
    assert.deepEqual(questions[0]?.correctIndexes, [0, 2]);
  });

  it("rejects question_type=single with multiple answers", () => {
    const csv = [
      "prompt,option_a,option_b,option_c,option_d,correct_answers,question_type",
      "Pick one,A1,A2,A3,A4,A|B,single",
    ].join("\n");
    const { questions, errors } = parsePoolQuestionsCsv(csv);
    assert.equal(questions.length, 0);
    assert.ok(errors.some((e) => /single/i.test(e)));
  });
});

describe("parseQuestionsCsv", () => {
  it("auto-detects multi-select from A|C when multi_select is blank", () => {
    const csv = [
      "prompt,option_a,option_b,option_c,option_d,option_e,option_f,correct_answers,multi_select,tag,explanation",
      "Which TWO?,ECS,Lambda,EKS,RDS,,,A|C,,Compute,containers",
    ].join("\n");
    const { questions, errors } = parseQuestionsCsv(csv);
    assert.deepEqual(errors, []);
    assert.equal(questions[0]?.multiSelect, true);
    assert.deepEqual(questions[0]?.correctIndexes, [0, 2]);
  });

  it("reads optional image filename or URL from the image column", () => {
    const csv = [
      "prompt,image,option_a,option_b,option_c,option_d,option_e,option_f,correct_answers,multi_select,tag,explanation",
      "What is shown?,pizza.svg,Taco,Pizza,Salad,Soup,,,B,false,Snacks,Friday classic",
    ].join("\n");
    const { questions, errors } = parseQuestionsCsv(csv);
    assert.deepEqual(errors, []);
    assert.equal(questions[0]?.imageRef, "pizza.svg");
    assert.deepEqual(questions[0]?.correctIndexes, [1]);
  });
});
