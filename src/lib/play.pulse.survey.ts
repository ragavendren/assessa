/**
 * Parse pasted survey text or JSON into Pulse slides.
 * Supports the office-experience survey style (numbered Qs, scales, options, matrices).
 */
import type { PulseSlideInput, PulseSlideType } from "@/lib/play.pulse";

/** Match ASCII hyphen or en-dash between scale bounds. */
const DASH = "[-\\u2013]";
const SCALE_HINT = new RegExp(`scale\\s*:\\s*1\\s*${DASH}\\s*(\\d+)`, "i");
const SCALE_RANGE = new RegExp(`\\b1\\s*${DASH}\\s*(\\d+)\\b`);
const MULTI_HINT = /select all that apply/i;
const OPEN_HINT = /open[- ]?ended|free[- ]?text|comments?/i;
const MATRIX_AREA = /^area\b/i;
const SECTION_LINE = /^(?:#{1,3}\s*)?section\s+\d+/i;
const NUMBERED = /^(\d+)[.)]\s*(.+)$/;
const OPTION_BULLET = /^(?:[-*\u2022\u2610\u2611]|\u25CB)\s*(.+)$/;
const MD_TITLE = /^#\s+(.+)$/;
const MD_SECTION = /^##\s+(.+)$/;
const LIKERT_5 = new RegExp(`1\\s*${DASH}\\s*poor[\\s\\S]*5\\s*${DASH}\\s*excellent`, "i");

function cleanLine(line: string) {
  return line
    .replace(/\u00a0/g, " ")
    .replace(/\*\*/g, "")
    .trim();
}

function isLikelyOption(line: string) {
  if (!line) return false;
  if (NUMBERED.test(line)) return false;
  if (SECTION_LINE.test(line)) return false;
  if (MD_SECTION.test(line) || MD_TITLE.test(line)) return false;
  if (MATRIX_AREA.test(line)) return false;
  if (/^introduction$/i.test(line)) return false;
  if (/^employee\b/i.test(line) && line.length < 80) return false;
  if (SCALE_HINT.test(line) || SCALE_RANGE.test(line)) return false;
  if (MULTI_HINT.test(line) || OPEN_HINT.test(line)) return false;
  if (new RegExp(`^\\d+\\s*${DASH}\\s*(poor|average|excellent)`, "i").test(line)) return false;
  if (/^(poor|average|excellent)\b/i.test(line) && line.length < 40) return false;
  return line.length <= 120;
}

function extractOptions(block: string[]): string[] {
  const options: string[] = [];
  for (const raw of block) {
    const line = cleanLine(raw);
    if (!line) continue;
    const bullet = line.match(OPTION_BULLET);
    const text = (bullet?.[1] ?? line).trim();
    if (!isLikelyOption(text)) continue;
    if (/^[1-5]$/.test(text)) continue;
    options.push(text.replace(/\s*_{3,}.*$/, "").trim());
  }
  return [...new Set(options.filter(Boolean))];
}

function detectRatingMax(block: string[], prompt: string): number | null {
  const blob = `${prompt}\n${block.join("\n")}`;
  if (LIKERT_5.test(blob)) return 5;
  const m =
    blob.match(SCALE_HINT) || blob.match(new RegExp(`scale:\\s*1\\s*${DASH}\\s*(\\d+)`, "i"));
  if (m?.[1]) return Math.min(10, Math.max(2, Number(m[1])));
  if (
    /how happy|overall experience|productivity/i.test(prompt) &&
    new RegExp(`1\\s*${DASH}\\s*10|scale:\\s*1`, "i").test(blob)
  ) {
    return 10;
  }
  if (
    new RegExp(`\\bscale:\\s*1\\s*${DASH}\\s*10\\b`, "i").test(blob) ||
    new RegExp(`\\b1\\s*${DASH}\\s*10\\b`).test(blob)
  ) {
    return 10;
  }
  if (new RegExp(`\\bscale:\\s*1\\s*${DASH}\\s*5\\b`, "i").test(blob)) return 5;
  // Individual facility ratings: "How would you rate the …" + 1–5 labels
  if (
    /how would you rate (the |your )/i.test(prompt) &&
    new RegExp(`1\\s*${DASH}\\s*poor`, "i").test(blob)
  ) {
    return 5;
  }
  return null;
}

function looksLikeMatrix(block: string[]): boolean {
  const joined = block.join("\n");
  if (MATRIX_AREA.test(joined)) return true;
  // Only treat as matrix when there are multiple aspect rows, not a single 1–5 scale question.
  const rows = extractMatrixRows(block);
  if (
    rows.length >= 2 &&
    /workstations|ergonomics|wi-?fi|restrooms|ambience/i.test(joined) &&
    new RegExp(`1\\s*${DASH}\\s*5|poor|excellent`, "i").test(joined)
  ) {
    return true;
  }
  return false;
}

function extractMatrixRows(block: string[]): string[] {
  const rows: string[] = [];
  for (const raw of block) {
    const line = cleanLine(raw);
    if (!line) continue;
    if (MATRIX_AREA.test(line)) continue;
    if (/^[1-5]$/.test(line)) continue;
    if (new RegExp(`^[1-5]\\s*${DASH}`).test(line)) continue;
    if (/^(poor|average|excellent)\b/i.test(line)) continue;
    if (/^\u25CB+$/.test(line.replace(/\s/g, ""))) continue;
    if (line.includes("\u25CB") && line.length < 20) continue;
    if (OPTION_BULLET.test(line)) continue;
    if (NUMBERED.test(line) || SECTION_LINE.test(line)) continue;
    if (line.length > 80) continue;
    rows.push(line);
  }
  return [...new Set(rows)];
}

function classifyQuestion(prompt: string, block: string[]): PulseSlideInput {
  const options = extractOptions(block);
  const ratingMax = detectRatingMax(block, prompt);
  const multi = MULTI_HINT.test(`${prompt}\n${block.join("\n")}`);
  const open = OPEN_HINT.test(`${prompt}\n${block.join("\n")}`);

  if (looksLikeMatrix(block)) {
    const rows = extractMatrixRows(block);
    if (rows.length >= 2) {
      return {
        type: "matrix",
        prompt,
        options: rows,
        ratingMax: ratingMax ?? 5,
      };
    }
  }

  if (open && options.length < 2) {
    return { type: "text", prompt, options: [], ratingMax: 5 };
  }

  if (ratingMax && options.length < 2) {
    return { type: "rating", prompt, options: [], ratingMax };
  }

  if (multi && options.length >= 2) {
    return { type: "multi", prompt, options, ratingMax: 5 };
  }

  if (options.length >= 2) {
    return { type: "mcq", prompt, options, ratingMax: 5 };
  }

  if (ratingMax) {
    return { type: "rating", prompt, options: [], ratingMax };
  }

  return { type: "text", prompt, options: [], ratingMax: 5 };
}

/** Parse JSON array of slides or a { name?, slides } object. */
function parseJsonSurvey(raw: string): { name?: string; slides: PulseSlideInput[] } | null {
  try {
    const data = JSON.parse(raw) as unknown;
    if (Array.isArray(data)) {
      const slides = data
        .map((row) => normalizeJsonSlide(row))
        .filter((s): s is PulseSlideInput => Boolean(s));
      return slides.length ? { slides } : null;
    }
    if (data && typeof data === "object") {
      const obj = data as { name?: string; title?: string; slides?: unknown[] };
      const slides = (obj.slides ?? [])
        .map((row) => normalizeJsonSlide(row))
        .filter((s): s is PulseSlideInput => Boolean(s));
      if (!slides.length) return null;
      const title = obj.name || obj.title;
      return title ? { name: title, slides } : { slides };
    }
  } catch {
    return null;
  }
  return null;
}

function normalizeJsonSlide(row: unknown): PulseSlideInput | null {
  if (!row || typeof row !== "object") return null;
  const s = row as Record<string, unknown>;
  const type = String(s["type"] ?? "text") as PulseSlideType;
  const allowed: PulseSlideType[] = ["mcq", "multi", "text", "rating", "matrix", "section"];
  if (!allowed.includes(type)) return null;
  const prompt = String(s["prompt"] ?? s["question"] ?? "").trim();
  if (!prompt) return null;
  const options = Array.isArray(s["options"])
    ? s["options"].map((o) => String(o).trim()).filter(Boolean)
    : Array.isArray(s["rows"])
      ? s["rows"].map((o) => String(o).trim()).filter(Boolean)
      : [];
  const ratingMax = Number(s["ratingMax"] ?? s["rating_max"] ?? (type === "rating" ? 5 : 5));
  const imageRaw = s["imageUrl"];
  const slide: PulseSlideInput = {
    type,
    prompt,
    options,
    ratingMax: Number.isFinite(ratingMax) ? Math.min(10, Math.max(2, ratingMax)) : 5,
  };
  if (typeof imageRaw === "string" && imageRaw.trim()) {
    slide.imageUrl = imageRaw.trim();
  }
  return slide;
}

/**
 * Import survey from JSON or plain-text outline.
 * Returns suggested pulse name + slides.
 */
export function parsePulseSurveyImport(raw: string): {
  name?: string;
  slides: PulseSlideInput[];
  warnings: string[];
} {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) return { slides: [], warnings: ["Empty import."] };

  const asCsv = parsePulseSurveyCsv(text);
  if (asCsv && asCsv.slides.length) {
    return { name: asCsv.name, slides: asCsv.slides, warnings: asCsv.warnings };
  }

  const asJson = parseJsonSurvey(text);
  if (asJson) {
    return { name: asJson.name, slides: asJson.slides.slice(0, 60), warnings: [] };
  }

  const lines = text.split(/\r?\n/).map(cleanLine);
  const warnings: string[] = [];
  let name: string | undefined;
  const slides: PulseSlideInput[] = [];

  // Title = # Heading, or first short line before Section/1.
  for (const line of lines.slice(0, 8)) {
    if (!line) continue;
    const mdTitle = line.match(MD_TITLE);
    if (mdTitle) {
      name = mdTitle[1]!.trim();
      break;
    }
    if (/^introduction$/i.test(line) || SECTION_LINE.test(line) || NUMBERED.test(line)) break;
    if (line.length >= 4 && line.length <= 120 && !line.startsWith("#")) {
      name = line;
      break;
    }
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";

    const mdSection = line.match(MD_SECTION);
    if (mdSection || SECTION_LINE.test(line)) {
      const prompt = (mdSection?.[1] ?? line.replace(/^#+\s*/, "")).trim();
      slides.push({
        type: "section",
        prompt,
        options: [],
        ratingMax: 5,
      });
      i += 1;
      continue;
    }

    const numbered = line.match(NUMBERED);
    if (numbered) {
      const prompt = numbered[2]!.trim();
      const block: string[] = [];
      i += 1;
      while (i < lines.length) {
        const next = lines[i] ?? "";
        if (NUMBERED.test(next) || SECTION_LINE.test(next) || MD_SECTION.test(next)) break;
        block.push(next);
        i += 1;
      }
      slides.push(classifyQuestion(prompt, block));
      continue;
    }
    i += 1;
  }

  if (!slides.length) {
    warnings.push(
      "No numbered questions found. Use markdown (**1. …**) or plain 1. Question… / CSV / JSON.",
    );
  }

  const cleaned = slides.filter((s) => s.prompt.trim().length > 0).slice(0, 80);
  return { name, slides: cleaned, warnings };
}

/** Short UI bullets explaining how to fill the downloadable template. */
export const PULSE_SURVEY_TEMPLATE_INSTRUCTIONS = [
  "Self-paced mode (default): after Host starts the session, participants move section-by-section with Next — no admin slide control.",
  "TXT/Markdown: # title, ## Section N — …, **1. Question**, * options. Rating: Scale: 1–10 or 1–Poor … 5–Excellent. Multi: Select all that apply. Open text: Open-ended.",
  "CSV columns: section,type,prompt,options,rating_max. Separate options with | (pipe). Types: section | mcq | multi | text | rating | matrix.",
  'JSON: { "name", "slides": [{ "type", "prompt", "options", "ratingMax" }] }.',
  "Facility ratings are individual 1–5 questions (not one matrix). Download TXT, CSV, or JSON, then paste or upload. Max 80 slides.",
] as const;

type TemplateSlide = {
  section: string;
  type: PulseSlideType;
  prompt: string;
  options?: string[];
  ratingMax?: number;
};

/** Canonical office survey used by TXT / CSV / JSON downloads. */
function officeExperienceSlides(): TemplateSlide[] {
  const s1 = "Section 1 — Overall Experience";
  const s2 = "Section 2 — Productivity & Work Experience";
  const s3 = "Section 3 — Team & Workplace Experience";
  const s4 = "Section 4 — Workspace & Facilities";
  const s5 = "Section 5 — Improvement & Suggestions";

  const facilityRatings: Array<[string, string]> = [
    ["11", "How would you rate the seating and workstations at the office?"],
    ["12", "How would you rate the chairs and ergonomics at the office?"],
    ["13", "How would you rate the internet / Wi-Fi at the office?"],
    ["14", "How would you rate the air conditioning and temperature at the office?"],
    ["15", "How would you rate the lighting at the office?"],
    ["16", "How would you rate the cleanliness and hygiene at the office?"],
    ["17", "How would you rate the noise levels at the office?"],
    ["18", "How would you rate the pantry and refreshments at the office?"],
    ["19", "How would you rate the availability of drinking water at the office?"],
    ["20", "How would you rate the restrooms at the office?"],
    ["21", "How would you rate the meeting / conference rooms at the office?"],
    ["22", "How would you rate the overall ambience of the office?"],
  ];

  return [
    { section: s1, type: "section", prompt: s1 },
    {
      section: s1,
      type: "rating",
      prompt: "On a scale of 1–10, how happy are you working from the office?",
      ratingMax: 10,
    },
    {
      section: s1,
      type: "rating",
      prompt:
        "On a scale of 1–10, how would you rate your overall experience of working from the office?",
      ratingMax: 10,
    },
    {
      section: s1,
      type: "mcq",
      prompt: "How often do you look forward to coming to the office?",
      options: ["Always", "Often", "Sometimes", "Rarely", "Never"],
    },
    {
      section: s1,
      type: "mcq",
      prompt: "How would you describe your overall experience of working from the office?",
      options: ["Very positive", "Positive", "Neutral", "Negative", "Very negative"],
    },
    { section: s2, type: "section", prompt: s2 },
    {
      section: s2,
      type: "rating",
      prompt: "How well does the office environment support your productivity?",
      ratingMax: 10,
    },
    {
      section: s2,
      type: "mcq",
      prompt:
        "Do you feel you have the right environment and resources to perform your work effectively?",
      options: ["Yes, definitely", "Mostly", "Sometimes", "Not really", "No"],
    },
    {
      section: s2,
      type: "mcq",
      prompt: "How comfortable are you working from the office for a full working day?",
      options: [
        "Very comfortable",
        "Comfortable",
        "Neutral",
        "Uncomfortable",
        "Very uncomfortable",
      ],
    },
    {
      section: s2,
      type: "text",
      prompt: "What would help improve your productivity or work experience at the office?",
    },
    { section: s3, type: "section", prompt: s3 },
    {
      section: s3,
      type: "mcq",
      prompt:
        "Does working from the office help you feel more connected to your colleagues and team?",
      options: ["Strongly agree", "Agree", "Neutral", "Disagree", "Strongly disagree"],
    },
    {
      section: s3,
      type: "mcq",
      prompt:
        "How would you rate the opportunities for collaboration and interaction with your colleagues at the office?",
      options: ["Excellent", "Good", "Average", "Poor", "Very poor"],
    },
    { section: s4, type: "section", prompt: s4 },
    ...facilityRatings.map(([, prompt]) => ({
      section: s4,
      type: "rating" as const,
      prompt,
      ratingMax: 5,
    })),
    { section: s5, type: "section", prompt: s5 },
    {
      section: s5,
      type: "multi",
      prompt: "What are the areas you feel should be improved at the office?",
      options: [
        "Seating / Workstations",
        "Chairs / Ergonomics",
        "Internet / Wi-Fi",
        "Air Conditioning / Temperature",
        "Lighting",
        "Cleanliness",
        "Noise Levels",
        "Pantry / Refreshments",
        "Drinking Water",
        "Restrooms",
        "Meeting Rooms",
        "Recreation / Break Area",
        "Parking",
        "Office Ambience",
        "Team Interaction / Collaboration",
        "Other:",
      ],
    },
    {
      section: s5,
      type: "text",
      prompt: "What is the ONE thing you would most like us to improve?",
    },
    {
      section: s5,
      type: "text",
      prompt: "Any other suggestions or feedback you'd like to share?",
    },
  ];
}

function toPulseSlides(rows: TemplateSlide[]): PulseSlideInput[] {
  return rows.map((row) => ({
    type: row.type,
    prompt: row.prompt,
    options: row.options ?? [],
    ratingMax: row.ratingMax ?? (row.type === "rating" ? 10 : 5),
  }));
}

/** Markdown/TXT template aligned with the office experience survey. */
export function pulseSurveyTextTemplate(): string {
  const rows = officeExperienceSlides();
  const lines: string[] = ["# Employee Office Experience Survey", ""];
  let q = 0;
  for (const row of rows) {
    if (row.type === "section") {
      lines.push(`## ${row.prompt}`, "");
      continue;
    }
    q += 1;
    lines.push(`**${q}. ${row.prompt}**`);
    if (row.type === "rating") {
      if ((row.ratingMax ?? 10) >= 10) {
        if (/happy/i.test(row.prompt)) {
          lines.push("Scale: 1 = Very unhappy | 10 = Extremely happy");
        } else if (/overall experience/i.test(row.prompt)) {
          lines.push("Scale: 1 = Very poor | 10 = Excellent");
        } else {
          lines.push("Scale: 1–10");
        }
      } else {
        lines.push("1 – Poor", "2", "3 – Average", "4", "5 – Excellent");
      }
    } else if (row.type === "text") {
      lines.push("Open-ended");
    } else if (row.type === "multi") {
      lines.push("Select all that apply.", "");
      for (const opt of row.options ?? []) lines.push(`* ${opt}`);
    } else if (row.type === "mcq") {
      lines.push("");
      for (const opt of row.options ?? []) lines.push(`* ${opt}`);
    }
    lines.push("");
  }
  return `${lines.join("\n").trim()}\n`;
}

/** CSV template — section,type,prompt,options,rating_max */
export function pulseSurveyCsvTemplate(): string {
  const header = ["section", "type", "prompt", "options", "rating_max"];
  const rows = officeExperienceSlides().map((row) => [
    row.section,
    row.type,
    row.prompt,
    (row.options ?? []).join("|"),
    row.type === "rating" ? String(row.ratingMax ?? 10) : "",
  ]);
  return `${[header, ...rows].map((cols) => cols.map(csvEscape).join(",")).join("\n")}\n`;
}

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
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
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

/** Parse CSV survey (header: section,type,prompt,options,rating_max). */
export function parsePulseSurveyCsv(raw: string): {
  name?: string;
  slides: PulseSlideInput[];
  warnings: string[];
} | null {
  const lines = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);
  if (lines.length < 2) return null;
  const header = parseCsvLine(lines[0]!).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const looksCsv =
    header.includes("type") &&
    header.includes("prompt") &&
    (header.includes("section") || header.includes("options") || header.includes("rating_max"));
  if (!looksCsv) return null;

  const idx = {
    section: header.indexOf("section"),
    type: header.indexOf("type"),
    prompt: header.indexOf("prompt"),
    options: header.indexOf("options"),
    ratingMax:
      header.indexOf("rating_max") >= 0
        ? header.indexOf("rating_max")
        : header.indexOf("ratingmax"),
  };
  if (idx.type < 0 || idx.prompt < 0) return null;

  const allowed: PulseSlideType[] = ["mcq", "multi", "text", "rating", "matrix", "section"];
  const slides: PulseSlideInput[] = [];
  const warnings: string[] = [];
  let lastSection = "";

  for (let r = 1; r < lines.length; r++) {
    const cols = parseCsvLine(lines[r]!);
    const typeRaw = (cols[idx.type] ?? "").trim().toLowerCase() as PulseSlideType;
    const prompt = (cols[idx.prompt] ?? "").trim();
    if (!prompt) continue;
    if (!allowed.includes(typeRaw)) {
      warnings.push(`Row ${r + 1}: unknown type “${typeRaw}” — skipped.`);
      continue;
    }
    const sectionName = idx.section >= 0 ? (cols[idx.section] ?? "").trim() : "";
    if (sectionName && sectionName !== lastSection && typeRaw !== "section") {
      slides.push({
        type: "section",
        prompt: sectionName,
        options: [],
        ratingMax: 5,
      });
      lastSection = sectionName;
    }
    if (typeRaw === "section") {
      lastSection = sectionName || prompt;
    }

    const optionsRaw = idx.options >= 0 ? (cols[idx.options] ?? "") : "";
    const options = optionsRaw
      .split("|")
      .map((o) => o.trim())
      .filter(Boolean);
    const ratingParsed = idx.ratingMax >= 0 ? Number(cols[idx.ratingMax] ?? "") : NaN;
    const ratingMax = Number.isFinite(ratingParsed)
      ? Math.min(10, Math.max(2, ratingParsed))
      : typeRaw === "rating"
        ? 10
        : 5;

    slides.push({
      type: typeRaw,
      prompt,
      options,
      ratingMax,
    });
  }

  if (!slides.length) return { slides: [], warnings: ["CSV had no valid question rows."] };
  return { name: "Employee Office Experience Survey", slides: slides.slice(0, 80), warnings };
}

/** JSON template aligned with the office experience survey. */
export function pulseSurveyJsonTemplate(): string {
  return `${JSON.stringify(
    {
      name: "Employee Office Experience Survey",
      slides: toPulseSlides(officeExperienceSlides()),
    },
    null,
    2,
  )}\n`;
}

export function downloadPulseSurveyTemplate(format: "txt" | "json" | "csv" = "txt") {
  const body =
    format === "json"
      ? pulseSurveyJsonTemplate()
      : format === "csv"
        ? pulseSurveyCsvTemplate()
        : pulseSurveyTextTemplate();
  const mime =
    format === "json"
      ? "application/json;charset=utf-8"
      : format === "csv"
        ? "text/csv;charset=utf-8"
        : "text/plain;charset=utf-8";
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download =
    format === "json"
      ? "assessa-pulse-survey-template.json"
      : format === "csv"
        ? "assessa-pulse-survey-template.csv"
        : "assessa-pulse-survey-template.txt";
  anchor.click();
  URL.revokeObjectURL(url);
}
