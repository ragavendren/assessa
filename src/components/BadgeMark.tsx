import { Badge, resolveBadgeTrack, type BadgeTrack } from "@/components/badges";
import { isBadgeIconId } from "@/lib/badge-icons";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg" | "xl";

/** Display sizes — large enough for the centre glyph to read clearly. */
const SIZE_PX: Record<Size, number> = {
  sm: 48,
  md: 64,
  lg: 80,
  xl: 96,
};

type BadgeMarkProps = {
  icon: string;
  code?: string | null | undefined;
  name?: string | undefined;
  earned?: boolean;
  size?: Size;
  track?: BadgeTrack | string | null | undefined;
  className?: string | undefined;
};

/**
 * App-wide badge mark — reusable SVG shield with glitter on earned badges.
 */
export function BadgeMark({
  icon,
  code,
  name,
  earned = true,
  size = "md",
  track,
  className,
}: BadgeMarkProps) {
  const glyphOverride = isBadgeIconId(icon) ? icon : undefined;
  const key = code ?? icon;
  const resolvedTrack = resolveBadgeTrack(track, key);

  return (
    <Badge
      type={key}
      earned={earned}
      size={SIZE_PX[size]}
      track={resolvedTrack}
      className={cn(className)}
      {...(code != null ? { code } : {})}
      {...(name ? { title: name } : {})}
      {...(glyphOverride ? { glyph: glyphOverride } : {})}
    />
  );
}
