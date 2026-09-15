export type PulseStatus = "draft" | "lobby" | "prompt" | "results" | "complete";
/** live/all_in/host = host-driven slides. self = participants pace through sections alone. */
export type PulseRevealMode = "live" | "all_in" | "host" | "self";
export type PulseSlideType = "mcq" | "multi" | "text" | "rating" | "matrix" | "section";

export type PulseSlideInput = {
  type: PulseSlideType;
  prompt: string;
  imageUrl?: string | null;
  /** MCQ/multi choices, or matrix row labels. */
  options?: string[];
  ratingMax?: number;
};

export type PulseSlide = {
  id: string;
  sortOrder: number;
  type: PulseSlideType;
  prompt: string;
  imageUrl: string | null;
  options: string[];
  ratingMax: number;
};

export type PulseResponsePayload =
  | { choiceIndex: number }
  | { choiceIndexes: number[]; otherText?: string }
  | { text: string }
  | { rating: number }
  | { ratings: number[] }
  | { acknowledged: true };

export type PulseMcqAggregate = {
  kind: "mcq" | "multi";
  total: number;
  options: Array<{ label: string; count: number; percent: number }>;
};

export type PulseTextAggregate = {
  kind: "text";
  total: number;
  items: Array<{ text: string; userId: string; submittedAt: string }>;
  words: Array<{ word: string; count: number }>;
};

export type PulseRatingAggregate = {
  kind: "rating";
  total: number;
  average: number;
  max: number;
  histogram: Array<{ rating: number; count: number }>;
};

export type PulseMatrixAggregate = {
  kind: "matrix";
  total: number;
  max: number;
  rows: Array<{
    label: string;
    average: number;
    count: number;
    histogram: Array<{ rating: number; count: number }>;
  }>;
};

export type PulseSectionAggregate = {
  kind: "section";
  total: number;
};

export type PulseWallAggregate =
  | PulseMcqAggregate
  | PulseTextAggregate
  | PulseRatingAggregate
  | PulseMatrixAggregate
  | PulseSectionAggregate;

export function generateJoinCode(length = 6): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]!).join("");
}

export function normalizeJoinCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

export function wallVisible(args: {
  revealMode: PulseRevealMode;
  status: PulseStatus;
  responseCount: number;
  participantCount: number;
}): boolean {
  if (args.status === "complete") return true;
  // Self-paced surveys use the per-user report, not a live wall during answering.
  if (args.revealMode === "self") return false;
  if (args.revealMode === "live") return args.responseCount > 0 || args.status === "results";
  if (args.revealMode === "all_in") {
    return (
      args.status === "results" ||
      (args.participantCount > 0 && args.responseCount >= args.participantCount)
    );
  }
  return args.status === "results";
}

/** Group flat slides into sections (section slide opens a group; questions follow). */
export type PulseSectionGroup = {
  title: string;
  /** Index of the section header slide, if any. */
  sectionSlideIndex: number | null;
  /** Indexes of answerable slides in this section. */
  questionIndexes: number[];
};

export function groupPulseSections(
  slides: Array<Pick<PulseSlide, "type" | "prompt">>,
): PulseSectionGroup[] {
  const groups: PulseSectionGroup[] = [];
  let current: PulseSectionGroup | null = null;

  const startGroup = (title: string, sectionSlideIndex: number | null) => {
    current = { title, sectionSlideIndex, questionIndexes: [] };
    groups.push(current);
  };

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]!;
    if (slide.type === "section") {
      startGroup(slide.prompt.trim() || `Section ${groups.length + 1}`, i);
      continue;
    }
    if (!current) startGroup("Getting started", null);
    current!.questionIndexes.push(i);
  }

  return groups.filter((g) => g.sectionSlideIndex !== null || g.questionIndexes.length > 0);
}

export function isAnswerableSlideType(type: PulseSlideType) {
  return type !== "section";
}

export function formatPulseAnswer(args: {
  slide: Pick<PulseSlide, "type" | "options" | "ratingMax" | "prompt">;
  payload: PulseResponsePayload | null;
}): string {
  if (!args.payload) return "—";
  const p = args.payload;
  if ("acknowledged" in p) return "Viewed";
  if ("text" in p) return p.text || "—";
  if ("rating" in p) return String(p.rating);
  if ("choiceIndex" in p) {
    return args.slide.options[p.choiceIndex] ?? `Option ${p.choiceIndex + 1}`;
  }
  if ("choiceIndexes" in p) {
    const labels = p.choiceIndexes.map((i) => args.slide.options[i] ?? `#${i + 1}`);
    const other = p.otherText?.trim();
    return other ? `${labels.join(", ")}; Other: ${other}` : labels.join(", ") || "—";
  }
  if ("ratings" in p) {
    return args.slide.options.map((label, i) => `${label}: ${p.ratings[i] ?? "—"}`).join(" · ");
  }
  return "—";
}

export function aggregateSlide(args: {
  slide: Pick<PulseSlide, "type" | "options" | "ratingMax">;
  responses: Array<{ userId: string; payload: PulseResponsePayload; submittedAt: string }>;
}): PulseWallAggregate {
  const { slide, responses } = args;

  if (slide.type === "section") {
    return { kind: "section", total: responses.length };
  }

  if (slide.type === "mcq" || slide.type === "multi") {
    const counts = slide.options.map(() => 0);
    let voters = 0;
    for (const row of responses) {
      if (slide.type === "mcq" && "choiceIndex" in row.payload) {
        const i = row.payload.choiceIndex;
        if (i >= 0 && i < counts.length) {
          counts[i] = (counts[i] ?? 0) + 1;
          voters += 1;
        }
      }
      if (slide.type === "multi" && "choiceIndexes" in row.payload) {
        voters += 1;
        for (const i of row.payload.choiceIndexes) {
          if (i >= 0 && i < counts.length) counts[i] = (counts[i] ?? 0) + 1;
        }
      }
    }
    const denom =
      slide.type === "multi"
        ? Math.max(voters, 1)
        : Math.max(
            counts.reduce((s, n) => s + n, 0),
            1,
          );
    const total = slide.type === "multi" ? voters : counts.reduce((s, n) => s + n, 0);
    return {
      kind: slide.type,
      total,
      options: slide.options.map((label, i) => ({
        label,
        count: counts[i] ?? 0,
        percent: total ? Math.round(((counts[i] ?? 0) / denom) * 100) : 0,
      })),
    };
  }

  if (slide.type === "rating") {
    const max = slide.ratingMax || 5;
    const histogram = Array.from({ length: max }, (_, i) => ({ rating: i + 1, count: 0 }));
    let sum = 0;
    let n = 0;
    for (const row of responses) {
      if ("rating" in row.payload) {
        const r = row.payload.rating;
        if (r >= 1 && r <= max) {
          histogram[r - 1]!.count += 1;
          sum += r;
          n += 1;
        }
      }
    }
    return {
      kind: "rating",
      total: n,
      average: n ? Math.round((sum / n) * 10) / 10 : 0,
      max,
      histogram,
    };
  }

  if (slide.type === "matrix") {
    const max = slide.ratingMax || 5;
    const rows = slide.options.map((label, rowIndex) => {
      const histogram = Array.from({ length: max }, (_, i) => ({ rating: i + 1, count: 0 }));
      let sum = 0;
      let n = 0;
      for (const row of responses) {
        if (!("ratings" in row.payload)) continue;
        const r = row.payload.ratings[rowIndex];
        if (typeof r === "number" && r >= 1 && r <= max) {
          histogram[r - 1]!.count += 1;
          sum += r;
          n += 1;
        }
      }
      return {
        label,
        average: n ? Math.round((sum / n) * 10) / 10 : 0,
        count: n,
        histogram,
      };
    });
    return { kind: "matrix", total: responses.length, max, rows };
  }

  const items = responses
    .filter((r): r is typeof r & { payload: { text: string } } => "text" in r.payload)
    .map((r) => ({
      text: r.payload.text.trim(),
      userId: r.userId,
      submittedAt: r.submittedAt,
    }))
    .filter((r) => r.text.length > 0)
    .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt))
    .slice(0, 80);
  return {
    kind: "text",
    total: items.length,
    items,
    words: buildWordCollage(items.map((i) => i.text)),
  };
}

const WORD_STOP = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "to",
  "of",
  "in",
  "on",
  "for",
  "is",
  "are",
  "was",
  "were",
  "be",
  "it",
  "this",
  "that",
  "with",
  "as",
  "at",
  "by",
  "from",
  "we",
  "you",
  "i",
  "my",
  "our",
  "their",
  "not",
  "so",
  "if",
  "do",
  "does",
  "did",
  "have",
  "has",
  "had",
]);

export function buildWordCollage(texts: string[]): Array<{ word: string; count: number }> {
  const counts = new Map<string, number>();
  for (const text of texts) {
    const tokens = text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
      .split(/\s+/)
      .map((t) => t.replace(/^['-]+|['-]+$/g, ""))
      .filter((t) => t.length >= 2 && !WORD_STOP.has(t));
    const seen = new Set<string>();
    for (const token of tokens) {
      if (seen.has(token)) continue;
      seen.add(token);
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, 60);
}

export function pulseJoinUrl(pulseId: string, origin?: string) {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/play/pulse/${pulseId}`;
}

export function pulseCodeUrl(code: string, origin?: string) {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/play/pulse?code=${encodeURIComponent(normalizeJoinCode(code))}`;
}
