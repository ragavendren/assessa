/** Shared palette tokens for the flat SaaS avatar system. */

export const SKIN = {
  fair: "#F1C27D",
  light: "#E8B892",
  medium: "#E0AC69",
  tan: "#C68642",
  brown: "#8D5524",
  deep: "#5C3317",
} as const;

export const HAIR = {
  black: "#1A1A1A",
  darkBrown: "#3E2723",
  brown: "#5D4037",
  auburn: "#6D4C41",
  blonde: "#F9A825",
  lightBlonde: "#FFCA28",
  gray: "#78909C",
  blue: "#1565C0",
  purple: "#7B1FA2",
  pink: "#EC407A",
  teal: "#00897B",
} as const;

export const BG = {
  sky: "#DCEBFA",
  mint: "#E4F2E7",
  sand: "#F3E8D8",
  lavender: "#EDE7F6",
  blush: "#FCE4EC",
  ice: "#E1F5FE",
  cream: "#FFF8E1",
  lilac: "#E8EAF6",
  teal: "#E0F2F1",
  peach: "#FFF3E0",
  slate: "#ECEFF1",
  rose: "#F3E5F5",
  navy: "#E3F2FD",
  lime: "#E8F5E9",
} as const;

export const CLOTH = {
  navy: "#1E3A5F",
  forest: "#2F6B4F",
  brown: "#6B4E3D",
  purple: "#4527A0",
  magenta: "#AD1457",
  green: "#2E7D32",
  blue: "#1565C0",
  orange: "#EF6C00",
  sky: "#0288D1",
  amber: "#F9A825",
  leaf: "#43A047",
  violet: "#7B1FA2",
  pink: "#EC407A",
  indigo: "#5C6BC0",
  teal: "#00897B",
  tangerine: "#FB8C00",
  charcoal: "#37474F",
  crimson: "#C62828",
  steel: "#546E7A",
  white: "#F5F7FA",
  hoodie: "#455A64",
  black: "#212121",
} as const;

export type SkinTone = keyof typeof SKIN;
export type HairColor = keyof typeof HAIR;
export type BgTone = keyof typeof BG;
export type ClothColor = keyof typeof CLOTH;

export type HairStyle =
  | "short"
  | "buzz"
  | "side"
  | "long"
  | "curly"
  | "bun"
  | "ponytail"
  | "afro"
  | "bob"
  | "bald"
  | "hijab"
  | "turban";

export type Outfit =
  "blazer" | "shirt" | "tie" | "polo" | "tee" | "hoodie" | "sweater" | "lab" | "grad";

export type Accessory = "glasses" | "headset" | "laptop" | "backpack" | "cap" | "none";

export type FaceExtra = "none" | "beard" | "mustache" | "blush";

export type AvatarKind = "human" | "robot" | "mascot" | "initials" | "placeholder";

export type AvatarCategory =
  | "professional"
  | "casual"
  | "technical"
  | "creative"
  | "student"
  | "generic"
  | "robot"
  | "mascot"
  | "initials"
  /** Legacy catalog groups kept for existing profile IDs */
  | "man"
  | "woman"
  | "boy"
  | "girl";
