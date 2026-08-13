import { useId } from "react";

export type PodiumPlace = 1 | 2 | 3;

type MetalPalette = {
  fillFrom: string;
  fillTo: string;
  rimFrom: string;
  rimTo: string;
  accent: string;
  star: string;
  glow: string;
  plate: string;
};

const METALS: Record<PodiumPlace, MetalPalette> = {
  1: {
    fillFrom: "#fbbf24",
    fillTo: "#b45309",
    rimFrom: "#fef3c7",
    rimTo: "#92400e",
    accent: "#fffbeb",
    star: "#fff7ed",
    glow: "rgba(251, 191, 36, 0.55)",
    plate: "#78350f",
  },
  2: {
    fillFrom: "#e2e8f0",
    fillTo: "#64748b",
    rimFrom: "#f8fafc",
    rimTo: "#334155",
    accent: "#ffffff",
    star: "#fef3c7",
    glow: "rgba(148, 163, 184, 0.5)",
    plate: "#1e293b",
  },
  3: {
    fillFrom: "#fdba74",
    fillTo: "#9a3412",
    rimFrom: "#ffedd5",
    rimTo: "#7c2d12",
    accent: "#fff7ed",
    star: "#fef3c7",
    glow: "rgba(234, 88, 12, 0.45)",
    plate: "#7c2d12",
  },
};

type PodiumMedalProps = {
  place: PodiumPlace;
  size?: number;
  className?: string;
};

/**
 * 3D metallic medal — same language as achievement badges (rim, gloss, shimmer, glitter).
 */
export function PodiumMedal({ place, size = 88, className }: PodiumMedalProps) {
  const uid = useId().replace(/:/g, "");
  const palette = METALS[place];
  const ids = {
    fill: `pm-f-${uid}`,
    rim: `pm-r-${uid}`,
    gloss: `pm-g-${uid}`,
    shimmer: `pm-s-${uid}`,
    shine: `pm-sh-${uid}`,
    shadow: `pm-d-${uid}`,
    glow: `pm-gl-${uid}`,
    glitter: `pm-gt-${uid}`,
    clip: `pm-c-${uid}`,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`${place === 1 ? "Gold" : place === 2 ? "Silver" : "Bronze"} medal`}
      className={className}
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <linearGradient id={ids.fill} x1="18%" y1="6%" x2="82%" y2="94%">
          <stop offset="0%" stopColor={palette.fillFrom} />
          <stop offset="55%" stopColor={palette.fillTo} />
          <stop offset="100%" stopColor={palette.rimTo} stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id={ids.rim} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={palette.rimFrom} />
          <stop offset="42%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="100%" stopColor={palette.rimTo} />
        </linearGradient>
        <linearGradient id={ids.gloss} x1="28%" y1="0%" x2="72%" y2="72%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={ids.shimmer} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="42%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="58%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={ids.shine} cx="36%" cy="28%" r="58%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="40%" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id={ids.shadow} x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow dx="0" dy="5" stdDeviation="4.5" floodColor="#000" floodOpacity="0.35" />
        </filter>
        <filter id={ids.glow} x="-45%" y="-45%" width="190%" height="190%">
          <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={ids.glitter} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.55" result="soft" />
          <feMerge>
            <feMergeNode in="soft" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id={ids.clip}>
          <circle cx="64" cy="58" r="38" />
        </clipPath>
      </defs>

      <ellipse cx="64" cy="116" rx="34" ry="7" fill={palette.glow} opacity="0.7" />

      <g filter={`url(#${ids.shadow})`}>
        {/* Outer metallic rim */}
        <circle cx="64" cy="58" r="44" fill={`url(#${ids.rim})`} />
        {/* Inner disc */}
        <circle cx="64" cy="58" r="38" fill={`url(#${ids.fill})`} />
        {/* Recessed plate */}
        <circle cx="64" cy="58" r="28" fill={palette.plate} opacity="0.28" />
        {/* Gloss */}
        <path
          d="M42 34c10-10 28-14 44-10 0 12-4 24-12 32-10 2-22 0-32-6 0-6 0-12 0-16z"
          fill={`url(#${ids.gloss})`}
        />
      </g>

      {/* Shine + shimmer */}
      <g clipPath={`url(#${ids.clip})`} pointerEvents="none">
        <ellipse className="badge-shine-pulse" cx="52" cy="42" rx="28" ry="22" fill={`url(#${ids.shine})`} />
        <g className="badge-shimmer-sweep">
          <rect
            x="-48"
            y="10"
            width="44"
            height="96"
            fill={`url(#${ids.shimmer})`}
            transform="rotate(-18 64 58)"
            opacity="0.95"
          />
        </g>
      </g>

      {/* Ribbon tails */}
      <g filter={`url(#${ids.glow})`}>
        <path
          d="M48 92c-2 8-8 16-14 22l8 4c4-6 8-12 10-18l-4-8z"
          fill={`url(#${ids.rim})`}
        />
        <path
          d="M80 92c2 8 8 16 14 22l-8 4c-4-6-8-12-10-18l4-8z"
          fill={`url(#${ids.rim})`}
        />
        <path d="M56 90h16v22H56z" fill={palette.fillTo} />
        <path d="M56 90h16v6H56z" fill={palette.rimFrom} opacity="0.85" />
      </g>

      {/* Accent stars */}
      <g fill={palette.star} filter={`url(#${ids.glow})`}>
        <path d="M64 12l1.5 3.4 3.6.4-2.7 2.5.8 3.5L64 20l-3.2 2 0.8-3.5-2.7-2.5 3.6-.4L64 12z" />
        <path d="M34 40l1.1 2.5 2.7.3-2 1.8.6 2.6-2.4-1.4-2.4 1.4.6-2.6-2-1.8 2.7-.3L34 40z" />
        <path d="M94 40l1.1 2.5 2.7.3-2 1.8.6 2.6-2.4-1.4-2.4 1.4.6-2.6-2-1.8 2.7-.3L94 40z" />
      </g>

      {/* Place mark */}
      <g filter={`url(#${ids.glow})`}>
        <text
          x="64"
          y="66"
          textAnchor="middle"
          fill={palette.accent}
          fontSize="36"
          fontWeight="800"
          fontFamily="system-ui, Segoe UI, sans-serif"
          style={{ paintOrder: "stroke", stroke: palette.plate, strokeWidth: 1.2, strokeOpacity: 0.35 }}
        >
          {place}
        </text>
      </g>

      {/* Glitter */}
      <g filter={`url(#${ids.glitter})`} pointerEvents="none">
        <circle className="badge-glitter-dot" cx="46" cy="36" r="1.5" fill="#fff" />
        <circle
          className="badge-glitter-dot"
          cx="82"
          cy="40"
          r="1.2"
          fill="#fff"
          style={{ animationDelay: "0.45s" }}
        />
        <circle
          className="badge-glitter-dot"
          cx="58"
          cy="48"
          r="1"
          fill={palette.star}
          style={{ animationDelay: "0.9s" }}
        />
        <path
          className="badge-glitter-star"
          d="M74 50l0.7 1.5 1.6.2-1.2 1.1.4 1.6-1.5-.9-1.5.9.4-1.6-1.2-1.1 1.6-.2L74 50z"
          fill="#fff"
        />
        <path
          className="badge-glitter-star"
          d="M50 62l0.7 1.5 1.6.2-1.2 1.1.4 1.6-1.5-.9-1.5.9.4-1.6-1.2-1.1 1.6-.2L50 62z"
          fill={palette.star}
          style={{ animationDelay: "0.7s" }}
        />
      </g>
    </svg>
  );
}
