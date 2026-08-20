/** Presence helpers — online if seen within this window. */
export const ONLINE_WINDOW_MS = 2 * 60_000;

export function isUserOnline(lastSeenAt: string | null | undefined, now = Date.now()): boolean {
  if (!lastSeenAt) return false;
  const seen = Date.parse(lastSeenAt);
  if (Number.isNaN(seen)) return false;
  return now - seen <= ONLINE_WINDOW_MS;
}

export function presenceStatus(
  lastSeenAt: string | null | undefined,
  now = Date.now(),
): "online" | "offline" {
  return isUserOnline(lastSeenAt, now) ? "online" : "offline";
}

/** Shuffle a copy with Fisher–Yates. */
export function shuffleList<T>(items: T[], random: () => number = Math.random): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = next[i]!;
    next[i] = next[j]!;
    next[j] = a;
  }
  return next;
}

/** Split users into `teamCount` buckets (optionally capped at `perTeam`). */
export function splitUsersIntoTeams(
  userIds: string[],
  teamCount: number,
  perTeam?: number | null,
): string[][] {
  const teams = Math.max(1, Math.floor(teamCount));
  const shuffled = shuffleList(userIds);
  const capped =
    perTeam != null && perTeam > 0 ? shuffled.slice(0, teams * Math.floor(perTeam)) : shuffled;
  const buckets: string[][] = Array.from({ length: teams }, () => []);
  capped.forEach((id, index) => {
    buckets[index % teams]!.push(id);
  });
  return buckets;
}

export function defaultTeamNames(count: number, custom?: string[]): string[] {
  const names: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const customName = custom?.[i]?.trim();
    names.push(customName && customName.length >= 2 ? customName : `Team ${i + 1}`);
  }
  return names;
}
