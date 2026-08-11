import { AdminNav } from "@/components/AdminNav";
import { PageLoader, SectionHeading } from "@/components/platform";
import { listBadgeConfig, updateXpRule, upsertBadge } from "@/lib/admin.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/gamification")({
  head: () => ({
    meta: [
      { title: "Configure gamification — Assessa" },
      {
        name: "description",
        content:
          "Tune XP rules, create and edit badges, and control how achievements are awarded across assessments.",
      },
      { property: "og:title", content: "Configure gamification — Assessa" },
      {
        property: "og:description",
        content: "Admin controls for XP values, badge conditions and rewards.",
      },
    ],
  }),
  component: GamificationAdmin,
});

const CONDITIONS = [
  "pass_count",
  "attempt_count",
  "single_score",
  "average_over",
  "pass_streak",
  "fast_high_score",
  "improvement",
  "comeback",
  "topic_average",
  "top_rank",
] as const;

type BadgeForm = {
  code: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  condition_type: (typeof CONDITIONS)[number];
  condition_value: number;
  condition_topic: string;
  xp_reward: number;
  active: boolean;
};

const EMPTY: BadgeForm = {
  code: "",
  name: "",
  description: "",
  icon: "🏅",
  category: "custom",
  condition_type: "pass_count",
  condition_value: 1,
  condition_topic: "",
  xp_reward: 50,
  active: true,
};

function GamificationAdmin() {
  const fetchConfig = useServerFn(listBadgeConfig);
  const saveBadge = useServerFn(upsertBadge);
  const saveRule = useServerFn(updateXpRule);
  const queryClient = useQueryClient();
  const [form, setForm] = useState<BadgeForm>(EMPTY);

  const { data, isPending, error } = useQuery({
    queryKey: ["badge-config"],
    queryFn: () => fetchConfig(),
    retry: false,
  });

  const badgeMutation = useMutation({
    mutationFn: (payload: BadgeForm) => saveBadge({ data: payload }),
    onSuccess: () => {
      toast.success("Badge saved");
      setForm(EMPTY);
      queryClient.invalidateQueries({ queryKey: ["badge-config"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save badge"),
  });

  const ruleMutation = useMutation({
    mutationFn: (payload: { code: string; points: number; active: boolean }) =>
      saveRule({ data: payload }),
    onSuccess: () => {
      toast.success("XP rule updated");
      queryClient.invalidateQueries({ queryKey: ["badge-config"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not update rule"),
  });

  if (isPending) return <PageLoader />;
  if (error || !data) {
    return (
      <div className="surface-paper p-8 text-center">
        <p className="font-display text-xl">Administrator access required</p>
      </div>
    );
  }

  return (
    <div>
      <AdminNav />
      <SectionHeading eyebrow="Configure" title="Gamification" />

      <section className="mb-10">
        <p className="text-hairline mb-3 text-muted-foreground">XP rules</p>
        <div className="surface-paper divide-y divide-border">
          {data.rules.map((rule) => (
            <div key={rule.code} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{rule.label}</p>
                <p className="text-xs text-muted-foreground">{rule.code}</p>
              </div>
              <input
                type="number"
                defaultValue={rule.points}
                min={0}
                max={1000}
                onBlur={(event) => {
                  const points = Number(event.target.value);
                  if (points !== rule.points)
                    ruleMutation.mutate({ code: rule.code, points, active: rule.active });
                }}
                className="field w-24"
                aria-label={`${rule.label} points`}
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={rule.active}
                  onChange={(event) =>
                    ruleMutation.mutate({
                      code: rule.code,
                      points: rule.points,
                      active: event.target.checked,
                    })
                  }
                />
                Active
              </label>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="text-hairline mb-3 text-muted-foreground">Create or edit a badge</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              badgeMutation.mutate(form);
            }}
            className="surface-paper space-y-3 p-5"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-xs text-muted-foreground">Code</span>
                <input
                  className="field mt-1"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="topic_master"
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="text-xs text-muted-foreground">Name</span>
                <input
                  className="field mt-1"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Topic Master"
                  required
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="text-xs text-muted-foreground">Description</span>
              <input
                className="field mt-1"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Reach 90% mastery in a topic"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-sm">
                <span className="text-xs text-muted-foreground">Icon</span>
                <input
                  className="field mt-1"
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  maxLength={8}
                />
              </label>
              <label className="block text-sm">
                <span className="text-xs text-muted-foreground">Category</span>
                <input
                  className="field mt-1"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                <span className="text-xs text-muted-foreground">XP reward</span>
                <input
                  type="number"
                  min={0}
                  max={2000}
                  className="field mt-1"
                  value={form.xp_reward}
                  onChange={(e) => setForm({ ...form, xp_reward: Number(e.target.value) })}
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-sm">
                <span className="text-xs text-muted-foreground">Condition</span>
                <select
                  className="field mt-1"
                  value={form.condition_type}
                  onChange={(e) =>
                    setForm({ ...form, condition_type: e.target.value as BadgeForm["condition_type"] })
                  }
                >
                  {CONDITIONS.map((value) => (
                    <option key={value} value={value}>
                      {value.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-xs text-muted-foreground">Value</span>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  className="field mt-1"
                  value={form.condition_value}
                  onChange={(e) => setForm({ ...form, condition_value: Number(e.target.value) })}
                />
              </label>
              <label className="block text-sm">
                <span className="text-xs text-muted-foreground">Topic (optional)</span>
                <input
                  className="field mt-1"
                  value={form.condition_topic}
                  onChange={(e) => setForm({ ...form, condition_topic: e.target.value })}
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Active
            </label>
            <button
              type="submit"
              disabled={badgeMutation.isPending}
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {badgeMutation.isPending ? "Saving…" : "Save badge"}
            </button>
          </form>
        </div>

        <div>
          <p className="text-hairline mb-3 text-muted-foreground">Badge library</p>
          <div className="surface-paper divide-y divide-border">
            {data.badges.map((badge) => (
              <div key={badge.id} className="flex items-center gap-3 p-4">
                <span className="text-xl">{badge.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{badge.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {badge.condition_type.replace(/_/g, " ")} · {Number(badge.condition_value)}
                    {badge.condition_topic ? ` · ${badge.condition_topic}` : ""} · +{badge.xp_reward} XP
                  </p>
                </div>
                <button
                  onClick={() =>
                    setForm({
                      code: badge.code,
                      name: badge.name,
                      description: badge.description,
                      icon: badge.icon,
                      category: badge.category,
                      condition_type: badge.condition_type as BadgeForm["condition_type"],
                      condition_value: Number(badge.condition_value),
                      condition_topic: badge.condition_topic ?? "",
                      xp_reward: badge.xp_reward,
                      active: badge.active,
                    })
                  }
                  className="rounded-md border border-input px-2.5 py-1 text-xs hover:bg-secondary"
                >
                  Edit
                </button>
                {!badge.active ? (
                  <span className="text-[11px] text-muted-foreground">off</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
