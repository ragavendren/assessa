import { Avatar } from "@/components/avatars";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  avatarId?: string | null | undefined;
  name?: string | null | undefined;
  className?: string;
  /** @deprecated kept for call-site compat */
  emojiClassName?: string;
  title?: string;
  size?: number;
};

/** Renders a catalog SVG avatar or initials fallback. */
export function UserAvatar({ avatarId, name, className, title, size = 40 }: UserAvatarProps) {
  return (
    <Avatar
      size={size}
      className={cn(className)}
      {...(avatarId !== undefined ? { type: avatarId } : {})}
      {...(name !== undefined ? { name } : {})}
      {...(title ? { title } : {})}
    />
  );
}
