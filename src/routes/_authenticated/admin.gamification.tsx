import { AdminNav } from "@/components/AdminNav";
import { BadgeMark } from "@/components/BadgeMark";
import {
  AdminAccessDenied,
  AdminEmpty,
  AdminPageHeader,
  AdminPanel,
  ResultCount,
  StatusPill,
} from "@/components/admin/AdminPageUi";
import { EngagementNav } from "@/components/admin/EngagementNav";
import { PageLoader, StatTile } from "@/components/platform";
import { BADGE_ICON_CATALOG, resolveBadgeIcon } from "@/lib/badge-icons";
import { listBadgeConfig, updateXpRule, upsertBadge } from "@/lib/admin.functions";
import { SKILL_TRACK_LABELS, type SkillTrack } from "@/lib/gamification";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Sparkles, Zap } from "lucide-react";
import { useMemo, useState } from "react";
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
  track: "beginner" | "intermediate" | "expertise" | "elite";
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
  icon: "trophy",
  category: "custom",
  track: "intermediate",
  condition_type: "pass_count",
  condition_value: 1,
  condition_topic: "",
  xp_reward: 50,
  active: true,
};

type Panel = "badges" | "xp";

function GamificationAdmin() {
  const fetchConfig = useServerFn(listBadgeConfig);
  const saveBadge = useServerFn(upsertBadge);
  const saveRule = useServerFn(updateXpRule);
  const queryClient = useQueryClient();
  const [form, setForm] = useState<BadgeForm>(EMPTY);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("badges");
  const [trackFilter, setTrackFilter] = useState<"all" | SkillTrack>("all");
  const [badgeSearch, setBadgeSearch] = useState("");

  const { data, isPending, error } = useQuery({
    queryKey: ["badge-config"],
    queryFn: () => fetchConfig(),
    retry: false,
  });

  const badgeMutation = useMutation({
    mutationFn: (payload: BadgeForm) => saveBadge({ data: payload }),
    onSuccess: () => {
      toast.success(editingCode ? "Badge updated" : "Badge created");
      setForm(EMPTY);
      setEditingCode(null);
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

  const filteredBadges = useMemo(() => {
    const q = badgeSearch.trim().toLowerCase();
    return (data?.badges ?? []).filter((badge) => {
      const track = (badge.track as SkillTrack) || "intermediate";
      if (trackFilter !== "all" && track !== trackFilter) return false;
      if (!q) return true;
      return (
        badge.name.toLowerCase().includes(q) ||
        badge.code.toLowerCase().includes(q) ||
        badge.category.toLowerCase().includes(q)
      );
    });
  }, [badgeSearch, data?.badges, trackFilter]);

  if (isPending) {
    return (
      <div>
        <AdminNav />
        <EngagementNav />
        <PageLoader />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div>
        <AdminNav />
        <EngagementNav />
        <AdminAccessDenied />
      </div>
    );
  }

  const activeBadges = data.badges.filter((b) => b.active).length;
  const activeRules = data.rules.filter((r) => r.active).length;
  const totalXpPool = data.badges.reduce((sum, b) => sum + (b.active ? b.xp_reward : 0), 0);

  function loadBadge(badge: (typeof filteredBadges)[number]) {
    setEditingCode(badge.code);
    setPanel("badges");
    setForm({
      code: badge.code,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      category: badge.category,
      track: (badge.track as BadgeForm["track"]) || "intermediate",
      condition_type: badge.condition_type as BadgeForm["condition_type"],
      condition_value: Number(badge.condition_value),
      condition_topic: badge.condition_topic ?? "",
      xp_reward: badge.xp_reward,
      active: badge.active,
    });
  }

  function startCreate() {
    setEditingCode(null);
    setForm(EMPTY);
    setPanel("badges");
  }

  return (
    <div className="space-y-5">
      <AdminNav />
      <EngagementNav />
      <AdminPageHeader
        eyebrow="Engagement"
        title="Gamification"
        summary="Tune XP rules and badges that participants earn across assessments. Changes apply to new awards."
        help={{
          label: "How awards work",
          body: "XP rules fire when someone starts or finishes a paper. Badges use the condition you set here and only grant while Active.",
        }}
        action={
          <div className="inline-flex rounded-[var(--radius-md)] border border-border bg-card p-0.5">
            <button
              type="button"
              onClick={() => setPanel("badges")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[calc(var(--radius-md)-2px)] px-3 py-1.5 text-xs font-medium",
                panel === "badges"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Badges
            </button>
            <button
              type="button"
              onClick={() => setPanel("xp")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[calc(var(--radius-md)-2px)] px-3 py-1.5 text-xs font-medium",
                panel === "xp"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Zap className="h-3.5 w-3.5" />
              XP rules
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Badges" value={data.badges.length} hint={`${activeBadges} active`} />
        <StatTile label="XP rules" value={data.rules.length} hint={`${activeRules} active`} />
        <StatTile label="Badge XP pool" value={totalXpPool} />
        <StatTile
          label="Editing"
          value={editingCode ? "Update" : "Create"}
          hint={editingCode ?? "New badge"}
        />
      </div>

      {panel === "xp" ? (
        <AdminPanel
          title="XP rules"
          description="Points awarded when participants start or finish assessments. Changes save on blur."
          help={{
            label: "When to turn a rule off",
            body: "Inactive rules stop granting XP immediately. Existing balances are kept.",
          }}
          action={<ResultCount shown={data.rules.length} total={data.rules.length} noun="rules" />}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.rules.map((rule) => (
              <article key={rule.code} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{rule.label}</p>
                    <p className="text-xs text-muted-foreground">{rule.code}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill tone={rule.active ? "live" : "draft"}>
                      {rule.active ? "On" : "Off"}
                    </StatusPill>
                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
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
                      On
                    </label>
                  </div>
                </div>
                <label className="mt-4 block text-xs text-muted-foreground">
                  Points
                  <input
                    type="number"
                    defaultValue={rule.points}
                    min={0}
                    max={1000}
                    onBlur={(event) => {
                      const points = Number(event.target.value);
                      if (points !== rule.points)
                        ruleMutation.mutate({
                          code: rule.code,
                          points,
                          active: rule.active,
                        });
                    }}
                    className="field mt-1.5"
                    aria-label={`${rule.label} points`}
                  />
                </label>
              </article>
            ))}
          </div>
        </AdminPanel>
      ) : (
        <section className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
          <div className="min-w-0 space-y-4">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <input
                className="field min-w-0 flex-1"
                placeholder="Search badge library…"
                value={badgeSearch}
                onChange={(event) => setBadgeSearch(event.target.value)}
              />
              <button
                type="button"
                onClick={startCreate}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                New badge
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {(["all", "beginner", "intermediate", "expertise", "elite"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTrackFilter(value)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    trackFilter === value
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {value === "all" ? "All tracks" : SKILL_TRACK_LABELS[value]}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {filteredBadges.map((badge) => {
                const track = (badge.track as SkillTrack) || "intermediate";
                const selected = editingCode === badge.code;
                return (
                  <article
                    key={badge.id}
                    className={cn(
                      "surface-paper flex flex-col p-4 transition-colors",
                      selected && "ring-1 ring-accent",
                      !badge.active && "opacity-70",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <BadgeMark icon={badge.icon} code={badge.code} name={badge.name} size="lg" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium">{badge.name}</p>
                          <StatusPill>{SKILL_TRACK_LABELS[track]}</StatusPill>
                          <StatusPill tone={badge.active ? "live" : "draft"}>
                            {badge.active ? "Active" : "Off"}
                          </StatusPill>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {badge.description || "No description"}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      {badge.condition_type.replace(/_/g, " ")} · {Number(badge.condition_value)}
                      {badge.condition_topic ? ` · ${badge.condition_topic}` : ""} · +
                      {badge.xp_reward} XP
                    </p>
                    <button
                      type="button"
                      onClick={() => loadBadge(badge)}
                      className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium hover:bg-secondary"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  </article>
                );
              })}
              {filteredBadges.length === 0 ? (
                <div className="sm:col-span-2">
                  <AdminEmpty
                    title="No badges match this filter"
                    body="Try a different track or search, or create a new badge."
                  />
                </div>
              ) : null}
            </div>
          </div>

          <aside className="min-w-0 max-w-full lg:sticky lg:top-20 lg:self-start">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-hairline text-muted-foreground">
                {editingCode ? `Editing · ${editingCode}` : "Create badge"}
              </p>
              {editingCode ? (
                <button
                  type="button"
                  onClick={startCreate}
                  className="text-xs text-accent underline-offset-4 hover:underline"
                >
                  Clear form
                </button>
              ) : null}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                badgeMutation.mutate(form);
              }}
              className="surface-paper space-y-3 p-5"
            >
              <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-secondary/40 px-3 py-3">
                <BadgeMark icon={form.icon} code={form.code} name={form.name} size="xl" />
                <div className="min-w-0">
                  <p className="truncate font-display text-lg">{form.name || "Badge name"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {form.description || "Description preview"}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-xs text-muted-foreground">Code</span>
                  <input
                    className="field mt-1"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="topic_master"
                    required
                    disabled={Boolean(editingCode)}
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

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <span className="text-xs text-muted-foreground">Icon</span>
                  <div className="mt-1.5 grid grid-cols-6 gap-1.5 sm:grid-cols-8">
                    {BADGE_ICON_CATALOG.map((item) => {
                      const selected = resolveBadgeIcon(form.icon, form.code)?.id === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          title={item.label}
                          onClick={() => setForm({ ...form, icon: item.id })}
                          className={cn(
                            "flex h-9 w-full items-center justify-center rounded-md border transition-colors",
                            selected
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground",
                          )}
                        >
                          <item.Icon className="h-4 w-4" />
                          <span className="sr-only">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <label className="mt-2 block text-sm">
                    <span className="sr-only">Custom icon</span>
                    <input
                      className="field mt-1"
                      value={form.icon}
                      onChange={(e) => setForm({ ...form, icon: e.target.value })}
                      maxLength={32}
                      placeholder="Catalog key or emoji"
                      aria-label="Icon key or emoji"
                    />
                  </label>
                </div>
                <label className="block text-sm">
                  <span className="text-xs text-muted-foreground">Category</span>
                  <input
                    className="field mt-1"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs text-muted-foreground">Skill track</span>
                  <select
                    className="field mt-1"
                    value={form.track}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        track: e.target.value as BadgeForm["track"],
                      })
                    }
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="expertise">Expertise</option>
                    <option value="elite">Elite</option>
                  </select>
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

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm sm:col-span-2">
                  <span className="text-xs text-muted-foreground">Condition</span>
                  <select
                    className="field mt-1"
                    value={form.condition_type}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        condition_type: e.target.value as BadgeForm["condition_type"],
                      })
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
                    onChange={(e) =>
                      setForm({
                        ...form,
                        condition_value: Number(e.target.value),
                      })
                    }
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
                {badgeMutation.isPending
                  ? "Saving…"
                  : editingCode
                    ? "Update badge"
                    : "Create badge"}
              </button>
            </form>
          </aside>
        </section>
      )}
    </div>
  );
}
