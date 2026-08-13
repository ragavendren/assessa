# Assessa badge asset pack

Reusable **SVG shield badges** for achievements — one composition, many glyphs.

## React usage (preferred)

```tsx
import { Badge } from "@/components/badges";

<Badge type="perfect-score" />
<Badge type="top-performer" size={64} />
<Badge code="first_success" size={40} earned={false} />
```

Sources live in `src/components/badges/`:

| File            | Role                                                 |
| --------------- | ---------------------------------------------------- |
| `Badge.tsx`     | Public API                                           |
| `BadgeBase.tsx` | Shared shield + rim + laurels + stars + gloss        |
| `BadgeIcon.tsx` | Inner pure-SVG glyphs                                |
| `badgeMap.ts`   | `type` ↔ DB `code` ↔ track ↔ glyph                   |
| `tracks.ts`     | Beginner / Intermediate / Expertise / Elite palettes |

## Track colours

| Track        | Look                                      |
| ------------ | ----------------------------------------- |
| Beginner     | Dark green shield, gold metallic icon     |
| Intermediate | Navy shield, silver / chrome icon         |
| Expertise    | Purple shield, gold metallic icon         |
| Elite        | Burnt orange shield, bright gold icon     |

Centre glyphs follow the achievement art pack (trophy, podium, fist, rocket, star-medal, stopwatch, number marks, etc.).

## Standalone SVG export

Each badge is composable; export from React or Figma by:

1. Open a badge at `size={512}`
2. Copy the rendered SVG from DevTools, or
3. Duplicate `BadgeBase` artboards in Figma/Illustrator and swap the centre glyph

Suggested filenames (kebab-case, matches `BadgeType`):

```
BadgeBase.svg          ← shared shield artboard (this folder)
podium-finish.svg      ← export variants by swapping centre glyph + track fill
top-performer.svg
…
```

Individual badge SVGs are **not** checked in as 30 duplicates. Compose them in React with `<Badge type="…" />`, or export from `BadgeBase.svg` in Figma when you need static assets.

## Constraints

- Pure SVG (no external images)
- Scales cleanly from ~24px–512px
- Track palettes work on light and dark UI
- Typical composed mark stays well under 10 KB
- Gamification **conditions / XP / names** stay in the database — this pack is presentation only
