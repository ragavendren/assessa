import { normalizeTopicKey, shuffleInPlace } from "./question-selection.math.ts";

export const PLAY_KINDS = [
  "topic",
  "daily",
  "weekly",
  "speed",
  "survival",
  "marathon",
  "flash",
  "rapid",
  "battle",
  "team",
  "knockout",
  "escape",
  "arena",
] as const;

export type PlayKind = (typeof PLAY_KINDS)[number];

export type PlayRules = {
  questionCount: number;
  durationSeconds: number | null;
  perQuestionSeconds: number | null;
  lives: number | null;
  timeBonus: boolean;
  onePerPeriod: boolean;
  xpCode: string | null;
  xpPoints: number;
  reward: boolean;
  perItem: boolean;
};

/** Admin-persisted overlay on top of kind defaults. */
export type StoredPlayRules = Partial<PlayRules> & {
  allowedTopics?: string[] | null;
  segmentCount?: number | null;
  questionsPerSegment?: number | null;
  correctMarks?: number | null;
  wrongMarks?: number | null;
};

export const PLAY_KIND_GROUPS: Array<{ label: string; kinds: PlayKind[] }> = [
  { label: "Solo", kinds: ["daily", "weekly", "topic"] },
  { label: "Arcade", kinds: ["speed", "survival", "rapid", "marathon", "flash"] },
  { label: "Social", kinds: ["battle", "team"] },
  { label: "Events", kinds: ["knockout", "escape", "arena"] },
];

export const PLAY_KIND_META: Record<
  PlayKind,
  { label: string; blurb: string; period: "day" | "week" | "open" | "match" }
> = {
  topic: {
    label: "Topic Challenge",
    blurb: "Pick a topic. 10, 15, or 20 questions.",
    period: "open",
  },
  daily: { label: "Daily Challenge", blurb: "10 questions. 10 minutes. +100 XP.", period: "day" },
  weekly: {
    label: "Weekly Challenge",
    blurb: "25 questions. Top 10 earn a badge.",
    period: "week",
  },
  speed: {
    label: "Speed Challenge",
    blurb: "20 questions. 5 minutes. Fastest wins.",
    period: "open",
  },
  survival: { label: "Survival", blurb: "Three lives. One miss costs a life.", period: "open" },
  marathon: { label: "Marathon", blurb: "100 questions. No timer. Resume later.", period: "open" },
  flash: {
    label: "Flash Cards",
    blurb: "Prompt on the front. Explanation on the back.",
    period: "open",
  },
  rapid: { label: "Rapid Fire", blurb: "30 seconds per question. Answer. Next.", period: "open" },
  battle: { label: "Battle", blurb: "Same questions. More correct, then faster.", period: "match" },
  team: {
    label: "Team Challenge",
    blurb: "Departments compete on a shared board.",
    period: "week",
  },
  knockout: { label: "Knockout", blurb: "Bracket rounds down to a final.", period: "match" },
  escape: { label: "Escape Room", blurb: "Solve the outage scene by scene.", period: "open" },
  arena: {
    label: "Live Arena",
    blurb: "Teams answer the same timed question. Hosts reveal keys and publish results.",
    period: "match",
  },
};

export function defaultRulesFor(kind: PlayKind, questionCount?: number): PlayRules {
  switch (kind) {
    case "daily":
      return {
        questionCount: 10,
        durationSeconds: 600,
        perQuestionSeconds: null,
        lives: null,
        timeBonus: false,
        onePerPeriod: true,
        xpCode: "daily_challenge",
        xpPoints: 100,
        reward: true,
        perItem: false,
      };
    case "weekly":
    case "team":
      return {
        questionCount: 25,
        durationSeconds: 1500,
        perQuestionSeconds: null,
        lives: null,
        timeBonus: false,
        onePerPeriod: true,
        xpCode: "weekly_challenge",
        xpPoints: 50,
        reward: true,
        perItem: false,
      };
    case "topic":
      return {
        questionCount: questionCount && [10, 15, 20].includes(questionCount) ? questionCount : 10,
        durationSeconds:
          (questionCount && [10, 15, 20].includes(questionCount) ? questionCount : 10) * 60,
        perQuestionSeconds: null,
        lives: null,
        timeBonus: false,
        onePerPeriod: false,
        xpCode: "topic_challenge",
        xpPoints: 25,
        reward: false,
        perItem: false,
      };
    case "speed":
    case "battle":
    case "knockout":
      return {
        questionCount: kind === "speed" ? 20 : 15,
        durationSeconds: kind === "speed" ? 300 : 600,
        perQuestionSeconds: null,
        lives: null,
        timeBonus: true,
        onePerPeriod: false,
        xpCode: kind === "speed" ? "speed_challenge" : "battle_challenge",
        xpPoints: 40,
        reward: kind === "speed",
        perItem: false,
      };
    case "survival":
      return {
        questionCount: 50,
        durationSeconds: null,
        perQuestionSeconds: null,
        lives: 3,
        timeBonus: false,
        onePerPeriod: false,
        xpCode: "survival_challenge",
        xpPoints: 30,
        reward: false,
        perItem: true,
      };
    case "marathon":
      return {
        questionCount: 100,
        durationSeconds: null,
        perQuestionSeconds: null,
        lives: null,
        timeBonus: false,
        onePerPeriod: false,
        xpCode: "marathon_challenge",
        xpPoints: 80,
        reward: false,
        perItem: false,
      };
    case "rapid":
      return {
        questionCount: 20,
        durationSeconds: null,
        perQuestionSeconds: 30,
        lives: null,
        timeBonus: false,
        onePerPeriod: false,
        xpCode: "rapid_fire",
        xpPoints: 20,
        reward: false,
        perItem: true,
      };
    case "flash":
      return {
        questionCount: 20,
        durationSeconds: null,
        perQuestionSeconds: null,
        lives: null,
        timeBonus: false,
        onePerPeriod: false,
        xpCode: null,
        xpPoints: 0,
        reward: false,
        perItem: true,
      };
    case "escape":
      return {
        questionCount: 5,
        durationSeconds: null,
        perQuestionSeconds: null,
        lives: 3,
        timeBonus: false,
        onePerPeriod: false,
        xpCode: "escape_room",
        xpPoints: 60,
        reward: true,
        perItem: true,
      };
    case "arena":
      return {
        questionCount: 12,
        durationSeconds: null,
        perQuestionSeconds: 30,
        lives: null,
        timeBonus: false,
        onePerPeriod: false,
        xpCode: "arena_challenge",
        xpPoints: 40,
        reward: true,
        perItem: true,
      };
  }
}

export function parseStoredRules(raw: unknown): StoredPlayRules | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as StoredPlayRules;
}

/** Empty or missing list means every topic in the bound course/pool is eligible. */
export function allowedTopicsOf(stored?: StoredPlayRules | null): string[] | null {
  if (!stored || stored.allowedTopics == null) return null;
  const cleaned = [...new Set(stored.allowedTopics.map((topic) => topic.trim()).filter(Boolean))];
  return cleaned.length > 0 ? cleaned : null;
}

export function mergePlayRules(
  kind: PlayKind,
  stored?: StoredPlayRules | null,
  questionCount?: number,
): PlayRules {
  const base = defaultRulesFor(kind, questionCount ?? stored?.questionCount);
  if (!stored) return base;
  return {
    questionCount: stored.questionCount ?? base.questionCount,
    durationSeconds:
      stored.durationSeconds === undefined ? base.durationSeconds : stored.durationSeconds,
    perQuestionSeconds:
      stored.perQuestionSeconds === undefined ? base.perQuestionSeconds : stored.perQuestionSeconds,
    lives: stored.lives === undefined ? base.lives : stored.lives,
    timeBonus: stored.timeBonus ?? base.timeBonus,
    onePerPeriod: stored.onePerPeriod ?? base.onePerPeriod,
    xpCode: stored.xpCode === undefined ? base.xpCode : stored.xpCode,
    xpPoints: stored.xpPoints ?? base.xpPoints,
    reward: stored.reward ?? base.reward,
    perItem: stored.perItem ?? base.perItem,
  };
}

export function serializePlayRules(
  rules: PlayRules,
  allowedTopics: string[] | null,
  extras?: Pick<
    StoredPlayRules,
    "segmentCount" | "questionsPerSegment" | "correctMarks" | "wrongMarks"
  >,
): StoredPlayRules {
  return {
    ...rules,
    allowedTopics: allowedTopicsOf({ allowedTopics }),
    ...(extras?.segmentCount != null ? { segmentCount: extras.segmentCount } : {}),
    ...(extras?.questionsPerSegment != null
      ? { questionsPerSegment: extras.questionsPerSegment }
      : {}),
    ...(extras?.correctMarks != null ? { correctMarks: extras.correctMarks } : {}),
    ...(extras?.wrongMarks != null ? { wrongMarks: extras.wrongMarks } : {}),
  };
}

export function utcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** ISO week key, e.g. 2026-W34. */
export function isoWeekKey(date = new Date()): string {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function periodKeyFor(kind: PlayKind, date = new Date()): string {
  const period = PLAY_KIND_META[kind].period;
  if (period === "day") return utcDateKey(date);
  if (period === "week") return isoWeekKey(date);
  return "open";
}

export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickWithSeed<T>(items: T[], count: number, seed: string): T[] {
  const copy = [...items];
  shuffleInPlace(copy, mulberry32(hashSeed(seed)));
  return copy.slice(0, Math.max(0, count));
}

export function playScore(args: {
  correctCount: number;
  remainingSeconds: number;
  timeBonus: boolean;
}): { score: number; timeBonus: number } {
  const bonus = args.timeBonus ? Math.max(0, Math.round(args.remainingSeconds)) : 0;
  return { score: args.correctCount * 100 + bonus, timeBonus: bonus };
}

export type RewardCode =
  "xp_50" | "xp_100" | "badge" | "avatar" | "double_xp" | "extra_life" | "mock_voucher";

export const REWARD_TABLE: Array<{ code: RewardCode; weight: number; label: string }> = [
  { code: "xp_50", weight: 40, label: "+50 XP" },
  { code: "xp_100", weight: 20, label: "+100 XP" },
  { code: "badge", weight: 10, label: "Bonus badge" },
  { code: "avatar", weight: 10, label: "Avatar unlock" },
  { code: "double_xp", weight: 8, label: "Double XP (24h)" },
  { code: "extra_life", weight: 8, label: "Extra life" },
  { code: "mock_voucher", weight: 4, label: "Free mock test" },
];

export function rollReward(random: () => number = Math.random): (typeof REWARD_TABLE)[number] {
  const total = REWARD_TABLE.reduce((sum, row) => sum + row.weight, 0);
  let cursor = random() * total;
  for (const row of REWARD_TABLE) {
    cursor -= row.weight;
    if (cursor <= 0) return row;
  }
  return REWARD_TABLE[0]!;
}

export function rewardXp(code: RewardCode): number {
  if (code === "xp_50") return 50;
  if (code === "xp_100") return 100;
  return 0;
}

export type MasteryInput = {
  topic: string;
  subtopic: string;
  mastery: number;
  answered?: number;
  correct?: number;
};

export type CareerDomain = {
  topic: string;
  mastery: number;
  answered: number;
  correct: number;
  subtopics: number;
};

/** Roll up mastery by parent topic for Career Readiness bars. */
export function careerDomains(rows: MasteryInput[]): CareerDomain[] {
  const byTopic = new Map<
    string,
    { answered: number; correct: number; weighted: number; weight: number; subs: Set<string> }
  >();
  for (const row of rows) {
    const topic = (row.topic || "General").trim() || "General";
    const answered = row.answered ?? 0;
    const correct = row.correct ?? 0;
    const weight = answered > 0 ? answered : 1;
    let bucket = byTopic.get(topic);
    if (!bucket) {
      bucket = { answered: 0, correct: 0, weighted: 0, weight: 0, subs: new Set() };
      byTopic.set(topic, bucket);
    }
    bucket.answered += answered;
    bucket.correct += correct;
    bucket.weighted += row.mastery * weight;
    bucket.weight += weight;
    bucket.subs.add(normalizeTopicKey(row.subtopic) || "general");
  }
  return [...byTopic.entries()]
    .map(([topic, bucket]) => ({
      topic,
      mastery: bucket.weight > 0 ? Math.round(bucket.weighted / bucket.weight) : 0,
      answered: bucket.answered,
      correct: bucket.correct,
      subtopics: bucket.subs.size,
    }))
    .sort((a, b) => a.mastery - b.mastery || a.topic.localeCompare(b.topic));
}

export function weakestTopics(rows: MasteryInput[], limit = 2): MasteryInput[] {
  return [...rows].sort((a, b) => a.mastery - b.mastery).slice(0, limit);
}

export function sameIndexSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort((x, y) => x - y);
  const right = [...b].sort((x, y) => x - y);
  return left.every((value, index) => value === right[index]);
}

export function normalizeAnswer(value: unknown): number[] {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => Number(item)).filter((n) => Number.isInteger(n)))].sort(
      (a, b) => a - b,
    );
  }
  if (typeof value === "number" && Number.isInteger(value)) return [value];
  return [];
}

export function calendarStreakNext(
  lastActivityAt: string | null | undefined,
  currentCount: number,
  today = utcDateKey(),
): { current: number; continued: boolean } {
  if (!lastActivityAt) return { current: 1, continued: false };
  const last = utcDateKey(new Date(lastActivityAt));
  if (last === today) return { current: Math.max(1, currentCount), continued: true };
  const yesterday = utcDateKey(new Date(Date.parse(`${today}T00:00:00.000Z`) - 86_400_000));
  if (last === yesterday) return { current: currentCount + 1, continued: true };
  return { current: 1, continued: false };
}

export type PlaySegmentMode = {
  kind: PlayKind;
  enabled: boolean;
  label: string;
  blurb: string;
  poolId: string | null;
  bindingCourseId: string | null;
  questionCount: number;
  durationSeconds: number | null;
  lives: number | null;
  hasPool: boolean;
};

export type PlaySegment = {
  scope: "course" | "activity";
  id: string;
  name: string;
  courseId: string;
  courseName: string;
  poolCount: number;
  questionCount: number;
  modes: PlaySegmentMode[];
};
