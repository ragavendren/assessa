import { cn } from "@/lib/utils";
import { BadgeBase } from "./BadgeBase";
import { BADGE_MAP, resolveBadgeDefinition, type BadgeGlyphId, type BadgeType } from "./badgeMap";
import type { BadgeTrack } from "./tracks";

export type BadgeProps = {
  /** Display type (`perfect-score`) or DB code (`perfect_score`). */
  type?: BadgeType | string | undefined;
  /** Alias for `type` — useful when rendering from a DB row. */
  code?: string | null | undefined;
  size?: number | undefined;
  track?: BadgeTrack | undefined;
  glyph?: BadgeGlyphId | undefined;
  title?: string | undefined;
  earned?: boolean | undefined;
  className?: string | undefined;
  mark?: string | undefined;
};

/**
 * Production badge mark.
 *
 * @example
 * <Badge type="perfect-score" />
 * <Badge type="top-performer" size={64} />
 * <Badge code="first_success" size={40} />
 */
export function Badge({
  type,
  code,
  size = 72,
  track,
  glyph,
  title,
  earned = true,
  className,
  mark,
}: BadgeProps) {
  const def = resolveBadgeDefinition(type ?? code ?? undefined);
  const resolvedTrack = track ?? def?.track ?? "intermediate";
  const resolvedGlyph = glyph ?? def?.glyph ?? "star";
  const resolvedTitle = title ?? def?.label;
  const resolvedMark = mark ?? def?.mark;

  return (
    <span
      className={cn("inline-flex shrink-0 leading-none", className)}
      title={resolvedTitle}
      data-badge={def?.type ?? type ?? code ?? undefined}
      data-track={resolvedTrack}
    >
      <BadgeBase
        track={resolvedTrack}
        glyph={resolvedGlyph}
        size={size}
        earned={earned}
        {...(resolvedMark ? { mark: resolvedMark } : {})}
        {...(resolvedTitle ? { title: resolvedTitle } : {})}
      />
    </span>
  );
}

export { BADGE_MAP, resolveBadgeDefinition };
export type { BadgeType };
