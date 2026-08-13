import type { BadgeGlyphId } from "./badgeMap";

type GlyphProps = {
  fill?: string | undefined;
  className?: string | undefined;
  mark?: string | undefined;
};

const stroke = (color: string | undefined) => ({
  fill: "none" as const,
  stroke: color ?? "#fbbf24",
  strokeWidth: 1.65,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

/**
 * Outline emblems — viewBox 0 0 24 24.
 * Open line-art (not solid fills) so the shield colour shows through.
 */
export function BadgeIcon({
  glyph,
  fill = "#fbbf24",
  className,
  mark,
}: {
  glyph: BadgeGlyphId;
  fill?: string | undefined;
  className?: string | undefined;
  mark?: string | undefined;
}) {
  const common: GlyphProps = { fill };
  if (className) common.className = className;
  if (mark) common.mark = mark;

  if (mark || glyph === "mark") {
    return <MarkGlyph {...common} mark={mark ?? "★"} />;
  }
  switch (glyph) {
    case "trophy":
      return <TrophyGlyph {...common} />;
    case "medal":
      return <MedalGlyph {...common} />;
    case "award":
      return <AwardGlyph {...common} />;
    case "crown":
      return <CrownGlyph {...common} />;
    case "star":
      return <StarGlyph {...common} />;
    case "sparkles":
      return <SparklesGlyph {...common} />;
    case "target":
      return <TargetGlyph {...common} />;
    case "zap":
      return <ZapGlyph {...common} />;
    case "flame":
      return <FlameGlyph {...common} />;
    case "rocket":
      return <RocketGlyph {...common} />;
    case "gem":
      return <GemGlyph {...common} />;
    case "shield":
      return <ShieldGlyph {...common} />;
    case "brain":
      return <BrainGlyph {...common} />;
    case "trend":
      return <TrendGlyph {...common} />;
    case "refresh":
      return <RefreshGlyph {...common} />;
    case "timer":
      return <TimerGlyph {...common} />;
    case "flag":
      return <FlagGlyph {...common} />;
    case "check":
      return <CheckGlyph {...common} />;
    case "badge":
      return <BadgeCheckGlyph {...common} />;
    case "play":
      return <PlayGlyph {...common} />;
    case "book":
      return <BookGlyph {...common} />;
    case "layers":
      return <LayersGlyph {...common} />;
    case "users":
      return <UsersGlyph {...common} />;
    case "mountain":
      return <MountainGlyph {...common} />;
    case "percent":
      return <PercentGlyph {...common} />;
    case "orbit":
      return <OrbitGlyph {...common} />;
    case "handshake":
      return <HandshakeGlyph {...common} />;
    case "infinity":
      return <InfinityGlyph {...common} />;
    case "podium":
      return <PodiumGlyph {...common} />;
    case "fist":
      return <FistGlyph {...common} />;
    case "clipboard":
      return <ClipboardGlyph {...common} />;
    case "runner":
      return <RunnerGlyph {...common} />;
    case "bulb":
      return <BulbGlyph {...common} />;
    case "graduation":
      return <GraduationGlyph {...common} />;
    default:
      return <StarGlyph {...common} />;
  }
}

/** Outline number / percent with star accents. */
function MarkGlyph({ fill, className, mark = "★" }: GlyphProps) {
  const long = (mark?.length ?? 0) >= 3;
  const s = stroke(fill);
  return (
    <g className={className}>
      <path
        {...s}
        strokeWidth={1.4}
        d="M12 2.4 13 4.6l2.2.2-1.7 1.55.45 2.15L12 7.4l-1.95 1.1.45-2.15-1.7-1.55 2.2-.2L12 2.4z"
      />
      <circle cx="12" cy="14.2" r={long ? 6.2 : 6.6} {...s} />
      <text
        x="12"
        y="14.35"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={fill}
        fontSize={long ? "5.6" : "8"}
        fontWeight="700"
        fontFamily="system-ui, Segoe UI, sans-serif"
        letterSpacing={long ? "-0.35" : "0"}
      >
        {mark}
      </text>
    </g>
  );
}

function TrophyGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <g className={className} {...s}>
      <path d="M8 4.2h8v1.4c2 .25 3.3 1.5 3.3 3.3 0 1.35-.75 2.45-1.9 3-.65 1.9-2.15 3.15-4.1 3.5v1.4h2.2v1.3H8.5v-1.3H10.7v-1.4c-1.95-.35-3.45-1.6-4.1-3.5C5.45 11.35 4.7 10.25 4.7 8.9c0-1.8 1.3-3.05 3.3-3.3V4.2z" />
      <path d="M9.5 18.8h5" />
      <path d="M8.5 20.5h7" />
    </g>
  );
}

/** Ribbon medal — outline. */
function MedalGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <g className={className}>
      <path {...s} d="M8.2 3.2 12 5.6l3.8-2.4" />
      <path {...s} d="M8.2 3.2 7.5 8.2 12 10.6l4.5-2.4-.7-5" />
      <circle cx="12" cy="16.2" r="4.6" {...s} />
      <circle cx="12" cy="16.2" r="2" {...s} strokeWidth={1.35} />
      <path {...s} strokeWidth={1.35} d="M12 14.4v3.6M10.2 16.2h3.6" />
    </g>
  );
}

/** Round award with ribbon tails. */
function AwardGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <g className={className}>
      <circle cx="12" cy="9" r="5.2" {...s} />
      <circle cx="12" cy="9" r="2.2" {...s} strokeWidth={1.35} />
      <path {...s} d="M9.2 13.6 8 20.8 12 18.4l4 2.4-1.2-7.2" />
    </g>
  );
}

function CrownGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <g className={className}>
      <path {...s} d="M4 9.5 7.5 13 12 5.5 16.5 13 20 9.5 18.6 18.5H5.4L4 9.5z" />
      <path {...s} strokeWidth={1.35} d="M6.5 18.5h11" />
    </g>
  );
}

function StarGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <path
      className={className}
      {...s}
      d="M12 3.2 14.2 9.2l6.3.5-4.9 4.1 1.5 6.2L12 16.8 6.9 20l1.5-6.2-4.9-4.1 6.3-.5L12 3.2z"
    />
  );
}

function SparklesGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <g className={className}>
      <path
        {...s}
        d="M12 3.5 13.4 7.8 17.5 9.2 13.4 10.6 12 14.9 10.6 10.6 6.5 9.2 10.6 7.8 12 3.5z"
      />
      <path
        {...s}
        strokeWidth={1.35}
        d="M18.2 14.2 19 16.4l2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z"
      />
      <path
        {...s}
        strokeWidth={1.35}
        d="M5.5 14.8 6.1 16.5l1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6.6-1.7z"
      />
    </g>
  );
}

/** Target with arrow — outline. */
function TargetGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <g className={className}>
      <circle cx="11.2" cy="12.8" r="7.2" {...s} />
      <circle cx="11.2" cy="12.8" r="4.4" {...s} strokeWidth={1.45} />
      <circle cx="11.2" cy="12.8" r="1.6" {...s} strokeWidth={1.35} />
      <path {...s} d="M14.6 7.2 20.2 3.6l-1.1 5.6" />
      <path {...s} strokeWidth={1.4} d="M13.4 9.4 18.8 5.6" />
    </g>
  );
}

function ZapGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <path className={className} {...s} d="M13.2 3.2 7 12.5h4.2L9.6 20.8 17.2 10.2h-4.2L13.2 3.2z" />
  );
}

function FlameGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <g className={className}>
      <path
        {...s}
        d="M12 3.2c1.1 2.4 3.2 4 3.2 7 0 1.1-.35 2-.95 2.75.95-.4 1.65-1.45 1.65-2.85 0-.55.05-1.1.3-1.6 1.25 1.45 2 3.2 2 5.2 0 3.5-2.85 6.35-6.2 6.35S5.8 16.85 5.8 13.35c0-2.9 1.95-5 3.85-7 .4 1.2 1.05 2.15 1.75 2.9-.15-.95-.1-2 .6-4.05z"
      />
      <path
        {...s}
        strokeWidth={1.35}
        d="M12 11.5c.55 1.1 1.4 1.7 1.4 2.9 0 1.2-.75 2.1-1.4 2.1s-1.4-.9-1.4-2.1c0-1.2.85-1.8 1.4-2.9z"
      />
    </g>
  );
}

function RocketGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <g className={className}>
      <path
        {...s}
        d="M12.4 3.2c2.2.45 4.1 2.35 4.5 4.55.3 1.9-.85 4.75-2.55 6.55l.55 1.8-1.85-.3-.95 1.4-1.25-1.25-1.35 1.25-.95-1.4-1.85.3.55-1.8C6.6 12.5 5.45 9.65 5.75 7.75c.4-2.2 2.3-4.1 4.5-4.55 0 0 1.4.35 2.15 0z"
      />
      <circle cx="12.6" cy="8.8" r="1.35" {...s} strokeWidth={1.35} />
      <path {...s} strokeWidth={1.35} d="M8.4 16.8 6.6 19.4M15.6 16.8 17.4 19.4" />
    </g>
  );
}

function GemGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <g className={className}>
      <path {...s} d="M8.2 4.5h7.6L20 9.2 12 20 4 9.2l4.2-4.7z" />
      <path {...s} strokeWidth={1.35} d="M8.2 4.5 12 9.2 15.8 4.5M4 9.2h16M12 9.2V20" />
    </g>
  );
}

function ShieldGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <g className={className}>
      <path
        {...s}
        d="M12 3.2 19.2 6.2v5.2c0 4.2-2.9 7.2-7.2 8.5-4.3-1.3-7.2-4.3-7.2-8.5V6.2L12 3.2z"
      />
      <path {...s} strokeWidth={1.35} d="M12 7.5v8.5M8.8 11.2h6.4" />
    </g>
  );
}

function BrainGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <path
      className={className}
      {...s}
      d="M9.2 5.2c.9 0 1.7.4 2.2 1.1.5-.7 1.3-1.1 2.2-1.1 1.55 0 2.8 1.2 2.8 2.7 0 .35-.05.7-.2 1 .65.5 1.05 1.3 1.05 2.2 0 1.1-.65 2.05-1.55 2.45v3.1h-1.9v-2h-1.4v3.6h-1.9v-3.6H9.3v2H7.4v-3.1c-.9-.4-1.55-1.35-1.55-2.45 0-.9.4-1.7 1.05-2.2-.15-.3-.2-.65-.2-1 0-1.5 1.25-2.7 2.8-2.7z"
    />
  );
}

function TrendGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <g className={className}>
      <path {...s} d="M4.2 16.5v3.2M9.2 12.5v7.2M14.2 8.2v11.5M19.2 5.5v14.2" />
      <path {...s} d="M15.5 5.2h4.5v4.5" />
      <path {...s} d="M20 5.2 13.2 12 9.5 8.4 4.5 13.4" />
    </g>
  );
}

function RefreshGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <g className={className}>
      <path {...s} d="M19.2 8.2A7.4 7.4 0 0 0 6.4 7.1" />
      <path {...s} d="M4.8 15.8a7.4 7.4 0 0 0 12.8 1.1" />
      <path {...s} d="M19.2 8.2h-3.6M19.2 8.2V4.8M4.8 15.8h3.6M4.8 15.8v3.4" />
    </g>
  );
}

function TimerGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <g className={className}>
      <path {...s} d="M9.5 3.2h5" />
      <circle cx="12" cy="13.2" r="6.2" {...s} />
      <path {...s} d="M12 4.8v1.6" />
      <path {...s} d="M12 13.2 12 9.4M12 13.2 15.4 15.2" />
      <path {...s} strokeWidth={1.35} d="M18.6 7.2l1.8-1.8M20.2 9.8h2" />
    </g>
  );
}

function FlagGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <g className={className}>
      <path {...s} d="M6.2 3.5v17" />
      <path {...s} d="M6.2 4.2 11.2 6.8l4-2.4 4.2 2.6v8.2l-4.2-2.4-4 2.4-5-2.8z" />
    </g>
  );
}

function CheckGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <g className={className}>
      <circle cx="12" cy="12" r="8.4" {...s} />
      <path {...s} d="M7.6 12.2 10.6 15.2 16.6 9.2" />
    </g>
  );
}

function BadgeCheckGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <g className={className}>
      <path
        {...s}
        d="M12 3 13.7 5.4l3.1.5-.55 3.05 2.15 2.25-2.15 2.25.55 3.05-3.1.5L12 19.4l-1.7-2.4-3.1-.5.55-3.05-2.15-2.25 2.15-2.25-.55-3.05 3.1-.5L12 3z"
      />
      <path {...s} d="M9.4 11.8 11.2 13.6 14.8 10" />
    </g>
  );
}

function PlayGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <g className={className}>
      <circle cx="12" cy="12" r="8.4" {...s} />
      <path {...s} d="M10 8.5v7L16.5 12 10 8.5z" />
    </g>
  );
}

function BookGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <g className={className}>
      <path {...s} d="M5.5 5h5.2c1.3 0 2.3.95 2.3 2.15v11.2c-.7-.35-1.45-.55-2.3-.55H5.5V5z" />
      <path {...s} d="M18.5 5h-5.2c-1.3 0-2.3.95-2.3 2.15v11.2c.7-.35 1.45-.55 2.3-.55h5.2V5z" />
    </g>
  );
}

function LayersGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <g className={className}>
      <path {...s} d="M12 4.2 19.8 8.5 12 12.8 4.2 8.5 12 4.2z" />
      <path {...s} d="M4.2 12.2 12 16.5l7.8-4.3" />
      <path {...s} d="M4.2 15.8 12 20.1l7.8-4.3" />
    </g>
  );
}

function UsersGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <g className={className}>
      <circle cx="9" cy="8.2" r="2.6" {...s} />
      <circle cx="16.2" cy="7.6" r="2.1" {...s} />
      <path {...s} d="M3.8 18.5v-1.3c0-2 2.2-3.6 5.2-3.6s5.2 1.6 5.2 3.6v1.3" />
      <path {...s} d="M14.6 18.5v-1c0-1.35 1.4-2.45 3.2-2.45 1.5 0 2.8.75 3.2 1.85" />
    </g>
  );
}

function MountainGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return <path className={className} {...s} d="M3.5 18.5 9.2 9.5l2.6 3.8L15.5 8l5 10.5z" />;
}

function PercentGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <g className={className}>
      <circle cx="7.5" cy="7.5" r="2.4" {...s} />
      <circle cx="16.5" cy="16.5" r="2.4" {...s} />
      <path {...s} d="M17.5 6.2 6.5 17.8" />
    </g>
  );
}

function OrbitGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <g className={className}>
      <circle cx="12" cy="12" r="2.6" {...s} />
      <ellipse cx="12" cy="12" rx="8.5" ry="3.8" {...s} transform="rotate(-28 12 12)" />
      <circle cx="18.4" cy="7.4" r="1.2" {...s} strokeWidth={1.35} />
    </g>
  );
}

function HandshakeGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <g className={className}>
      <path {...s} d="M4.5 11.2 8.5 8l2 2-2.4 1.9 1.3 1.7 2.1-1.65 1.3 1.3-2.5 2-3-2.3-1.9 1.5" />
      <path
        {...s}
        d="M19.5 11.2 15.5 8l-2 2 2.4 1.9-1.3 1.7-2.1-1.65-1.3 1.3 2.5 2 3-2.3 1.9 1.5"
      />
      <path {...s} d="M9.8 14.2 12 15.9l2.2-1.7" />
    </g>
  );
}

function InfinityGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <path
      className={className}
      {...s}
      d="M7.8 8.5c2.2 0 3.5 1.45 4.9 3.1 1.4-1.65 2.8-3.1 5-3.1 2.2 0 3.8 1.8 3.8 4s-1.6 4-3.8 4c-2.2 0-3.6-1.45-5-3.1-1.4 1.65-2.7 3.1-4.9 3.1-2.2 0-3.8-1.8-3.8-4s1.6-4 3.8-4z"
    />
  );
}

function PodiumGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <g className={className}>
      <path {...s} d="M9.2 7.2h5.6v12.5H9.2z" />
      <path {...s} d="M3.5 11.5h5v8.2h-5z" />
      <path {...s} d="M15.5 13.5h5v6.2h-5z" />
      <path
        {...s}
        strokeWidth={1.4}
        d="M12 3.2 13 5.4l2.2.2-1.7 1.55.45 2.1L12 8.05l-1.95 1.2.45-2.1-1.7-1.55 2.2-.2L12 3.2z"
      />
    </g>
  );
}

function FistGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <g className={className}>
      <path {...s} d="M8.8 4.2h2v3.2M11.4 3.8h2v3.6M14 4.4h2v3.2" />
      <path
        {...s}
        d="M7.8 7.8h9.8c1.15 0 2.1.95 2.1 2.1v2c0 3.4-2.35 6.2-5.55 6.85v1.5H10.3v-1.65c-2.75-.95-4.65-3.5-4.65-6.45V10c0-1.2.95-2.2 2.15-2.2z"
      />
    </g>
  );
}

function ClipboardGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <g className={className}>
      <path {...s} d="M9 3.8h6" />
      <path
        {...s}
        d="M8.2 5.2h1.4V4.4c0-.55.45-1 1-1h2.8c.55 0 1 .45 1 1v.8h1.4c1 0 1.8.8 1.8 1.8v11.4c0 1-.8 1.8-1.8 1.8H8.2c-1 0-1.8-.8-1.8-1.8V7c0-1 .8-1.8 1.8-1.8z"
      />
      <path {...s} d="M9 12.2 11 14.2l4.2-4.2" />
    </g>
  );
}

function RunnerGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <g className={className}>
      <circle cx="14.2" cy="4.8" r="1.8" {...s} />
      <path
        {...s}
        d="M12.8 7.4c1.3.3 2.35 1.2 2.9 2.35l2.2 1-.65 1.45-2.35-1.05-.85 1.55 3 2.25-.9 1.2-3.7-2.8 1-3.8c-.15-.35-.5-.65-.95-.8L8.6 8.3"
      />
      <path {...s} d="M8.8 14.2 6.4 18.8M7.4 11.2 4.2 12.2" />
    </g>
  );
}

function BulbGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <g className={className}>
      <path {...s} d="M12 3.5a5.4 5.4 0 0 1 3.15 9.75V16H8.85v-2.75A5.4 5.4 0 0 1 12 3.5z" />
      <path {...s} d="M9.5 17.5h5M10.2 19.5h3.6" />
    </g>
  );
}

function GraduationGlyph({ fill, className }: GlyphProps) {
  const s = stroke(fill);
  return (
    <g className={className}>
      <path {...s} d="M12 4.2 20.5 8.2v1.1L12 13.2 3.5 9.3V8.2L12 4.2z" />
      <path {...s} d="M6.5 10.8v4.2c1.55 1 3.35 1.55 5.5 1.55s3.95-.55 5.5-1.55v-4.2" />
      <path {...s} d="M19.2 9.4v5.5" />
    </g>
  );
}

export const BADGE_GLYPH_IDS: BadgeGlyphId[] = [
  "trophy",
  "medal",
  "award",
  "crown",
  "star",
  "sparkles",
  "target",
  "zap",
  "flame",
  "rocket",
  "gem",
  "shield",
  "brain",
  "trend",
  "refresh",
  "timer",
  "flag",
  "check",
  "badge",
  "play",
  "book",
  "layers",
  "users",
  "mountain",
  "percent",
  "orbit",
  "handshake",
  "infinity",
  "podium",
  "fist",
  "clipboard",
  "runner",
  "bulb",
  "graduation",
  "mark",
];
