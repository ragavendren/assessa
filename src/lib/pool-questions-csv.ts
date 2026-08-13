export type PoolCsvQuestion = {
  prompt: string;
  options: string[];
  correctIndexes: number[];
  multiSelect: boolean;
  topic: string;
  subtopic: string;
  difficulty: "easy" | "medium" | "hard";
  skill: string;
  tags: string[];
  explanation: string;
  marks: number;
};

const HEADER =
  "prompt,option_a,option_b,option_c,option_d,option_e,option_f,correct_answers,multi_select,topic,subtopic,difficulty,skill,tags,explanation,marks";

/** Separate from exam CSV — optional classification columns never fail import when absent. */
export function poolQuestionCsvTemplate(): string {
  return [
    HEADER,
    [
      "Which service provides serverless compute?",
      "EC2",
      "Lambda",
      "RDS",
      "S3",
      "",
      "",
      "B",
      "false",
      "Compute",
      "Lambda",
      "easy",
      "Serverless",
      "aws|compute",
      "Lambda runs code without servers",
      "1",
    ]
      .map(csvEscape)
      .join(","),
  ].join("\n");
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value) || value === "") {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadPoolQuestionCsvTemplate() {
  const blob = new Blob([poolQuestionCsvTemplate()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "assessa-pool-questions-template.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

/** Match exam CSV: A–F, or 1–6 (1-based), or 0–5 (0-based). */
function parseCorrect(raw: string): number[] {
  return raw
    .split(/[|,;/]/)
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean)
    .map((token) => {
      if (/^[A-F]$/.test(token)) return token.charCodeAt(0) - 65;
      if (/^[1-6]$/.test(token)) return Number(token) - 1;
      if (/^\d+$/.test(token)) {
        const n = Number(token);
        return n >= 0 && n <= 5 ? n : -1;
      }
      return -1;
    })
    .filter((n) => n >= 0 && n <= 5);
}

function parseDifficulty(raw: string): "easy" | "medium" | "hard" {
  const value = raw.trim().toLowerCase();
  if (value === "easy" || value === "hard" || value === "medium") return value;
  return "medium";
}

function normalizeHeader(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

type ColumnMap = {
  prompt: number;
  options: number[];
  correct: number;
  multi: number;
  topic: number;
  subtopic: number;
  difficulty: number;
  skill: number;
  tags: number;
  explanation: number;
  marks: number;
};

function buildColumnMap(headerCells: string[]): ColumnMap | null {
  const idx = new Map<string, number>();
  headerCells.forEach((cell, i) => {
    const key = normalizeHeader(cell);
    if (key) idx.set(key, i);
  });

  const find = (...names: string[]) => {
    for (const name of names) {
      const i = idx.get(name);
      if (i != null) return i;
    }
    return -1;
  };

  const prompt = find("prompt", "question", "question_prompt");
  if (prompt < 0) return null;

  const options = [
    find("option_a", "optiona", "a"),
    find("option_b", "optionb", "b"),
    find("option_c", "optionc", "c"),
    find("option_d", "optiond", "d"),
    find("option_e", "optione", "e"),
    find("option_f", "optionf", "f"),
  ].filter((i) => i >= 0);

  // Positional fallback when headers are present but options use option_1…
  if (options.length < 2) {
    for (let n = 1; n <= 6; n++) {
      const i = find(`option_${n}`, `option${n}`);
      if (i >= 0) options.push(i);
    }
  }

  return {
    prompt,
    options: options.length >= 2 ? options : [prompt + 1, prompt + 2, prompt + 3, prompt + 4],
    correct: find("correct_answers", "correct_answer", "correct", "answer", "answers"),
    multi: find("multi_select", "multiselect", "multi"),
    topic: find("topic", "tag", "category"),
    subtopic: find("subtopic", "sub_topic"),
    difficulty: find("difficulty", "diff"),
    skill: find("skill"),
    tags: find("tags", "tag_list"),
    explanation: find("explanation", "explain", "rationale"),
    marks: find("marks", "points", "score"),
  };
}

function positionalMap(): ColumnMap {
  // Legacy fixed layout (pool template / exam-like rows)
  return {
    prompt: 0,
    options: [1, 2, 3, 4, 5, 6],
    correct: 7,
    multi: 8,
    topic: 9,
    subtopic: 10,
    difficulty: 11,
    skill: 12,
    tags: 13,
    explanation: 14,
    marks: 15,
  };
}

function cell(row: string[], index: number): string {
  if (index < 0) return "";
  return (row[index] ?? "").trim();
}

/**
 * Parse pool bank CSV. Uses header names when present so Excel-saved files and
 * assessment CSVs (tag/explanation) still import. Missing classification columns default.
 */
export function parsePoolQuestionsCsv(text: string): {
  questions: PoolCsvQuestion[];
  errors: string[];
} {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return { questions: [], errors: ["CSV is empty"] };

  const firstCells = parseCsvLine(lines[0]!);
  const firstLower = firstCells.map(normalizeHeader);
  const hasHeader = firstLower.some(
    (h) => h === "prompt" || h === "question" || h.includes("option"),
  );

  let map: ColumnMap;
  let start = 0;
  if (hasHeader) {
    map = buildColumnMap(firstCells) ?? positionalMap();
    start = 1;
  } else {
    map = positionalMap();
  }

  // Exam CSV layout: prompt, options…, correct, multi, tag, explanation (no difficulty cols)
  if (hasHeader && map.explanation < 0 && map.topic >= 0 && map.subtopic < 0) {
    // tag column used as topic; next free column may be explanation under exam header "explanation"
    const expl = firstLower.indexOf("explanation");
    if (expl >= 0) map.explanation = expl;
  }

  const questions: PoolCsvQuestion[] = [];
  const errors: string[] = [];

  for (let i = start; i < lines.length; i++) {
    const lineNo = i + 1;
    const row = parseCsvLine(lines[i]!);
    const prompt = cell(row, map.prompt);
    if (prompt.length < 4) {
      errors.push(`Row ${lineNo}: question prompt is too short`);
      continue;
    }

    const options = map.options.map((oi) => cell(row, oi)).filter(Boolean);
    if (options.length < 2) {
      errors.push(`Row ${lineNo}: needs at least two options`);
      continue;
    }

    const correctRaw = cell(row, map.correct);
    const correctIndexes = parseCorrect(correctRaw);
    if (correctIndexes.length === 0) {
      errors.push(
        `Row ${lineNo}: missing/invalid correct answer (use A–F, 1–6, or 0–5; got “${correctRaw || "empty"}”)`,
      );
      continue;
    }
    const validCorrect = correctIndexes.filter((idx) => idx < options.length);
    if (validCorrect.length === 0) {
      errors.push(`Row ${lineNo}: correct answer does not match any option`);
      continue;
    }

    const multiSelect = cell(row, map.multi).toLowerCase().startsWith("t");
    const topic = cell(row, map.topic) || "general";
    // Exam CSV puts explanation where pool expects subtopic when using positional map —
    // prefer explicit explanation column; otherwise keep subtopic and leave explanation empty.
    let subtopic = cell(row, map.subtopic) || "general";
    let explanation = cell(row, map.explanation);
    if (map.explanation < 0 && map.subtopic >= 0 && !hasHeader) {
      // Pure positional exam-shaped row: col9=tag, col10=explanation
      if (row.length <= 11 && !cell(row, 11)) {
        subtopic = "general";
        explanation = cell(row, 10);
      }
    }

    const difficulty = parseDifficulty(cell(row, map.difficulty) || "medium");
    const skill = cell(row, map.skill);
    const tags = cell(row, map.tags)
      .split(/[|,;/]/)
      .map((t) => t.trim())
      .filter(Boolean);
    const marks = Math.max(1, Number(cell(row, map.marks) || "1") || 1);

    questions.push({
      prompt,
      options,
      correctIndexes: multiSelect ? validCorrect : [validCorrect[0]!],
      multiSelect,
      topic,
      subtopic: subtopic || "general",
      difficulty,
      skill,
      tags,
      explanation,
      marks,
    });
  }

  return { questions, errors };
}
