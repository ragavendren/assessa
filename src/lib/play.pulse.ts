export type PulseStatus = "draft" | "lobby" | "prompt" | "results" | "complete";
export type PulseRevealMode = "live" | "all_in" | "host";
export type PulseSlideType = "mcq" | "text" | "rating";

export type PulseSlideInput = {
  type: PulseSlideType;
  prompt: string;
  imageUrl?: string | null;
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

export type PulseResponsePayload = { choiceIndex: number } | { text: string } | { rating: number };

export type PulseMcqAggregate = {
  kind: "mcq";
  total: number;
  options: Array<{ label: string; count: number; percent: number }>;
};

export type PulseTextAggregate = {
  kind: "text";
  total: number;
  items: Array<{ text: string; userId: string; submittedAt: string }>;
};

export type PulseRatingAggregate = {
  kind: "rating";
  total: number;
  average: number;
  max: number;
  histogram: Array<{ rating: number; count: number }>;
};

export type PulseWallAggregate = PulseMcqAggregate | PulseTextAggregate | PulseRatingAggregate;

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
  if (args.revealMode === "live") return args.responseCount > 0 || args.status === "results";
  if (args.revealMode === "all_in") {
    return (
      args.status === "results" ||
      (args.participantCount > 0 && args.responseCount >= args.participantCount)
    );
  }
  return args.status === "results";
}

export function aggregateSlide(args: {
  slide: Pick<PulseSlide, "type" | "options" | "ratingMax">;
  responses: Array<{ userId: string; payload: PulseResponsePayload; submittedAt: string }>;
}): PulseWallAggregate {
  const { slide, responses } = args;
  if (slide.type === "mcq") {
    const counts = slide.options.map(() => 0);
    for (const row of responses) {
      if ("choiceIndex" in row.payload) {
        const i = row.payload.choiceIndex;
        if (i >= 0 && i < counts.length) counts[i] = (counts[i] ?? 0) + 1;
      }
    }
    const total = counts.reduce((s, n) => s + n, 0);
    return {
      kind: "mcq",
      total,
      options: slide.options.map((label, i) => ({
        label,
        count: counts[i] ?? 0,
        percent: total ? Math.round(((counts[i] ?? 0) / total) * 100) : 0,
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
  return { kind: "text", total: items.length, items };
}

export function pulseJoinUrl(pulseId: string, origin?: string) {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/play/pulse/${pulseId}`;
}

export function pulseCodeUrl(code: string, origin?: string) {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/play/pulse?code=${encodeURIComponent(normalizeJoinCode(code))}`;
}
