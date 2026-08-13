import { AvatarPicker } from "@/components/AvatarPicker";
import { OrgDepartmentFields } from "@/components/OrgDepartmentFields";
import { PageLoader, SectionHeading } from "@/components/platform";
import { getMe, saveProfile } from "@/lib/platform.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My profile — Assessa" },
      {
        name: "description",
        content:
          "Manage your Assessa identity, avatar, organisation details and leaderboard privacy.",
      },
      { property: "og:title", content: "My profile — Assessa" },
      {
        property: "og:description",
        content: "Your participant identity across every assessment.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const fetchMe = useServerFn(getMe);
  const save = useServerFn(saveProfile);
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: ["me"],
    queryFn: () => fetchMe(),
  });

  const [form, setForm] = useState({
    full_name: "",
    mobile: "",
    participant_id: "",
    organization: "",
    department: "",
    display_name: "",
    leaderboard_opt_out: false,
    avatar_id: null as string | null,
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      full_name: data.profile.full_name ?? "",
      mobile: data.profile.mobile ?? "",
      participant_id: data.profile.participant_id ?? "",
      organization: data.profile.organization ?? "",
      department: data.profile.department ?? "",
      display_name: data.profile.display_name ?? "",
      leaderboard_opt_out: !!data.profile.leaderboard_opt_out,
      avatar_id: data.profile.avatar_id ?? null,
    });
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          ...form,
          team_group: form.department,
          avatar_id: form.avatar_id,
        },
      }),
    onSuccess: () => {
      toast.success("Profile saved");
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save"),
  });

  if (isPending || !data) return <PageLoader />;

  const displayLabel =
    form.display_name.trim() || form.full_name.trim() || data.profile.email || "Participant";

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="animate-dash-rise relative z-20 overflow-visible rounded-2xl border border-border bg-gradient-to-br from-card via-card to-secondary/45 p-6 md:p-7">
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
          aria-hidden
        >
          <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-accent/15 blur-3xl animate-dash-float" />
        </div>
        <div className="relative flex flex-wrap items-center gap-5">
          <AvatarPicker
            value={form.avatar_id}
            name={form.full_name}
            onChange={(avatarId) => set("avatar_id", avatarId)}
            sizeClassName="h-20 w-20"
          />
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-accent">
              Assessa Yourself
            </p>
            <h1 className="mt-1 font-display text-3xl">{displayLabel}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {data.profile.email}
              </span>
              {data.profile.participant_id ? (
                <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                  <Shield className="h-3.5 w-3.5" />
                  {data.profile.participant_id}
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (form.full_name.trim().length < 2) {
            toast.error("Enter your full name");
            return;
          }
          if (!form.organization.trim() || !form.department.trim()) {
            toast.error("Select organisation and team / group");
            return;
          }
          mutation.mutate();
        }}
        className="space-y-6"
      >
        <section
          className="animate-dash-rise surface-paper space-y-5 p-5 md:p-6"
          style={{ animationDelay: "60ms" }}
        >
          <SectionHeading eyebrow="Identity" title="Personal details" />
          <p className="text-sm text-muted-foreground">
            These details auto-fill assessment registration. Email is managed by your sign-in
            method.
          </p>

          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Email
            </p>
            <p className="mt-1.5 rounded-md bg-secondary/50 px-3 py-2.5 text-sm">
              {data.profile.email}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Text
              label="Full name *"
              value={form.full_name}
              onChange={(v) => set("full_name", v)}
              required
            />
            <Text label="Mobile" value={form.mobile} onChange={(v) => set("mobile", v)} />
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Participant ID
              </span>
              <input
                className="field mt-1.5 bg-secondary/50 font-mono text-sm"
                value={form.participant_id || "Assigned on save"}
                readOnly
              />
            </label>
            <Text
              label="Leaderboard display name"
              value={form.display_name}
              onChange={(v) => set("display_name", v)}
            />
          </div>
        </section>

        <section
          className="animate-dash-rise surface-paper space-y-4 p-5 md:p-6"
          style={{ animationDelay: "120ms" }}
        >
          <SectionHeading eyebrow="Organisation" title="Team placement" />
          <OrgDepartmentFields
            organization={form.organization}
            department={form.department}
            onOrganizationChange={(value) => set("organization", value)}
            onDepartmentChange={(value) => set("department", value)}
          />
        </section>

        {data.isAdmin ? (
          <section
            className="animate-dash-rise surface-paper space-y-4 p-5 md:p-6"
            style={{ animationDelay: "180ms" }}
          >
            <SectionHeading eyebrow="Privacy" title="Leaderboard visibility" />
            <p className="rounded-xl border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
              Administrator accounts are never listed on public leaderboards, including ranks
              shown after an attempt.
            </p>
          </section>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Fields marked * are required.</p>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60"
          >
            {mutation.isPending ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>
    </div>
  );

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }
}

function Text({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <input
        className="field mt-1.5"
        maxLength={120}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
