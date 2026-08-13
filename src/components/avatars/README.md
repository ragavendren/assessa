# Assessa SVG avatar library

Reusable **flat SaaS avatars** for profile pictures — pure SVG, no raster assets.

## Usage

```tsx
import { Avatar, AvatarGroup } from "@/components/avatars";

<Avatar type="dev-01" size={64} status="online" />
<Avatar name="Ada Lovelace" size={40} />
<AvatarGroup users={team} max={5} />
```

Profile picker: existing `<AvatarPicker />` on the profile page (search + categories).

## Layout

| Path | Role |
| ---- | ---- |
| `src/components/avatars/Avatar.tsx` | Public mark + status badge |
| `src/components/avatars/AvatarGroup.tsx` | Overlapping stack |
| `src/components/avatars/AvatarSvg.tsx` | Compositor (human / robot / mascot / initials) |
| `src/components/avatars/avatarMap.ts` | Registry — add avatars here |
| `src/components/avatars/tokens.ts` | Skin / hair / cloth palettes |
| `src/lib/avatars.ts` | Bridge for `getAvatar` / `isAvatarId` |

Legacy IDs (`man-1` … `girl-4`) remain valid for stored `avatar_id` values.

## Extending

Add an entry to `AVATAR_MAP` with a unique id (≤40 chars). No component changes required.
