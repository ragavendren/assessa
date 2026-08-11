import { PageLoader, SectionHeading } from "@/components/platform";
import { getMe, saveProfile } from "@/lib/platform.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My profile — Assessa" },
      {
        name: "description",
        content:
          "Manage the participant details that auto-fill every assessment registration, plus leaderboard privacy.",
      },
      { property: "og:title", content: "My profile — Assessa" },
      { property: "og:description", content: "Your participant identity across every assessment." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const fetchMe = useServerFn(getMe);
  const save = useServerFn(saveProfile);
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });

  const [form, setForm] = useState({
    full_name: "",
    mobile: "",
    participant_id: "",
    organization: "",
    department: "",
    display_name: "",
    team_group: "",
    leaderboard_opt_out: false,
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
      team_group: data.profile.team_group ?? "",
      leaderboard_opt_out: !!data.profile.leaderboard_opt_out,
    });
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => save({ data: form }),
    onSuccess: () => {
      toast.success("Profile saved");
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save"),
  });

  if (isPending || !data) return <PageLoader />;

  return (
    <div className="mx-auto max-w-2xl">
      <SectionHeading eyebrow="Account" title="My profile" />
      <p className="mb-6 text-sm text-muted-foreground">
        These details auto-fill every assessment you register for. Email is managed by your sign-in
        method.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (form.full_name.trim().length < 2) {
            toast.error("Enter your full name");
            return;
          }
          mutation.mutate();
        }}
        className="surface-paper space-y-4 p-6"
      >
        <div>
          <p className="text-hairline text-muted-foreground">Email</p>
          <p className="mt-1 text-sm">{data.profile.email}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Full name" value={form.full_name} onChange={(v) => set("full_name", v)} />
          <Text label="Mobile" value={form.mobile} onChange={(v) => set("mobile", v)} />
          <Text
            label="Participant ID"
            value={form.participant_id}
            onChange={(v) => set("participant_id", v)}
          />
          <Text
            label="Organisation"
            value={form.organization}
            onChange={(v) => set("organization", v)}
          />
          <Text label="Department" value={form.department} onChange={(v) => set("department", v)} />
          <Text label="Team / group" value={form.team_group} onChange={(v) => set("team_group", v)} />
          <Text
            label="Leaderboard display name"
            value={form.display_name}
            onChange={(v) => set("display_name", v)}
          />
        </div>

        <label className="flex items-start gap-3 rounded-md bg-secondary p-3.5 text-sm">
          <input
            type="checkbox"
            checked={form.leaderboard_opt_out}
            onChange={(event) => set("leaderboard_opt_out", event.target.checked)}
            className="mt-0.5"
          />
          <span>
            Hide me from public leaderboards
            <span className="block text-xs text-muted-foreground">
              You will still see your own rank and results.
            </span>
          </span>
        </label>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {mutation.isPending ? "Saving…" : "Save profile"}
        </button>
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-hairline text-muted-foreground">{label}</span>
      <input
        className="field mt-1.5"
        maxLength={120}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
