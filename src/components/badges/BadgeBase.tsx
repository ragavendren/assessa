import { useId } from "react";
import { BadgeIcon } from "./BadgeIcon";
import type { BadgeGlyphId } from "./badgeMap";
import { TRACK_PALETTES, type BadgeTrack } from "./tracks";

type BadgeBaseProps = {
  track: BadgeTrack;
  glyph: BadgeGlyphId;
  mark?: string | undefined;
  size?: number;
  title?: string | undefined;
  earned?: boolean;
  className?: string | undefined;
};

/**
 * Shared shield artwork — one SVG composition for every badge.
 * Track palette drives fill / rim / glow; glyph sits large in the centre.
 */
export function BadgeBase({
  track,
  glyph,
  mark,
  size = 72,
  title,
  earned = true,
  className,
}: BadgeBaseProps) {
  const uid = useId().replace(/:/g, "");
  const palette = TRACK_PALETTES[track];
  const ids = {
    fill: `bf-${uid}`,
    rim: `br-${uid}`,
    gloss: `bg-${uid}`,
    shimmer: `bsh-${uid}`,
    shadow: `bs-${uid}`,
    glow: `bgl-${uid}`,
    glitter: `bgt-${uid}`,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : "presentation"}
      aria-label={title}
      className={className}
      style={{
        display: "block",
        overflow: "visible",
        opacity: earned ? 1 : 0.55,
        filter: earned ? undefined : "grayscale(0.85)",
      }}
    >
      <defs>
        <linearGradient id={ids.fill} x1="20%" y1="8%" x2="80%" y2="95%">
          <stop offset="0%" stopColor={palette.fillFrom} />
          <stop offset="55%" stopColor={palette.fillTo} />
          <stop offset="100%" stopColor={palette.rimTo} stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id={ids.rim} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={palette.rimFrom} />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor={palette.rimTo} />
        </linearGradient>
        <linearGradient id={ids.gloss} x1="30%" y1="0%" x2="70%" y2="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={ids.shimmer} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="40%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="48%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="52%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`shine-${uid}`} cx="38%" cy="28%" r="55%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
          <stop offset="40%" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id={ids.shadow} x="-25%" y="-15%" width="150%" height="150%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.3" />
        </filter>
        <filter id={ids.glow} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={ids.glitter} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.6" result="soft" />
          <feMerge>
            <feMergeNode in="soft" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id={`clip-${uid}`}>
          <path d="M64 16c15 5 28 7 38 8.5V58c0 23-15 40-38 48C41 98 26 81 26 58V24.5C36 23 49 21 64 16z" />
        </clipPath>
      </defs>

      {/* Soft track glow */}
      <ellipse cx="64" cy="114" rx="36" ry="9" fill={palette.glow} opacity="0.6" />

      <g filter={`url(#${ids.shadow})`}>
        {/* Outer metallic rim */}
        <path
          d="M64 8c18 6 34 8 46 10v42c0 28-18 48-46 58C36 108 18 88 18 60V18c12-2 28-4 46-10z"
          fill={`url(#${ids.rim})`}
        />
        {/* Inner shield body */}
        <path
          d="M64 16c15 5 28 7 38 8.5V58c0 23-15 40-38 48C41 98 26 81 26 58V24.5C36 23 49 21 64 16z"
          fill={`url(#${ids.fill})`}
        />
        {/* Inner plate — dark recess so metallic icons read clearly */}
        <path
          d="M64 28c10 3.2 18 4.4 24 5.2V54c0 14-9 25-24 30.5C49 79 40 68 40 54V33.2c6-.8 14-2 24-5.2z"
          fill="#020617"
          opacity="0.35"
        />
        {/* Gloss highlight */}
        <path
          d="M42 28c8-4 22-7 36-8 2 10 1 22-4 30-8 2-18 2-28-1 0-7 0-14-4-21z"
          fill={`url(#${ids.gloss})`}
        />
      </g>

      {/* Breathing shine + sweeping beams (earned only) */}
      {earned ? (
        <g clipPath={`url(#clip-${uid})`} pointerEvents="none">
          <ellipse
            className="badge-shine-pulse"
            cx="54"
            cy="42"
            rx="34"
            ry="28"
            fill={`url(#shine-${uid})`}
          />
          <g className="badge-shimmer-sweep">
            <rect
              x="-50"
              y="8"
              width="48"
              height="110"
              fill={`url(#${ids.shimmer})`}
              transform="rotate(-18 64 64)"
              opacity="0.95"
            />
          </g>
        </g>
      ) : null}

      {/* Laurel left */}
      <g fill={palette.rimFrom} opacity="0.85">
        <path d="M26 70c-6 4-10 10-11 16 5-2 10-3 14-2-4 4-6 9-6 14 5-3 10-4 15-3-3 5-4 10-3 15 6-5 11-7 16-6-8-12-16-24-25-34z" />
      </g>
      {/* Laurel right */}
      <g fill={palette.rimFrom} opacity="0.85">
        <path d="M102 70c6 4 10 10 11 16-5-2-10-3-14-2 4 4 6 9 6 14-5-3-10-4-15-3 3 5 4 10 3 15-6-5-11-7-16-6 8-12 16-24 25-34z" />
      </g>

      {/* Accent stars */}
      <g fill={palette.star} filter={`url(#${ids.glow})`}>
        <path d="M64 9l1.6 3.6 3.8.4-2.9 2.6.9 3.7L64 17.2l-3.4 2.1.9-3.7-2.9-2.6 3.8-.4L64 9z" />
        <path d="M38 32l1.2 2.7 2.9.3-2.2 1.9.7 2.8-2.6-1.5-2.6 1.5.7-2.8-2.2-1.9 2.9-.3L38 32z" />
        <path d="M90 32l1.2 2.7 2.9.3-2.2 1.9.7 2.8-2.6-1.5-2.6 1.5.7-2.8-2.2-1.9 2.9-.3L90 32z" />
      </g>

      {/* Centre glyph — smaller outline emblems, optically centred */}
      <g transform="translate(64 52)" filter={`url(#${ids.glow})`}>
        <g transform="translate(0.35 0.5)" opacity="0.35">
          <g transform="scale(2.15) translate(-12 -12)">
            <BadgeIcon glyph={glyph} fill="#000000" {...(mark ? { mark } : {})} />
          </g>
        </g>
        <g transform="scale(2.15) translate(-12 -12)">
          <BadgeIcon glyph={glyph} fill={palette.accent} {...(mark ? { mark } : {})} />
        </g>
      </g>

      {/* Glitter sparkles */}
      {earned ? (
        <g className="badge-glitter" filter={`url(#${ids.glitter})`} pointerEvents="none">
          <circle className="badge-glitter-dot" cx="48" cy="36" r="1.6" fill="#fff" />
          <circle
            className="badge-glitter-dot"
            cx="78"
            cy="42"
            r="1.3"
            fill="#fff"
            style={{ animationDelay: "0.4s" }}
          />
          <circle
            className="badge-glitter-dot"
            cx="58"
            cy="52"
            r="1.1"
            fill={palette.star}
            style={{ animationDelay: "0.8s" }}
          />
          <circle
            className="badge-glitter-dot"
            cx="72"
            cy="58"
            r="1.4"
            fill="#fff"
            style={{ animationDelay: "1.2s" }}
          />
          <circle
            className="badge-glitter-dot"
            cx="44"
            cy="62"
            r="1"
            fill={palette.star}
            style={{ animationDelay: "0.2s" }}
          />
          <circle
            className="badge-glitter-dot"
            cx="84"
            cy="54"
            r="1.2"
            fill="#fff"
            style={{ animationDelay: "1s" }}
          />
          <path
            className="badge-glitter-star"
            d="M52 44l0.7 1.5 1.6.2-1.2 1.1.4 1.6-1.5-.9-1.5.9.4-1.6-1.2-1.1 1.6-.2L52 44z"
            fill="#fff"
          />
          <path
            className="badge-glitter-star"
            d="M76 48l0.7 1.5 1.6.2-1.2 1.1.4 1.6-1.5-.9-1.5.9.4-1.6-1.2-1.1 1.6-.2L76 48z"
            fill="#fff"
            style={{ animationDelay: "0.6s" }}
          />
          <path
            className="badge-glitter-star"
            d="M64 66l0.8 1.7 1.8.2-1.4 1.2.4 1.8-1.6-1-1.6 1 .4-1.8-1.4-1.2 1.8-.2L64 66z"
            fill={palette.star}
            style={{ animationDelay: "1.4s" }}
          />
        </g>
      ) : null}
    </svg>
  );
}
