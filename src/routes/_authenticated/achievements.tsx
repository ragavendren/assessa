import { BadgeMark } from "@/components/BadgeMark";
import { ListToolbar, listViewClass, useListViewMode } from "@/components/ListToolbar";
import { EmptyState, PageLoader } from "@/components/platform";
import {
  SKILL_TRACK_BLURB,
  SKILL_TRACK_LABELS,
  SKILL_TRACKS,
  formatDate,
  type SkillTrack,
} from "@/lib/gamification";
import { getAchievements } from "@/lib/platform.functions";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/achievements")({
  head: () => ({
    meta: [
      { title: "Achievements — Assessa" },
      {
        name: "description",
        content:
          "Badges earned and locked across Beginner, Intermediate, Expertise and Elite tracks.",
      },
      { property: "og:title", content: "Achievements — Assessa" },
      {
        property: "og:description",
        content: "Your badge collection and progress.",
      },
    ],
  }),
  component: Achievements,
});

type StatusFilter = "all" | "earned" | "locked";
type TrackFilter = "all" | SkillTrack;

type BadgeItem = {
  code: string;
  name: string;
  description: string;
  icon: string;
  track: string;
  category: string;
  xp: number;
  earnedAt: string | null;
  progress: { current: number; required: number; unit: string } | null;
};

function Achievements() {
  const fetchAchievements = useServerFn(getAchievements);
  const { data, isPending } = useQuery({
    queryKey: ["achievements"],
    queryFn: () => fetchAchievements(),
  });
  const [status, setStatus] = useState<StatusFilter>("earned");
  const [track, setTrack] = useState<TrackFilter>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useListViewMode("achievements", "grid");

  const earnedCount = (data ?? []).filter((badge) => badge.earnedAt).length;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((badge) => {
      if (status === "earned" && !badge.earnedAt) return false;
      if (status === "locked" && badge.earnedAt) return false;
      const badgeTrack = (badge.track as SkillTrack) || "intermediate";
      if (track !== "all" && badgeTrack !== track) return false;
      if (!q) return true;
      return (
        badge.name.toLowerCase().includes(q) ||
        badge.description.toLowerCase().includes(q) ||
        badge.category.toLowerCase().includes(q) ||
        SKILL_TRACK_LABELS[badgeTrack].toLowerCase().includes(q)
      );
    });
  }, [data, search, status, track]);

  if (isPending || !data) return <PageLoader />;

  const progressPct = data.length > 0 ? Math.round((earnedCount / data.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <header className="animate-brand-rise relative overflow-hidden rounded-[var(--radius-lg)] border border-border bg-primary text-primary-foreground">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 top-0 h-36 w-36 rounded-full bg-accent/30 blur-3xl animate-brand-glow"
        />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4 p-5 md:p-6">
          <div>
            <p className="text-hairline text-primary-foreground/65">
              {earnedCount} of {data.length} unlocked
            </p>
            <h1 className="mt-1 font-display text-3xl leading-none md:text-4xl">Achievements</h1>
            <p className="mt-2 max-w-xl text-sm text-primary-foreground/75">
              Unlock badges as you take and pass assessments across beginner to elite tracks.
            </p>
          </div>
          <div className="min-w-[10rem] rounded-[var(--radius-md)] border border-primary-foreground/15 bg-primary-foreground/8 px-4 py-3 backdrop-blur-sm">
            <p className="text-hairline text-primary-foreground/70">Collection</p>
            <p className="mt-1 font-display text-2xl leading-none">{progressPct}%</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary-foreground/15">
              <div
                className="animate-score-fill h-full rounded-full bg-accent"
                style={{ width: `${Math.max(progressPct, 4)}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SKILL_TRACKS.map((value, index) => {
          const count = data.filter(
            (badge) => ((badge.track as SkillTrack) || "intermediate") === value,
          ).length;
          const earned = data.filter(
            (badge) => ((badge.track as SkillTrack) || "intermediate") === value && badge.earnedAt,
          ).length;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTrack(track === value ? "all" : value)}
              className={cn(
                "animate-track-chip rounded-[var(--radius-md)] border px-3 py-3 text-left transition-all duration-200 hover:-translate-y-0.5",
                track === value
                  ? "border-accent bg-accent/15 shadow-sm"
                  : "border-border bg-card hover:border-accent/40",
              )}
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{SKILL_TRACK_LABELS[value]}</p>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {earned}/{count}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                {SKILL_TRACK_BLURB[value]}
              </p>
            </button>
          );
        })}
      </div>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search badges…"
        filters={
          [
            { value: "all" as const, label: "All" },
            { value: "earned" as const, label: "Earned", count: earnedCount },
            {
              value: "locked" as const,
              label: "Locked",
              count: data.length - earnedCount,
            },
          ] as const
        }
        filter={status}
        onFilterChange={setStatus}
        view={view}
        onViewChange={setView}
      />

      {visible.length === 0 ? (
        <EmptyState
          icon="🏅"
          title={status === "earned" ? "No earned badges yet" : "No badges match"}
          body={
            status === "earned"
              ? "Pass assessments to unlock your first badge, or switch the filter to see locked goals."
              : "Try another track or clear the search."
          }
        />
      ) : view === "table" ? (
        <div className="animate-brand-rise surface-paper overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Badge</th>
                <th className="p-3 font-medium">Track</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Progress / XP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((badge, index) => {
                const badgeTrack = (badge.track as SkillTrack) || "intermediate";
                return (
                  <tr
                    key={badge.code}
                    className={cn(
                      "animate-achievement-card transition-colors hover:bg-secondary/30",
                      !badge.earnedAt && "opacity-80",
                    )}
                    style={{ animationDelay: `${index * 35}ms` }}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <BadgeMark
                          icon={badge.icon}
                          code={badge.code}
                          name={badge.name}
                          earned={Boolean(badge.earnedAt)}
                          size="md"
                          {...(badge.earnedAt ? { className: "animate-medal-pop" } : {})}
                        />
                        <div>
                          <p className="font-medium">{badge.name}</p>
                          <p className="text-xs text-muted-foreground">{badge.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">{SKILL_TRACK_LABELS[badgeTrack]}</td>
                    <td className="p-3">
                      {badge.earnedAt ? (
                        <span className="text-accent">Earned {formatDate(badge.earnedAt)}</span>
                      ) : (
                        "Locked"
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {badge.earnedAt
                        ? `+${badge.xp} XP`
                        : badge.progress
                          ? `${badge.progress.current} / ${badge.progress.required} ${badge.progress.unit}`
                          : "Hidden criteria"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={cn(listViewClass(view), view === "grid" && "lg:grid-cols-3")}>
          {visible.map((badge, index) => (
            <BadgeCard key={badge.code} badge={badge} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}

function BadgeCard({ badge, index }: { badge: BadgeItem; index: number }) {
  const badgeTrack = (badge.track as SkillTrack) || "intermediate";
  const earned = Boolean(badge.earnedAt);
  const progressValue =
    badge.progress && badge.progress.required > 0
      ? (badge.progress.current / badge.progress.required) * 100
      : 0;

  return (
    <article
      className={cn(
        "animate-achievement-card group relative overflow-hidden surface-paper p-5 transition-transform duration-200 hover:-translate-y-1",
        earned && "animate-achievement-pulse",
        !earned && "opacity-90",
      )}
      style={{ animationDelay: `${index * 55}ms` }}
    >
      {earned ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-achievement-shine opacity-70"
        />
      ) : null}

      <div className="relative z-10 flex items-start justify-between gap-3">
        <BadgeMark
          icon={badge.icon}
          code={badge.code}
          name={badge.name}
          earned={earned}
          size="xl"
          className={cn(
            "transition-transform duration-300 group-hover:scale-110",
            earned && "animate-medal-pop",
          )}
        />
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
          {SKILL_TRACK_LABELS[badgeTrack]}
        </span>
      </div>

      <h3 className="relative z-10 mt-3 font-display text-lg">{badge.name}</h3>
      <p className="relative z-10 mt-1 text-sm text-muted-foreground">{badge.description}</p>

      {earned ? (
        <p className="relative z-10 mt-3 text-xs text-accent">
          +{badge.xp} XP · earned {formatDate(badge.earnedAt)}
        </p>
      ) : badge.progress ? (
        <div className="relative z-10 mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="animate-score-fill h-full rounded-full bg-accent"
              style={{
                width: `${Math.max(progressValue, 4)}%`,
                animationDelay: `${index * 55 + 160}ms`,
              }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {badge.progress.current} / {badge.progress.required} {badge.progress.unit}
          </p>
        </div>
      ) : (
        <p className="relative z-10 mt-3 text-xs text-muted-foreground">Hidden criteria</p>
      )}
    </article>
  );
}
