/** Client-safe gamification helpers and shared types. No server imports here. */

export type LevelRow = { level: number; name: string; min_xp: number };

export type LevelState = {
  level: number;
  name: string;
  xp: number;
  currentFloor: number;
  nextLevel: number | null;
  nextLevelXp: number | null;
  xpToNext: number;
  progress: number; // 0..1
  /** Skill band derived from level number. */
  track: SkillTrack;
};

/** Career / skill tracks for levels and badges. */
export const SKILL_TRACKS = ["beginner", "intermediate", "expertise", "elite"] as const;
export type SkillTrack = (typeof SKILL_TRACKS)[number];

export const SKILL_TRACK_LABELS: Record<SkillTrack, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  expertise: "Expertise",
  elite: "Elite",
};

export const SKILL_TRACK_BLURB: Record<SkillTrack, string> = {
  beginner: "First attempts, early passes, and building confidence.",
  intermediate: "Steady progress — streaks, speed, and score improvements.",
  expertise: "Strong accuracy, topic mastery, and consistent results.",
  elite: "Perfect scores, top ranks, and long-term excellence.",
};

/** Map a numeric level onto a skill track. */
export function trackForLevel(level: number): SkillTrack {
  if (level <= 3) return "beginner";
  if (level <= 6) return "intermediate";
  if (level <= 8) return "expertise";
  return "elite";
}

export function resolveLevel(xp: number, levels: LevelRow[]): LevelState {
  const sorted = [...levels].sort((a, b) => a.min_xp - b.min_xp);
  const fallback: LevelRow = { level: 1, name: "Beginner", min_xp: 0 };
  let current = sorted[0] ?? fallback;
  for (const row of sorted) if (xp >= row.min_xp) current = row;
  const next = sorted.find((row) => row.min_xp > current.min_xp) ?? null;
  const span = next ? next.min_xp - current.min_xp : 1;
  const gained = xp - current.min_xp;
  return {
    level: current.level,
    name: current.name,
    xp,
    currentFloor: current.min_xp,
    nextLevel: next?.level ?? null,
    nextLevelXp: next?.min_xp ?? null,
    xpToNext: next ? Math.max(0, next.min_xp - xp) : 0,
    progress: next ? Math.min(1, Math.max(0, gained / span)) : 1,
    track: trackForLevel(current.level),
  };
}

export const EXAM_MODES = ["practice", "assessment", "competitive", "certification"] as const;
export type ExamMode = (typeof EXAM_MODES)[number];

export const MODE_LABELS: Record<ExamMode, string> = {
  practice: "Practice",
  assessment: "Assessment",
  competitive: "Competitive",
  certification: "Certification",
};

export const MODE_BLURB: Record<ExamMode, string> = {
  practice: "Unlimited attempts, instant feedback, no leaderboard.",
  assessment: "Limited attempts, timed, answers locked on submit.",
  competitive: "Timed, randomised questions, ranked leaderboard.",
  certification: "Strict timer, limited attempts, certificate eligible.",
};

export const ACCESS_LABELS: Record<string, string> = {
  public: "Public",
  private: "Invite only",
  organization: "Organization",
  group: "Group",
};

export const LEADERBOARD_SCOPE_LABELS = {
  global: { label: "Global", hint: "Everyone" },
  organization: { label: "Organisation", hint: "Your company" },
  department: { label: "Team / Group", hint: "Your team" },
} as const;

export function scoreTone(score: number, passMark: number) {
  if (score >= 90) return "excellent" as const;
  if (score >= passMark) return "pass" as const;
  return "fail" as const;
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDuration(seconds: number | null | undefined) {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export const passwordRules = [
  { label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { label: "One uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { label: "One lowercase letter", test: (v: string) => /[a-z]/.test(v) },
  { label: "One number", test: (v: string) => /\d/.test(v) },
];

export function passwordStrength(value: string) {
  const passed = passwordRules.filter((rule) => rule.test(value)).length;
  return {
    passed,
    total: passwordRules.length,
    ok: passed === passwordRules.length,
  };
}
