export type CsvQuestion = {
  prompt: string;
  options: string[];
  correctIndexes: number[];
  multiSelect: boolean;
  subtopic: string;
  explanation: string;
};

const HEADER =
  "prompt,option_a,option_b,option_c,option_d,option_e,option_f,correct_answers,multi_select,tag,explanation";

/** Downloadable CSV template for question banks. */
export function questionCsvTemplate(): string {
  return [
    HEADER,
    '"What is 2 + 2?","1","2","3","4","","","B","false","Arithmetic","Basic addition"',
    '"Select prime numbers","2","3","4","9","","","A|B","true","Number theory","2 and 3 are prime"',
  ].join("\n");
}

export function downloadQuestionCsvTemplate() {
  const blob = new Blob([questionCsvTemplate()], { type: "text/csv;charset=utf-8" });
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

/** Parse a questions CSV into structured question forms. */
export function parseQuestionsCsv(text: string): { questions: CsvQuestion[]; errors: string[] } {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return { questions: [], errors: ["CSV is empty"] };

  const start = lines[0]!.toLowerCase().includes("prompt") ? 1 : 0;
  const questions: CsvQuestion[] = [];
  const errors: string[] = [];

  for (let i = start; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]!);
    const lineNo = i + 1;
    const prompt = row[0] ?? "";
    if (prompt.length < 4) {
      errors.push(`Row ${lineNo}: question prompt is too short`);
      continue;
    }
    const options = [row[1], row[2], row[3], row[4], row[5], row[6]]
      .map((value) => (value ?? "").trim())
      .filter(Boolean);
    if (options.length < 2) {
      errors.push(`Row ${lineNo}: need at least two options`);
      continue;
    }
    const multiSelect = ["true", "1", "yes", "y"].includes((row[8] ?? "false").trim().toLowerCase());
    const correctRaw = (row[7] ?? "").trim();
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
    if (!multiSelect && correctIndexes.length > 1) {
      errors.push(`Row ${lineNo}: multiple answers require multi_select=true`);
      continue;
    }
    questions.push({
      prompt,
      options,
      correctIndexes: multiSelect ? correctIndexes : [correctIndexes[0]!],
      multiSelect,
      subtopic: (row[9] ?? "general").trim() || "general",
      explanation: (row[10] ?? "").trim(),
    });
  }

  return { questions, errors };
}
