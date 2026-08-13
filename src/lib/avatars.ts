/**
 * Avatar catalog bridge — keeps existing `@/lib/avatars` imports working
 * while the SVG library lives in `@/components/avatars`.
 */
import {
  AVATAR_LIST,
  AVATAR_MAP,
  isAvatarId as isCatalogId,
  resolveAvatarDefinition,
  type AvatarCategory as LibCategory,
  type AvatarDefinition,
} from "@/components/avatars";

export type AvatarCategory = LibCategory;

export type AvatarOption = {
  id: string;
  label: string;
  category: AvatarCategory;
  /** Optional legacy public path */
  src?: string;
  definition: AvatarDefinition;
};

export const AVATARS: AvatarOption[] = AVATAR_LIST.map((def) => ({
  id: def.id,
  label: def.label,
  category: def.category,
  ...(def.src ? { src: def.src } : {}),
  definition: def,
}));

export const AVATAR_IDS = AVATARS.map((a) => a.id);

export function getAvatar(id: string | null | undefined): AvatarOption | null {
  const def = resolveAvatarDefinition(id);
  if (!def) return null;
  return {
    id: def.id,
    label: def.label,
    category: def.category,
    ...(def.src ? { src: def.src } : {}),
    definition: def,
  };
}

export function isAvatarId(value: string | null | undefined): value is string {
  return isCatalogId(value);
}

export { AVATAR_MAP };
