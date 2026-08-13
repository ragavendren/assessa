import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";

export type AvatarGroupUser = {
  id?: string | null | undefined;
  avatarId?: string | null | undefined;
  name?: string | null | undefined;
  src?: string | null | undefined;
};

type AvatarGroupProps = {
  users: AvatarGroupUser[];
  max?: number;
  size?: number;
  className?: string;
};

/**
 * Overlapping avatar stack with +N overflow indicator.
 *
 * @example
 * <AvatarGroup users={team} max={5} size={32} />
 */
export function AvatarGroup({ users, max = 5, size = 32, className }: AvatarGroupProps) {
  const visible = users.slice(0, max);
  const overflow = Math.max(0, users.length - max);

  return (
    <div className={cn("flex items-center", className)} role="group" aria-label="Avatar group">
      {visible.map((user, index) => (
        <span
          key={user.id ?? user.avatarId ?? `${user.name}-${index}`}
          className="-ml-2 first:ml-0 rounded-full ring-2 ring-card"
          title={user.name ?? undefined}
          style={{ zIndex: visible.length - index }}
        >
          <Avatar
            size={size}
            {...(user.avatarId != null ? { type: user.avatarId } : {})}
            {...(user.name != null ? { name: user.name } : {})}
            {...(user.src != null ? { src: user.src } : {})}
            {...(user.name ? { title: user.name } : {})}
          />
        </span>
      ))}
      {overflow > 0 ? (
        <span
          className="-ml-2 inline-flex items-center justify-center rounded-full bg-secondary text-[0.65rem] font-semibold text-muted-foreground ring-2 ring-card"
          style={{ width: size, height: size, zIndex: 0 }}
          title={`+${overflow} more`}
          aria-label={`Plus ${overflow} more`}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
