import { useId, type ReactNode } from "react";
import type { AvatarDefinition } from "./avatarMap";
import {
  BG,
  CLOTH,
  HAIR,
  SKIN,
  type Accessory,
  type FaceExtra,
  type HairStyle,
  type Outfit,
} from "./tokens";

type AvatarSvgProps = {
  def: AvatarDefinition;
  title?: string | undefined;
  className?: string | undefined;
};

/** Renders one catalog avatar as pure inline SVG (24–512px). */
export function AvatarSvg({ def, title, className }: AvatarSvgProps) {
  const uid = useId().replace(/:/g, "");
  const label = title ?? def.label;

  if (def.kind === "robot")
    return <RobotSvg def={def} uid={uid} label={label} className={className} />;
  if (def.kind === "mascot")
    return <MascotSvg def={def} uid={uid} label={label} className={className} />;
  if (def.kind === "initials")
    return <InitsSvg def={def} uid={uid} label={label} className={className} />;
  if (def.kind === "placeholder")
    return <PlaceholderSvg uid={uid} label={label} className={className} />;

  return <HumanSvg def={def} uid={uid} label={label} className={className} />;
}

function SvgShell({
  uid,
  label,
  desc,
  className,
  children,
}: {
  uid: string;
  label: string;
  desc: string;
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={label}
      className={className}
      style={{ display: "block", width: "100%", height: "100%" }}
    >
      <title id={`t-${uid}`}>{label}</title>
      <desc id={`d-${uid}`}>{desc}</desc>
      {children}
    </svg>
  );
}

function HumanSvg({
  def,
  uid,
  label,
  className,
}: {
  def: AvatarDefinition;
  uid: string;
  label: string;
  className?: string | undefined;
}) {
  const bg = BG[def.bg ?? "sky"];
  const skin = SKIN[def.skin ?? "light"];
  const hair = HAIR[def.hair ?? "darkBrown"];
  const cloth = CLOTH[def.cloth ?? "navy"];
  const lip = "#C47A5A";
  const style = def.hairStyle ?? "short";
  const outfit = def.outfit ?? "shirt";
  const accessory = def.accessory ?? "none";
  const face = def.face ?? "none";
  const youth = def.age === "youth";
  const headR = youth ? 26 : 29;
  const headY = youth ? 56 : 54;

  return (
    <SvgShell
      uid={uid}
      label={label}
      desc={`${def.category} avatar illustration`}
      className={className}
    >
      <defs>
        <linearGradient id={`bg-${uid}`} x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor={bg} />
          <stop offset="100%" stopColor={bg} stopOpacity="0.75" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="60" fill={`url(#bg-${uid})`} />

      {/* Shoulders / outfit */}
      <OutfitShape outfit={outfit} color={cloth} youth={youth} />

      {/* Hair behind (long styles) */}
      {(style === "long" ||
        style === "curly" ||
        style === "ponytail" ||
        style === "afro" ||
        style === "hijab") && <HairBack style={style} color={hair} />}

      {/* Head */}
      <circle cx="60" cy={headY} r={headR} fill={skin} />

      {/* Hair front / headwear */}
      <HairFront style={style} color={hair} />

      {/* Face */}
      <circle cx={youth ? 50 : 48} cy={headY + 2} r={youth ? 2.6 : 3} fill="#1a1a1a" />
      <circle cx={youth ? 70 : 72} cy={headY + 2} r={youth ? 2.6 : 3} fill="#1a1a1a" />
      <path
        d={youth ? "M54 70c2.5 3 9 3 12 0" : "M52 70c3 4 13 4 16 0"}
        fill="none"
        stroke={lip}
        strokeWidth={youth ? 1.8 : 2.1}
        strokeLinecap="round"
      />
      {/* Brows */}
      <path
        d={
          youth
            ? "M44 50c3-1.5 6-1.5 8 0M68 50c3-1.5 6-1.5 8 0"
            : "M42 48c4-2 8-2 10 0M68 48c4-2 8-2 10 0"
        }
        fill="none"
        stroke={hair}
        strokeWidth={1.7}
        strokeLinecap="round"
      />

      <FaceExtras face={face} skin={skin} hair={hair} headY={headY} />
      <Accessories accessory={accessory} cloth={cloth} />
    </SvgShell>
  );
}

function OutfitShape({ outfit, color, youth }: { outfit: Outfit; color: string; youth: boolean }) {
  const top = youth ? 86 : 78;
  const body = `M${youth ? 26 : 20} 120c${youth ? 6 : 8}-${youth ? 22 : 28} ${youth ? 22 : 28}-${youth ? 34 : 42} ${youth ? 34 : 40}-${youth ? 34 : 42}s${youth ? 28 : 32} ${youth ? 12 : 14} ${youth ? 34 : 40} ${youth ? 34 : 42}`;

  if (outfit === "blazer" || outfit === "tie") {
    return (
      <g>
        <path d={body} fill={color} />
        <path d="M52 86h16v34H52z" fill="#F5F7FA" opacity="0.95" />
        {outfit === "tie" ? <path d="M60 88l4 10-4 22-4-22 4-10z" fill="#C62828" /> : null}
        <path d="M40 86l12 8M80 86l-12 8" stroke="#0f172a" strokeOpacity="0.15" strokeWidth="3" />
      </g>
    );
  }
  if (outfit === "polo") {
    return (
      <g>
        <path d={body} fill={color} />
        <path d="M54 86h12v8H54z" fill="#fff" opacity="0.35" />
        <circle cx="60" cy="92" r="1.4" fill="#fff" opacity="0.7" />
      </g>
    );
  }
  if (outfit === "hoodie") {
    return (
      <g>
        <path d={body} fill={color} />
        <path
          d={`M40 ${top}c6 4 12 6 20 6s14-2 20-6`}
          fill="none"
          stroke="#0f172a"
          strokeOpacity="0.2"
          strokeWidth="3"
        />
        <path
          d="M48 92h24"
          stroke="#0f172a"
          strokeOpacity="0.18"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </g>
    );
  }
  if (outfit === "sweater") {
    return (
      <g>
        <path d={body} fill={color} />
        <path
          d={`M38 ${top + 4}h44`}
          stroke="#fff"
          strokeOpacity="0.25"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </g>
    );
  }
  if (outfit === "lab") {
    return (
      <g>
        <path d={body} fill="#ECEFF1" />
        <path d="M48 86h24v34H48z" fill={color} opacity="0.85" />
      </g>
    );
  }
  if (outfit === "grad") {
    return (
      <g>
        <path d={body} fill={color} />
        <path d="M36 90l24-6 24 6v30H36z" fill={color} />
        <path d="M58 84h4v36h-4z" fill="#FFD54F" />
      </g>
    );
  }
  // tee / shirt default
  return <path d={body} fill={color} />;
}

function HairBack({ style, color }: { style: HairStyle; color: string }) {
  if (style === "hijab") {
    return (
      <path d="M24 58c2-30 18-48 36-48s34 18 36 48c-4-18-18-28-36-28S28 40 24 58Z" fill={color} />
    );
  }
  if (style === "long" || style === "ponytail") {
    return (
      <path
        d="M26 58c4 22 12 36 18 40 2-12 8-20 16-20s14 8 16 20c6-4 14-18 18-40-6 10-18 16-34 16S32 68 26 58Z"
        fill={color}
      />
    );
  }
  if (style === "curly") {
    return (
      <g fill={color}>
        <circle cx="34" cy="62" r="10" />
        <circle cx="86" cy="62" r="10" />
        <circle cx="30" cy="78" r="8" />
        <circle cx="90" cy="78" r="8" />
      </g>
    );
  }
  if (style === "afro") {
    return <circle cx="60" cy="48" r="40" fill={color} />;
  }
  return null;
}

function HairFront({ style, color }: { style: HairStyle; color: string }) {
  if (style === "bald") return null;
  if (style === "hijab") {
    return (
      <g fill={color}>
        <path d="M26 58c3 18 10 30 16 34V70c4-6 10-10 18-10s14 4 18 10v22c6-4 13-16 16-34-6 8-16 14-32 14S32 66 26 58Z" />
        <path d="M36 70h48" stroke="#0f172a" strokeOpacity="0.12" strokeWidth="3" />
      </g>
    );
  }
  if (style === "turban") {
    return (
      <g fill={color}>
        <path d="M28 52c4-20 16-34 32-34s28 14 32 34c-6-10-18-16-32-16S34 42 28 52Z" />
        <path d="M30 54c2 4 14 8 30 8s28-4 30-8c-4 10-16 16-30 16S34 64 30 54Z" />
        <circle cx="60" cy="36" r="4" fill="#FFD54F" />
      </g>
    );
  }
  if (style === "buzz") {
    return <path d="M32 50c3-18 14-28 28-28s25 10 28 28H32Z" fill={color} opacity="0.85" />;
  }
  if (style === "side") {
    return (
      <g fill={color}>
        <path d="M30 46c4-22 16-34 30-34s26 12 30 34c-8-10-18-15-30-15S38 36 30 46Z" />
        <path d="M34 48c0-8 10-14 26-14s26 6 26 14v4H34v-4Z" />
      </g>
    );
  }
  if (style === "bun" || style === "ponytail") {
    return (
      <g fill={color}>
        <path d="M30 48c2-22 14-34 30-34s28 12 30 34c-6-10-18-16-30-16S36 38 30 48Z" />
        {style === "bun" ? (
          <circle cx="60" cy="18" r="10" />
        ) : (
          <ellipse cx="92" cy="48" rx="10" ry="14" />
        )}
      </g>
    );
  }
  if (style === "bob") {
    return (
      <g fill={color}>
        <path d="M28 42c4-18 16-30 32-30s28 12 32 30v8c-6-8-18-12-32-12S34 42 28 50v-8Z" />
        <path d="M30 55c2 14 8 24 14 28V70c4-6 10-10 16-10s12 4 16 10v13c6-4 12-14 14-28-4 8-14 14-30 14S34 63 30 55Z" />
      </g>
    );
  }
  if (style === "afro") {
    return <path d="M34 52c4-16 14-26 26-26s22 10 26 26H34Z" fill={color} />;
  }
  if (style === "curly") {
    return (
      <g fill={color}>
        <path d="M30 48c2-22 14-34 30-34s28 12 30 34c-6-10-18-16-30-16S36 38 30 48Z" />
        <circle cx="40" cy="34" r="7" />
        <circle cx="60" cy="28" r="8" />
        <circle cx="80" cy="34" r="7" />
      </g>
    );
  }
  if (style === "long") {
    return (
      <path d="M30 48c2-22 14-34 30-34s28 12 30 34c-6-10-18-16-30-16S36 38 30 48Z" fill={color} />
    );
  }
  // short default
  return (
    <g fill={color}>
      <path d="M30 48c2-22 14-34 30-34s28 12 30 34c-6-10-18-16-30-16S36 38 30 48Z" />
      <path d="M38 42c8-6 16-8 22-8s14 2 22 8v6c-8-5-15-7-22-7s-14 2-22 7v-6Z" />
    </g>
  );
}

function FaceExtras({
  face,
  skin,
  hair,
  headY,
}: {
  face: FaceExtra;
  skin: string;
  hair: string;
  headY: number;
}) {
  if (face === "blush") {
    return (
      <g>
        <circle cx="44" cy={headY + 8} r="3" fill="#E091A8" opacity="0.7" />
        <circle cx="76" cy={headY + 8} r="3" fill="#E091A8" opacity="0.7" />
      </g>
    );
  }
  if (face === "mustache") {
    return (
      <path
        d={`M50 ${headY + 12}c4 4 16 4 20 0`}
        fill="none"
        stroke={hair}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    );
  }
  if (face === "beard") {
    return (
      <path
        d={`M45 ${headY + 18}c2 10 8 14 15 14s13-4 15-14c-4 3-9 5-15 5s-11-2-15-5Z`}
        fill={hair}
        opacity="0.95"
      />
    );
  }
  return null;
}

function Accessories({ accessory, cloth }: { accessory: Accessory; cloth: string }) {
  if (accessory === "glasses") {
    return (
      <g fill="none" stroke="#263238" strokeWidth="2">
        <rect x="38" y="50" width="16" height="12" rx="3" />
        <rect x="66" y="50" width="16" height="12" rx="3" />
        <path d="M54 56h12" />
      </g>
    );
  }
  if (accessory === "headset") {
    return (
      <g>
        <path
          d="M34 52c0-16 12-28 26-28s26 12 26 28"
          fill="none"
          stroke="#37474F"
          strokeWidth="3.5"
        />
        <rect x="28" y="52" width="10" height="16" rx="3" fill="#455A64" />
        <rect x="82" y="52" width="10" height="16" rx="3" fill="#455A64" />
        <circle cx="88" cy="78" r="5" fill={cloth} />
      </g>
    );
  }
  if (accessory === "cap") {
    return (
      <g fill="#37474F">
        <path d="M32 48c4-18 14-28 28-28s24 10 28 28H32Z" />
        <path d="M28 50h64v6H28z" />
      </g>
    );
  }
  if (accessory === "laptop") {
    return (
      <g>
        <rect x="38" y="96" width="44" height="18" rx="2" fill="#90A4AE" />
        <rect x="42" y="88" width="36" height="12" rx="1.5" fill="#546E7A" />
      </g>
    );
  }
  if (accessory === "backpack") {
    return (
      <g fill="#5D4037" opacity="0.85">
        <rect x="22" y="88" width="14" height="24" rx="3" />
        <rect x="84" y="88" width="14" height="24" rx="3" />
      </g>
    );
  }
  return null;
}

function RobotSvg({
  def,
  uid,
  label,
  className,
}: {
  def: AvatarDefinition;
  uid: string;
  label: string;
  className?: string | undefined;
}) {
  const accent = def.robotColor ?? "#42A5F5";
  const bg = BG[def.bg ?? "slate"];
  return (
    <SvgShell uid={uid} label={label} desc="Friendly robot avatar" className={className}>
      <rect width="120" height="120" rx="60" fill={bg} />
      <rect x="28" y="78" width="64" height="36" rx="12" fill={accent} opacity="0.9" />
      <rect x="34" y="32" width="52" height="48" rx="14" fill={accent} />
      <rect x="40" y="40" width="40" height="28" rx="8" fill="#0F172A" opacity="0.35" />
      <circle cx="50" cy="54" r="5" fill="#E3F2FD" />
      <circle cx="70" cy="54" r="5" fill="#E3F2FD" />
      <circle cx="50" cy="54" r="2.2" fill="#0F172A" />
      <circle cx="70" cy="54" r="2.2" fill="#0F172A" />
      <rect x="48" y="66" width="24" height="5" rx="2.5" fill="#0F172A" opacity="0.35" />
      <rect x="56" y="22" width="8" height="12" rx="2" fill={accent} />
      <circle cx="60" cy="20" r="5" fill="#FFD54F" />
      <rect x="18" y="48" width="12" height="8" rx="3" fill={accent} />
      <rect x="90" y="48" width="12" height="8" rx="3" fill={accent} />
    </SvgShell>
  );
}

function MascotSvg({
  def,
  uid,
  label,
  className,
}: {
  def: AvatarDefinition;
  uid: string;
  label: string;
  className?: string | undefined;
}) {
  const mascot = def.mascot ?? "panda";
  const bg = BG[def.bg ?? "cream"];

  return (
    <SvgShell uid={uid} label={label} desc={`${mascot} mascot avatar`} className={className}>
      <rect width="120" height="120" rx="60" fill={bg} />
      {mascot === "panda" && <Panda />}
      {mascot === "fox" && <Fox />}
      {mascot === "owl" && <Owl />}
      {mascot === "cat" && <Cat />}
      {mascot === "penguin" && <Penguin />}
      {mascot === "bear" && <Bear />}
    </SvgShell>
  );
}

function Panda() {
  return (
    <g>
      <circle cx="36" cy="40" r="14" fill="#212121" />
      <circle cx="84" cy="40" r="14" fill="#212121" />
      <circle cx="60" cy="62" r="34" fill="#FAFAFA" />
      <ellipse cx="46" cy="58" rx="10" ry="12" fill="#212121" />
      <ellipse cx="74" cy="58" rx="10" ry="12" fill="#212121" />
      <circle cx="46" cy="58" r="4" fill="#FAFAFA" />
      <circle cx="74" cy="58" r="4" fill="#FAFAFA" />
      <ellipse cx="60" cy="70" rx="6" ry="4" fill="#212121" />
      <path
        d="M52 80c4 5 12 5 16 0"
        fill="none"
        stroke="#212121"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </g>
  );
}

function Fox() {
  return (
    <g>
      <path d="M28 48 44 28l16 12L76 28l16 20-8 40H36L28 48z" fill="#EF6C00" />
      <path d="M44 28l16 12L76 28v8L60 48 44 36v-8z" fill="#FFE0B2" />
      <circle cx="48" cy="58" r="4" fill="#212121" />
      <circle cx="72" cy="58" r="4" fill="#212121" />
      <path d="M60 64l-6 8h12l-6-8z" fill="#212121" />
      <path d="M40 88c8 8 32 8 40 0" fill="#FFE0B2" />
    </g>
  );
}

function Owl() {
  return (
    <g>
      <ellipse cx="60" cy="66" rx="32" ry="34" fill="#6D4C41" />
      <circle cx="46" cy="58" r="14" fill="#FFF8E1" />
      <circle cx="74" cy="58" r="14" fill="#FFF8E1" />
      <circle cx="46" cy="58" r="6" fill="#212121" />
      <circle cx="74" cy="58" r="6" fill="#212121" />
      <path d="M54 72l6 8 6-8z" fill="#FFB300" />
      <path d="M36 36l10 14M84 36 74 50" stroke="#5D4037" strokeWidth="4" strokeLinecap="round" />
    </g>
  );
}

function Cat() {
  return (
    <g>
      <path d="M34 44l10-18 10 14M86 44 76 26 66 40" fill="#FFB74D" />
      <circle cx="60" cy="64" r="32" fill="#FFB74D" />
      <circle cx="48" cy="62" r="4" fill="#212121" />
      <circle cx="72" cy="62" r="4" fill="#212121" />
      <path d="M60 68l-5 6h10l-5-6z" fill="#EF5350" />
      <path
        d="M42 78c6 2 12 2 18 0M60 78c6 2 12 2 18 0"
        fill="none"
        stroke="#EF6C00"
        strokeWidth="1.5"
      />
      <path
        d="M54 78c2 4 10 4 12 0"
        fill="none"
        stroke="#212121"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </g>
  );
}

function Penguin() {
  return (
    <g>
      <ellipse cx="60" cy="66" rx="30" ry="36" fill="#212121" />
      <ellipse cx="60" cy="72" rx="20" ry="26" fill="#FAFAFA" />
      <circle cx="50" cy="54" r="4" fill="#FAFAFA" />
      <circle cx="70" cy="54" r="4" fill="#FAFAFA" />
      <circle cx="50" cy="54" r="2" fill="#212121" />
      <circle cx="70" cy="54" r="2" fill="#212121" />
      <path d="M60 60l-5 6h10l-5-6z" fill="#FFB300" />
      <path d="M40 88l-12 10M80 88l12 10" stroke="#FFB300" strokeWidth="5" strokeLinecap="round" />
    </g>
  );
}

function Bear() {
  return (
    <g>
      <circle cx="36" cy="40" r="12" fill="#8D6E63" />
      <circle cx="84" cy="40" r="12" fill="#8D6E63" />
      <circle cx="60" cy="64" r="34" fill="#A1887F" />
      <ellipse cx="60" cy="74" rx="16" ry="12" fill="#D7CCC8" />
      <circle cx="48" cy="58" r="4" fill="#3E2723" />
      <circle cx="72" cy="58" r="4" fill="#3E2723" />
      <ellipse cx="60" cy="68" rx="5" ry="3.5" fill="#5D4037" />
      <path
        d="M52 80c4 4 12 4 16 0"
        fill="none"
        stroke="#5D4037"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </g>
  );
}

function InitsSvg({
  def,
  uid,
  label,
  className,
}: {
  def: AvatarDefinition;
  uid: string;
  label: string;
  className?: string | undefined;
}) {
  const letter = (def.initials ?? "?").slice(0, 2).toUpperCase();
  const from = def.gradientFrom ?? "#2563EB";
  const to = def.gradientTo ?? "#7C3AED";
  return (
    <SvgShell uid={uid} label={label} desc={`Initials avatar ${letter}`} className={className}>
      <defs>
        <linearGradient id={`ig-${uid}`} x1="15%" y1="10%" x2="85%" y2="90%">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="60" fill={`url(#ig-${uid})`} />
      <text
        x="60"
        y="68"
        textAnchor="middle"
        fontSize={letter.length > 1 ? "42" : "52"}
        fontWeight="700"
        fill="#fff"
        fontFamily="system-ui, Segoe UI, sans-serif"
      >
        {letter}
      </text>
    </SvgShell>
  );
}

function PlaceholderSvg({
  uid,
  label,
  className,
}: {
  uid: string;
  label: string;
  className?: string | undefined;
}) {
  return (
    <SvgShell uid={uid} label={label} desc="Anonymous placeholder avatar" className={className}>
      <rect width="120" height="120" rx="60" fill="#ECEFF1" />
      <circle cx="60" cy="48" r="20" fill="#90A4AE" />
      <path d="M24 112c8-24 24-36 36-36s28 12 36 36" fill="#90A4AE" />
    </SvgShell>
  );
}
