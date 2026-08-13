import type { BadgeTrack } from "./tracks";

/**
 * Glyph keys drawn as pure SVG paths inside the shield.
 * Shapes mirror the Assessa achievement art pack.
 */
export type BadgeGlyphId =
  | "trophy"
  | "medal"
  | "award"
  | "crown"
  | "star"
  | "sparkles"
  | "target"
  | "zap"
  | "flame"
  | "rocket"
  | "gem"
  | "shield"
  | "brain"
  | "trend"
  | "refresh"
  | "timer"
  | "flag"
  | "check"
  | "badge"
  | "play"
  | "book"
  | "layers"
  | "users"
  | "mountain"
  | "percent"
  | "orbit"
  | "handshake"
  | "infinity"
  | "podium"
  | "fist"
  | "clipboard"
  | "runner"
  | "bulb"
  | "graduation"
  | "mark";

export type BadgeType =
  | "podium-finish"
  | "top-performer"
  | "big-comeback"
  | "never-give-up"
  | "rising-star"
  | "subject-expert"
  | "first-success"
  | "half-century"
  | "first-attempt"
  | "getting-started"
  | "on-a-roll"
  | "practice-makes-progress"
  | "dedicated-learner"
  | "ten-passes"
  | "assessment-marathon"
  | "pass-club"
  | "pass-champion"
  | "century-club"
  | "assessment-veteran"
  | "accuracy-master"
  | "bronze-score"
  | "silver-score"
  | "sharp-average"
  | "perfect-score"
  | "near-perfect"
  | "high-achiever"
  | "speed-demon"
  | "fast-solver"
  | "hot-streak"
  | "steady-four"
  | "consistency"
  | "quiz-duo";

export type BadgeDefinition = {
  type: BadgeType;
  /** DB `badges.code` (snake_case). */
  code: string;
  label: string;
  track: BadgeTrack;
  glyph: BadgeGlyphId;
  /** Centre label for number / percent badges (e.g. "3", "100%"). */
  mark?: string;
};

/**
 * Canonical map: display type ↔ DB code ↔ track ↔ inner glyph.
 * Icons aligned to the achievement art pack. Conditions / XP stay in the DB.
 */
export const BADGE_MAP: Record<BadgeType, BadgeDefinition> = {
  "first-success": {
    type: "first-success",
    code: "first_success",
    label: "First Success",
    track: "beginner",
    glyph: "medal",
  },
  "first-attempt": {
    type: "first-attempt",
    code: "hello_world",
    label: "First Attempt",
    track: "beginner",
    glyph: "award",
  },
  "getting-started": {
    type: "getting-started",
    code: "unit_test_pass",
    label: "Getting Started",
    track: "beginner",
    glyph: "rocket",
  },
  "on-a-roll": {
    type: "on-a-roll",
    code: "merge_ready",
    label: "On a Roll",
    track: "beginner",
    glyph: "medal",
  },
  "practice-makes-progress": {
    type: "practice-makes-progress",
    code: "pull_request_pro",
    label: "Practice Makes Progress",
    track: "beginner",
    glyph: "target",
  },
  "bronze-score": {
    type: "bronze-score",
    code: "bronze_score",
    label: "Bronze Score",
    track: "beginner",
    glyph: "medal",
  },
  "quiz-duo": {
    type: "quiz-duo",
    code: "quiz_duo",
    label: "Quiz Duo",
    track: "beginner",
    glyph: "handshake",
  },
  "half-century": {
    type: "half-century",
    code: "half_century",
    label: "Half Century",
    track: "intermediate",
    glyph: "target",
  },
  "rising-star": {
    type: "rising-star",
    code: "rising_star",
    label: "Rising Star",
    track: "intermediate",
    glyph: "star",
  },
  "never-give-up": {
    type: "never-give-up",
    code: "comeback",
    label: "Never Give Up",
    track: "intermediate",
    glyph: "fist",
  },
  "fast-solver": {
    type: "fast-solver",
    code: "fast_solver",
    label: "Fast Solver",
    track: "intermediate",
    glyph: "timer",
  },
  "hot-streak": {
    type: "hot-streak",
    code: "build_pipeline",
    label: "Hot Streak",
    track: "intermediate",
    glyph: "flame",
  },
  "steady-four": {
    type: "steady-four",
    code: "steady_four",
    label: "Steady Four",
    track: "intermediate",
    glyph: "award",
  },
  "pass-club": {
    type: "pass-club",
    code: "pass_club_5",
    label: "Pass Club",
    track: "intermediate",
    glyph: "medal",
  },
  "silver-score": {
    type: "silver-score",
    code: "silver_score",
    label: "Silver Score",
    track: "intermediate",
    glyph: "award",
  },
  "accuracy-master": {
    type: "accuracy-master",
    code: "accuracy_master",
    label: "Accuracy Master",
    track: "expertise",
    glyph: "target",
  },
  consistency: {
    type: "consistency",
    code: "consistency",
    label: "Consistency",
    track: "expertise",
    glyph: "target",
  },
  "subject-expert": {
    type: "subject-expert",
    code: "subject_expert",
    label: "Subject Expert",
    track: "expertise",
    glyph: "graduation",
  },
  "assessment-veteran": {
    type: "assessment-veteran",
    code: "veteran",
    label: "Assessment Veteran",
    track: "expertise",
    glyph: "medal",
  },
  "near-perfect": {
    type: "near-perfect",
    code: "nine_nines",
    label: "Near Perfect",
    track: "expertise",
    glyph: "target",
  },
  "dedicated-learner": {
    type: "dedicated-learner",
    code: "load_balancer",
    label: "Dedicated Learner",
    track: "expertise",
    glyph: "book",
  },
  "podium-finish": {
    type: "podium-finish",
    code: "podium_finish",
    label: "Podium Finish",
    track: "expertise",
    glyph: "podium",
  },
  "sharp-average": {
    type: "sharp-average",
    code: "sharp_average",
    label: "Sharp Average",
    track: "expertise",
    glyph: "trend",
  },
  "big-comeback": {
    type: "big-comeback",
    code: "big_comeback",
    label: "Big Comeback",
    track: "expertise",
    glyph: "trend",
  },
  "perfect-score": {
    type: "perfect-score",
    code: "perfect_score",
    label: "Perfect Score",
    track: "elite",
    glyph: "crown",
  },
  "top-performer": {
    type: "top-performer",
    code: "top_performer",
    label: "Top Performer",
    track: "elite",
    glyph: "trophy",
  },
  "high-achiever": {
    type: "high-achiever",
    code: "high_achiever",
    label: "High Achiever",
    track: "elite",
    glyph: "medal",
  },
  "ten-passes": {
    type: "ten-passes",
    code: "platform_guardian",
    label: "Ten Passes",
    track: "elite",
    glyph: "shield",
  },
  "assessment-marathon": {
    type: "assessment-marathon",
    code: "marathon_20",
    label: "Assessment Marathon",
    track: "elite",
    glyph: "flag",
  },
  "pass-champion": {
    type: "pass-champion",
    code: "pass_club_15",
    label: "Pass Champion",
    track: "elite",
    glyph: "award",
  },
  "century-club": {
    type: "century-club",
    code: "century_attempts",
    label: "Century Club",
    track: "elite",
    glyph: "gem",
  },
  "speed-demon": {
    type: "speed-demon",
    code: "speed_demon",
    label: "Speed Demon",
    track: "elite",
    glyph: "zap",
  },
};

const BY_CODE = new Map(Object.values(BADGE_MAP).map((def) => [def.code, def]));
const BY_TYPE = new Map(Object.values(BADGE_MAP).map((def) => [def.type, def]));

/** Accepts `perfect-score`, `perfect_score`, or a known display type. */
export function resolveBadgeDefinition(
  typeOrCode: string | null | undefined,
): BadgeDefinition | null {
  if (!typeOrCode) return null;
  const raw = typeOrCode.trim();
  if (!raw) return null;
  const asType = raw.replaceAll("_", "-") as BadgeType;
  if (BY_TYPE.has(asType)) return BY_TYPE.get(asType)!;
  const asCode = raw.replaceAll("-", "_");
  if (BY_CODE.has(asCode)) return BY_CODE.get(asCode)!;
  if (BY_CODE.has(raw)) return BY_CODE.get(raw)!;
  return null;
}

export const BADGE_TYPES = Object.keys(BADGE_MAP) as BadgeType[];
