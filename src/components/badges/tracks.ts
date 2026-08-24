/** Track color tokens for the reusable SVG badge system. */
export type BadgeTrack = "beginner" | "intermediate" | "expertise" | "elite";

export type TrackPalette = {
  fillFrom: string;
  fillTo: string;
  rimFrom: string;
  rimTo: string;
  accent: string;
  star: string;
  glow: string;
};

/**
 * Dark saturated shields + metallic gold icons — matches the achievement art pack.
 */
export const TRACK_PALETTES: Record<BadgeTrack, TrackPalette> = {
  beginner: {
    fillFrom: "#166534",
    fillTo: "#14532d",
    rimFrom: "#fde68a",
    rimTo: "#b45309",
    accent: "#fbbf24",
    star: "#fef3c7",
    glow: "rgba(251, 191, 36, 0.4)",
  },
  intermediate: {
    fillFrom: "#1e3a8a",
    fillTo: "#172554",
    rimFrom: "#e2e8f0",
    rimTo: "#64748b",
    accent: "#f8fafc",
    star: "#fde68a",
    glow: "rgba(148, 163, 184, 0.4)",
  },
  expertise: {
    fillFrom: "#6b21a8",
    fillTo: "#4c1d95",
    rimFrom: "#fde68a",
    rimTo: "#b45309",
    accent: "#fbbf24",
    star: "#fef3c7",
    glow: "rgba(251, 191, 36, 0.4)",
  },
  elite: {
    fillFrom: "#9a3412",
    fillTo: "#7c2d12",
    rimFrom: "#fde68a",
    rimTo: "#b45309",
    accent: "#fef08a",
    star: "#fff7ed",
    glow: "rgba(253, 224, 71, 0.45)",
  },
};

export const TRACK_LABELS: Record<BadgeTrack, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  expertise: "Expertise",
  elite: "Elite",
};

export function isBadgeTrack(value: string | null | undefined): value is BadgeTrack {
  return (
    value === "beginner" ||
    value === "intermediate" ||
    value === "expertise" ||
    value === "elite"
  );
}
