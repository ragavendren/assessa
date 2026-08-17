import { playModeIcon } from "@/components/play/PlayModeCard";
import { PlayLeaderboardPanel } from "@/components/play/PlayLeaderboardPanel";
import { PLAY_KIND_META, type PlayKind, type PlaySegment } from "@/lib/play.math";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Flame, Gamepad2, RotateCcw } from "lucide-react";

type PlayHub = {
  menuEnabled: boolean;
  enabled: Record<PlayKind, boolean>;
  daily: { completed: boolean; sessionId: string | null };
  weekly: { completed: boolean };
  streak: { current: number };
  resume: Array<{ id: string; kind: PlayKind; topic: string | null }>;
  segments: PlaySegment[];
};

const LINK_MODES: Partial<Record<PlayKind, { to: string; search?: boolean }>> = {
  topic: { to: "/play/topics", search: true },
  flash: { to: "/play/flash", search: true },
  battle: { to: "/play/battle" },
  team: { to: "/play/team" },
  escape: { to: "/play/escape" },
};

const REQUIRED_KINDS: PlayKind[] = ["daily", "weekly"];
const POSSIBLE_KINDS: PlayKind[] = [
  "flash",
  "survival",
  "topic",
  "speed",
  "rapid",
  "marathon",
  "battle",
];

export function PlayDashboardSection({
  hub,
  pending,
  onStart,
}: {
  hub: PlayHub;
  pending?: boolean;
  onStart: (kind: PlayKind, courseId: string) => void;
}) {
  if (hub.menuEnabled === false) return null;

  const segment = hub.segments[0] ?? null;
  const courseId = segment?.courseId ?? "";
  const available = new Map<PlayKind, { courseId: string; mode: PlaySegment["modes"][number] }>();
  for (const item of hub.segments) {
    for (const mode of item.modes) {
      if (!available.has(mode.kind)) available.set(mode.kind, { courseId: item.courseId, mode });
    }
  }

  const required = REQUIRED_KINDS.map((kind) => available.get(kind)).filter(Boolean) as Array<{
    courseId: string;
    mode: PlaySegment["modes"][number];
  }>;
  const possible = POSSIBLE_KINDS.map((kind) => available.get(kind)).filter(Boolean) as Array<{
    courseId: string;
    mode: PlaySegment["modes"][number];
  }>;
  const boardKind =
    available.get("daily")?.mode.kind ??
    available.get("speed")?.mode.kind ??
    available.get("topic")?.mode.kind ??
    possible[0]?.mode.kind ??
    null;

  if (hub.segments.length === 0 && hub.resume.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="surface-metal overflow-hidden p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
              <Gamepad2 className="h-3.5 w-3.5" />
              Newly launched
            </p>
            <h2 className="mt-1 text-lg font-semibold">Play is live</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Short pool games beside your assessments — daily, flash cards, survival, and more.
            </p>
          </div>
          <Link
            to="/play"
            {...(courseId ? { search: { courseId } } : {})}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            Open Play
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {hub.resume.length > 0 ? (
        <div className="surface-paper rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Resume
          </p>
          <ul className="mt-2 space-y-1">
            {hub.resume.slice(0, 3).map((row) => (
              <li key={row.id}>
                <Link
                  to="/play/session/$sessionId"
                  params={{ sessionId: row.id }}
                  className="flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-secondary"
                >
                  <span className="inline-flex items-center gap-2">
                    <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                    {PLAY_KIND_META[row.kind]?.label ?? row.kind}
                    {row.topic ? ` · ${row.topic}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">Continue</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {required.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {required.map(({ courseId: id, mode }) => {
            const dailyDone = mode.kind === "daily" && hub.daily.completed;
            const weeklyDone = mode.kind === "weekly" && hub.weekly.completed;
            const done = dailyDone || weeklyDone;
            return (
              <article key={mode.kind} className="surface-paper rounded-xl p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Required today
                </p>
                <h3 className="mt-1 font-semibold">{mode.label}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{mode.blurb}</p>
                {mode.kind === "daily" ? (
                  <p className="mt-2 inline-flex items-center gap-1 text-xs text-amber-700">
                    <Flame className="h-3.5 w-3.5" />
                    {hub.streak.current} day streak
                  </p>
                ) : null}
                <div className="mt-3">
                  {dailyDone && hub.daily.sessionId ? (
                    <Link
                      to="/play/results/$sessionId"
                      params={{ sessionId: hub.daily.sessionId }}
                      className="rounded-md bg-secondary px-3 py-1.5 text-sm"
                    >
                      View result
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled={pending || weeklyDone}
                      onClick={() => onStart(mode.kind, id)}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm font-medium",
                        done
                          ? "border border-border text-muted-foreground"
                          : "bg-primary text-primary-foreground",
                      )}
                    >
                      {weeklyDone ? "Weekly done" : `Start ${mode.label.toLowerCase()}`}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {possible.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Also available
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {possible.map(({ courseId: id, mode }) => {
              const Icon = playModeIcon(mode.kind);
              const link = LINK_MODES[mode.kind];
              const inner = (
                <>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{mode.label}</span>
                    <span className="mt-0.5 block line-clamp-1 text-xs text-muted-foreground">
                      {mode.blurb}
                    </span>
                  </span>
                </>
              );
              const className =
                "flex items-start gap-3 rounded-xl border border-border p-3 text-left hover:bg-secondary/50";
              if (link) {
                return (
                  <Link
                    key={mode.kind}
                    to={link.to as "/play/flash"}
                    {...(link.search ? { search: { courseId: id } } : {})}
                    className={className}
                  >
                    {inner}
                  </Link>
                );
              }
              return (
                <button
                  key={mode.kind}
                  type="button"
                  disabled={pending}
                  onClick={() => onStart(mode.kind, id)}
                  className={className}
                >
                  {inner}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {segment && boardKind ? (
        <div className="surface-paper rounded-xl p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Play leaderboard</p>
            <Link
              to="/play/leaderboard"
              search={{ courseId: segment.courseId, kind: boardKind }}
              className="text-xs text-accent underline"
            >
              Full board
            </Link>
          </div>
          <PlayLeaderboardPanel
            kind={boardKind}
            courseId={segment.courseId}
            courseName={segment.courseName}
            limit={4}
          />
        </div>
      ) : null}
    </section>
  );
}
