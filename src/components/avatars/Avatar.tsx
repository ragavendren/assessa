import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  initialsAvatarDef,
  resolveAvatarDefinition,
  type AvatarDefinition,
} from "./avatarMap";
import { AvatarSvg } from "./AvatarSvg";

export type AvatarStatus = "online" | "offline" | "busy" | "away" | "dnd";

export type AvatarProps = {
  /** Catalog id (`dev-01`) or omit for initials fallback */
  type?: string | null | undefined;
  /** Alias for `type` */
  id?: string | null | undefined;
  size?: number | undefined;
  name?: string | null | undefined;
  /** Override with remote image URL */
  src?: string | null | undefined;
  rounded?: boolean | undefined;
  status?: AvatarStatus | undefined;
  badge?: ReactNode | undefined;
  className?: string | undefined;
  title?: string | undefined;
  /** Force a definition (advanced) */
  definition?: AvatarDefinition | undefined;
};

const STATUS_COLOR: Record<AvatarStatus, string> = {
  online: "bg-emerald-500",
  offline: "bg-slate-400",
  busy: "bg-red-500",
  away: "bg-amber-400",
  dnd: "bg-rose-600",
};

/**
 * Reusable profile avatar — SVG catalog, image override, or initials.
 *
 * @example
 * <Avatar type="dev-01" size={64} status="online" />
 * <Avatar name="Ada Lovelace" size={40} />
 */
export function Avatar({
  type,
  id,
  size = 40,
  name,
  src,
  rounded = true,
  status,
  badge,
  className,
  title,
  definition,
}: AvatarProps) {
  const avatarId = type ?? id ?? null;
  const def = definition ?? resolveAvatarDefinition(avatarId);
  const fallback = !def && !src ? initialsAvatarDef(name ?? "?") : null;
  const renderDef = def ?? fallback;
  const label = title ?? def?.label ?? name ?? "User avatar";

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-secondary",
        rounded && "rounded-full",
        className,
      )}
      style={{ width: size, height: size }}
      title={label}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : renderDef ? (
        <AvatarSvg def={renderDef} title={label} />
      ) : null}

      {status ? (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full ring-2 ring-card",
            STATUS_COLOR[status],
          )}
          style={{ width: Math.max(8, size * 0.22), height: Math.max(8, size * 0.22) }}
          aria-label={status}
        />
      ) : null}

      {badge ? (
        <span className="absolute -right-0.5 -top-0.5 flex items-center justify-center">{badge}</span>
      ) : null}
    </span>
  );
}
