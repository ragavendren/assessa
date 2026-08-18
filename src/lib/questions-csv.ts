import { resolveMultiSelect } from "./question-choice-mode.ts";
import { resolveImageRef } from "./question-image-ref.ts";

export type CsvQuestion = {
  prompt: string;
  imageRef: string;
  options: string[];
  correctIndexes: number[];
  multiSelect: boolean;
  subtopic: string;
  explanation: string;
};

const HEADER =
  "prompt,image,option_a,option_b,option_c,option_d,option_e,option_f,correct_answers,multi_select,tag,explanation";

/** Downloadable CSV template for question banks. */
export function questionCsvTemplate(): string {
  return [
    HEADER,
    '"What is 2 + 2?","","1","2","3","4","","","B","false","Arithmetic","Basic addition"',
    '"Which shape is shown?","triangle.png","Circle","Triangle","Square","Hexagon","","","B","false","Geometry","Match the uploaded image filename"',
    '"Select prime numbers","","2","3","4","9","","","A|B","true","Number theory","2 and 3 are prime"',
  ].join("\n");
}

export function downloadQuestionCsvTemplate() {
  const blob = new Blob([questionCsvTemplate()], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "assessa-questions-template.csv";
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

function letterToIndex(token: string): number | null {
  const value = token.trim().toUpperCase();
  if (/^[A-F]$/.test(value)) return value.charCodeAt(0) - 65;
  if (/^[1-6]$/.test(value)) return Number(value) - 1;
  if (/^\d+$/.test(value)) {
    const n = Number(value);
    return n >= 0 && n <= 5 ? n : null;
  }
  return null;
}

function headerIndex(headers: string[], ...aliases: string[]) {
  const names = headers.map((h) => h.trim().toLowerCase());
  for (const alias of aliases) {
    const i = names.indexOf(alias);
    if (i >= 0) return i;
  }
  return -1;
}

function cell(row: string[], index: number) {
  return index >= 0 ? (row[index] ?? "").trim() : "";
}

/** Parse a questions CSV into structured question forms. */
export function parseQuestionsCsv(text: string): {
  questions: CsvQuestion[];
  errors: string[];
} {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return { questions: [], errors: ["CSV is empty"] };

  const first = parseCsvLine(lines[0]!);
  const hasHeader = first.some((cellValue) => cellValue.toLowerCase() === "prompt");
  const start = hasHeader ? 1 : 0;
  const headers = hasHeader ? first.map((value) => value.toLowerCase()) : [];
  const hasImageCol = headerIndex(headers, "image", "image_url", "prompt_image") >= 0;

  const promptIdx = hasHeader ? headerIndex(headers, "prompt", "question") : 0;
  const imageIdx = hasHeader ? headerIndex(headers, "image", "image_url", "prompt_image") : -1;
  const optionStart = hasImageCol ? 2 : 1;
  const optionIdx = hasHeader
    ? ["option_a", "option_b", "option_c", "option_d", "option_e", "option_f"].map((name) =>
        headerIndex(headers, name),
      )
    : [0, 1, 2, 3, 4, 5].map((i) => optionStart + i);
  const correctIdx = hasHeader
    ? headerIndex(headers, "correct_answers", "correct", "answer")
    : hasImageCol
      ? 8
      : 7;
  const multiIdx = hasHeader
    ? headerIndex(headers, "multi_select", "multiselect")
    : hasImageCol
      ? 9
      : 8;
  const tagIdx = hasHeader ? headerIndex(headers, "tag", "subtopic") : hasImageCol ? 10 : 9;
  const explanationIdx = hasHeader ? headerIndex(headers, "explanation") : hasImageCol ? 11 : 10;
  const typeIdx = hasHeader ? headerIndex(headers, "question_type", "type") : -1;

  const questions: CsvQuestion[] = [];
  const errors: string[] = [];

  for (let i = start; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]!);
    const lineNo = i + 1;
    const prompt = cell(row, promptIdx >= 0 ? promptIdx : 0);
    if (prompt.length < 4) {
      errors.push(`Row ${lineNo}: question prompt is too short`);
      continue;
    }
    const options = optionIdx.map((index) => (index >= 0 ? cell(row, index) : "")).filter(Boolean);
    if (options.length < 2) {
      errors.push(`Row ${lineNo}: need at least two options`);
      continue;
    }
    const correctRaw = cell(row, correctIdx);
    if (!correctRaw) {
      errors.push(`Row ${lineNo}: correct_answers is required (e.g. B or A|C)`);
      continue;
    }
    const correctIndexes = [
      ...new Set(
        correctRaw
          .split(/[|,;/]+/)
          .map(letterToIndex)
          .filter((value): value is number => value != null),
      ),
    ].filter((index) => index < options.length);
    if (correctIndexes.length === 0) {
      errors.push(`Row ${lineNo}: could not parse correct_answers "${correctRaw}"`);
      continue;
    }
    const mode = resolveMultiSelect({
      correctCount: correctIndexes.length,
      multiRaw: cell(row, multiIdx),
      typeRaw: cell(row, typeIdx),
    });
    if (mode.error) {
      errors.push(`Row ${lineNo}: ${mode.error}`);
      continue;
    }
    questions.push({
      prompt,
      imageRef: cell(row, imageIdx),
      options,
      correctIndexes: mode.multiSelect ? correctIndexes : [correctIndexes[0]!],
      multiSelect: mode.multiSelect,
      subtopic: cell(row, tagIdx) || "general",
      explanation: cell(row, explanationIdx),
    });
  }

  return { questions, errors };
}

export function csvImageUrl(imageRef: string, imageMap: Record<string, string>) {
  return resolveImageRef(imageRef, imageMap) ?? "";
}
