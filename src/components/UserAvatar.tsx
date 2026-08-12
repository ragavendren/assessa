import { getAvatar } from "@/lib/avatars";
import { initials } from "@/lib/gamification";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  avatarId?: string | null;
  name?: string | null;
  className?: string;
  /** @deprecated kept for call-site compat; unused for image avatars */
  emojiClassName?: string;
  title?: string;
};

/** Renders a catalog avatar image or initials fallback. */
export function UserAvatar({ avatarId, name, className, title }: UserAvatarProps) {
  const avatar = getAvatar(avatarId);
  if (avatar) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center overflow-hidden rounded-full bg-secondary",
          className,
        )}
        title={title ?? `${avatar.label} (${avatar.category})`}
      >
        <img src={avatar.src} alt="" className="h-full w-full object-cover" draggable={false} />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground",
        className,
      )}
      title={title}
    >
      {initials(name ?? "")}
    </span>
  );
}
