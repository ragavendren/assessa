import { EmptyState, Meter, PageLoader, SectionHeading } from "@/components/platform";
import { formatDate } from "@/lib/gamification";
import { getAchievements } from "@/lib/platform.functions";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/achievements")({
  head: () => ({
    meta: [
      { title: "Achievements — Assessa" },
      {
        name: "description",
        content: "Badges earned and badges still locked, with live progress toward each one.",
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

function Achievements() {
  const fetchAchievements = useServerFn(getAchievements);
  const { data, isPending } = useQuery({
    queryKey: ["achievements"],
    queryFn: () => fetchAchievements(),
  });

  if (isPending || !data) return <PageLoader />;

  const earned = data.filter((badge) => badge.earnedAt);
  const locked = data.filter((badge) => !badge.earnedAt);

  return (
    <div className="space-y-10">
      <SectionHeading
        eyebrow={`${earned.length} of ${data.length} unlocked`}
        title="Achievements"
      />

      {earned.length === 0 ? (
        <EmptyState
          icon="🏅"
          title="No badges yet"
          body="Complete and pass assessments to start unlocking badges."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {earned.map((badge) => (
            <article key={badge.code} className="surface-paper p-5">
              <span className="text-3xl">{badge.icon}</span>
              <h3 className="mt-2 font-display text-lg">{badge.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{badge.description}</p>
              <p className="mt-3 text-xs text-accent">
                +{badge.xp} XP · earned {formatDate(badge.earnedAt)}
              </p>
            </article>
          ))}
        </div>
      )}

      <div>
        <SectionHeading eyebrow="Keep going" title="Locked badges" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locked.map((badge) => (
            <article key={badge.code} className="surface-paper p-5 opacity-90">
              <span className="text-3xl grayscale">{badge.icon}</span>
              <h3 className="mt-2 font-display text-lg">{badge.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{badge.description}</p>
              {badge.progress ? (
                <div className="mt-3">
                  <Meter
                    value={
                      badge.progress.required > 0
                        ? (badge.progress.current / badge.progress.required) * 100
                        : 0
                    }
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {badge.progress.current} / {badge.progress.required} {badge.progress.unit}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">Hidden criteria</p>
              )}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
