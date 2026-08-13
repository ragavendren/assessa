/**
 * Admin picker catalog — bridges Lucide preview chips to the SVG badge glyph set.
 * Runtime rendering uses `@/components/badges` (pure SVG shields).
 */
import type { LucideIcon } from "lucide-react";
import {
  Award,
  BadgeCheck,
  BookOpen,
  Brain,
  CircleCheck,
  ClipboardCheck,
  Crown,
  Flag,
  Flame,
  Footprints,
  Gem,
  GraduationCap,
  HandMetal,
  HeartHandshake,
  Infinity as InfinityGlyph,
  Layers,
  Lightbulb,
  Medal,
  Mountain,
  Orbit,
  Percent,
  Play,
  RefreshCw,
  Rocket,
  Shield,
  Sparkles,
  Star,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { BADGE_GLYPH_IDS, resolveBadgeDefinition, type BadgeGlyphId } from "@/components/badges";

export type BadgeIconId = BadgeGlyphId;

export const BADGE_ICON_CATALOG: Array<{ id: BadgeIconId; label: string; Icon: LucideIcon }> = [
  { id: "trophy", label: "Trophy", Icon: Trophy },
  { id: "medal", label: "Medal", Icon: Medal },
  { id: "award", label: "Award", Icon: Award },
  { id: "crown", label: "Crown", Icon: Crown },
  { id: "star", label: "Star", Icon: Star },
  { id: "sparkles", label: "Sparkles", Icon: Sparkles },
  { id: "target", label: "Target", Icon: Target },
  { id: "zap", label: "Lightning", Icon: Zap },
  { id: "flame", label: "Flame", Icon: Flame },
  { id: "rocket", label: "Rocket", Icon: Rocket },
  { id: "gem", label: "Gem", Icon: Gem },
  { id: "shield", label: "Shield", Icon: Shield },
  { id: "brain", label: "Brain", Icon: Brain },
  { id: "trend", label: "Rising", Icon: TrendingUp },
  { id: "refresh", label: "Comeback", Icon: RefreshCw },
  { id: "timer", label: "Timer", Icon: Timer },
  { id: "flag", label: "Flag", Icon: Flag },
  { id: "check", label: "Check", Icon: CircleCheck },
  { id: "badge", label: "Badge", Icon: BadgeCheck },
  { id: "play", label: "Start", Icon: Play },
  { id: "book", label: "Book", Icon: BookOpen },
  { id: "layers", label: "Layers", Icon: Layers },
  { id: "users", label: "Pair", Icon: Users },
  { id: "mountain", label: "Peak", Icon: Mountain },
  { id: "percent", label: "Percent", Icon: Percent },
  { id: "orbit", label: "Orbit", Icon: Orbit },
  { id: "handshake", label: "Team", Icon: HeartHandshake },
  { id: "infinity", label: "Infinity", Icon: InfinityGlyph },
  { id: "podium", label: "Podium", Icon: Trophy },
  { id: "fist", label: "Fist", Icon: HandMetal },
  { id: "clipboard", label: "Clipboard", Icon: ClipboardCheck },
  { id: "runner", label: "Runner", Icon: Footprints },
  { id: "bulb", label: "Idea", Icon: Lightbulb },
  { id: "graduation", label: "Graduate", Icon: GraduationCap },
  { id: "mark", label: "Number", Icon: Star },
];

const CATALOG_BY_ID = new Map(BADGE_ICON_CATALOG.map((item) => [item.id, item]));

export function isBadgeIconId(value: string): value is BadgeIconId {
  return CATALOG_BY_ID.has(value as BadgeIconId);
}

export function resolveBadgeIcon(icon: string, code?: string | null) {
  if (isBadgeIconId(icon)) return CATALOG_BY_ID.get(icon)!;
  const def = resolveBadgeDefinition(code ?? icon);
  if (def && CATALOG_BY_ID.has(def.glyph)) return CATALOG_BY_ID.get(def.glyph)!;
  return null;
}

export function badgeIconComponent(icon: string, code?: string | null): LucideIcon | null {
  return resolveBadgeIcon(icon, code)?.Icon ?? null;
}

export { BADGE_GLYPH_IDS };
