/** AWS-style papers mix single-answer and multi-answer items. */

const TRUE_TOKENS = new Set(["true", "1", "yes", "y", "t"]);
const SINGLE_TOKENS = new Set(["single", "single_select", "choose_one", "one", "radio"]);
const MULTI_TOKENS = new Set(["multi", "multi_select", "multiple", "ms", "checkbox", "select_all"]);

function token(raw: string | undefined): string {
  return (raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/**
 * Decide single vs multi-select.
 * Multiple correct answers imply multi-select (AWS “choose TWO”).
 * An explicit `single` type with more than one answer is an error.
 */
export function resolveMultiSelect(args: {
  correctCount: number;
  multiRaw?: string;
  typeRaw?: string;
}): { multiSelect: boolean; error?: string } {
  const type = token(args.typeRaw);
  if (SINGLE_TOKENS.has(type)) {
    if (args.correctCount > 1) {
      return {
        multiSelect: false,
        error: "question_type is single but multiple correct answers were given",
      };
    }
    return { multiSelect: false };
  }
  if (MULTI_TOKENS.has(type) || TRUE_TOKENS.has(token(args.multiRaw))) {
    return { multiSelect: true };
  }
  return { multiSelect: args.correctCount > 1 };
}
