import { OrgDepartmentFields } from "@/components/OrgDepartmentFields";
import { useMe } from "@/hooks/use-me";
import { saveProfile } from "@/lib/platform.functions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/** Blocks the app until organisation + department are set (asked at login / first session). */
export function ProfileCompletionGate({ children }: { children: React.ReactNode }) {
  const save = useServerFn(saveProfile);
  const queryClient = useQueryClient();
  // Reuse shared ["me"] query — do not double-fetch on every page.
  const { data, isPending } = useMe();

  const [organization, setOrganization] = useState("");
  const [department, setDepartment] = useState("");

  useEffect(() => {
    if (!data) return;
    setOrganization(data.profile.organization ?? "");
    setDepartment(data.profile.department ?? "");
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          full_name: data!.profile.full_name || "Participant",
          mobile: data!.profile.mobile ?? "",
          participant_id: data!.profile.participant_id ?? "",
          organization,
          department,
          display_name: data!.profile.display_name ?? "",
          team_group: data!.profile.team_group ?? "",
          leaderboard_opt_out: !!data!.profile.leaderboard_opt_out,
          avatar_id: data!.profile.avatar_id ?? null,
        },
      }),
    onSuccess: () => {
      toast.success("Organisation details saved");
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not save organisation"),
  });

  if (isPending || !data) return children;
  if (!data.needsOrg) return children;

  // Admins with an empty catalog can still reach Orgs admin to seed it.
  if (data.isAdmin) {
    return (
      <>
        {children}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-amber-500/40 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950">
          Set your organisation and team / group in{" "}
          <Link to="/profile" className="font-semibold underline">
            Profile
          </Link>
          , or manage the catalog under{" "}
          <Link to="/admin/organizations" className="font-semibold underline">
            Admin → Organisations
          </Link>
          .
        </div>
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="surface-paper w-full max-w-lg p-6 shadow-lg">
        <p className="font-display text-2xl text-primary">Assessa</p>
        <h1 className="mt-2 font-display text-xl">Complete your profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose your organisation and team / group to continue. These are managed by your
          administrator and used for access and leaderboards.
        </p>

        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!organization.trim() || !department.trim()) {
              toast.error("Select organisation and team / group");
              return;
            }
            mutation.mutate();
          }}
        >
          <OrgDepartmentFields
            organization={organization}
            department={department}
            onOrganizationChange={setOrganization}
            onDepartmentChange={setDepartment}
          />
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {mutation.isPending ? "Saving…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
