import { AdminNav } from "@/components/AdminNav";
import { EmptyState, PageLoader, SectionHeading } from "@/components/platform";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  deleteDepartment,
  deleteOrganization,
  getAdminOrganizations,
  upsertDepartment,
  upsertOrganization,
} from "@/lib/admin.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/organizations")({
  head: () => ({
    meta: [
      { title: "Organisations — Assessa Admin" },
      {
        name: "description",
        content: "Manage organisations and teams/groups used at signup and for access control.",
      },
    ],
  }),
  component: AdminOrganizationsPage,
});

function AdminOrganizationsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const fetchOrgs = useServerFn(getAdminOrganizations);
  const saveOrg = useServerFn(upsertOrganization);
  const saveDept = useServerFn(upsertDepartment);
  const removeOrg = useServerFn(deleteOrganization);
  const removeDept = useServerFn(deleteDepartment);

  const { data, isPending } = useQuery({
    queryKey: ["admin-organizations"],
    queryFn: () => fetchOrgs(),
  });

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [teamName, setTeamName] = useState("");

  const selectedOrg = useMemo(
    () => (data?.organizations ?? []).find((org) => org.id === selectedOrgId) ?? null,
    [data?.organizations, selectedOrgId],
  );

  const teams = useMemo(
    () =>
      (data?.departments ?? []).filter((dept) =>
        selectedOrgId ? dept.organization_id === selectedOrgId : false,
      ),
    [data?.departments, selectedOrgId],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-organizations"] });
    queryClient.invalidateQueries({ queryKey: ["org-catalog"] });
  };

  const orgMutation = useMutation({
    mutationFn: () => saveOrg({ data: { name: orgName } }),
    onSuccess: (result) => {
      toast.success("Organisation saved");
      setOrgName("");
      setSelectedOrgId(result.id);
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not save organisation"),
  });

  const teamMutation = useMutation({
    mutationFn: () =>
      saveDept({
        data: { organizationId: selectedOrgId!, name: teamName },
      }),
    onSuccess: () => {
      toast.success("Team / group saved");
      setTeamName("");
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not save team / group"),
  });

  return (
    <div>
      <AdminNav />
      <SectionHeading eyebrow="Admin" title="Organisations" />
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Participants must pick an organisation and team / group when they sign up or first sign in.
        Keep names consistent — organisation access and leaderboards match on these values.
      </p>

      {isPending || !data ? (
        <PageLoader />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <section className="surface-paper p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-hairline text-muted-foreground">Organisations</p>
              <span className="text-xs text-muted-foreground">{data.organizations.length}</span>
            </div>

            <form
              className="mb-4 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (orgName.trim().length < 2) {
                  toast.error("Organisation name is required");
                  return;
                }
                orgMutation.mutate();
              }}
            >
              <input
                className="field flex-1"
                placeholder="Add organisation…"
                value={orgName}
                onChange={(event) => setOrgName(event.target.value)}
                required
              />
              <button
                type="submit"
                disabled={orgMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </form>

            {data.organizations.length === 0 ? (
              <EmptyState
                icon="🏢"
                title="No organisations yet"
                body="Add the companies or schools that participants belong to."
              />
            ) : (
              <ul className="divide-y divide-border">
                {data.organizations.map((org) => (
                  <li key={org.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedOrgId(org.id)}
                      className={
                        "flex w-full items-center justify-between gap-3 px-2 py-3 text-left text-sm transition-colors " +
                        (selectedOrgId === org.id
                          ? "bg-accent/10 font-medium"
                          : "hover:bg-secondary")
                      }
                    >
                      <span>{org.name}</span>
                      {!org.active ? (
                        <span className="text-xs text-muted-foreground">inactive</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="surface-paper p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-hairline text-muted-foreground">
                Teams / Groups{selectedOrg ? ` · ${selectedOrg.name}` : ""}
              </p>
              {selectedOrg ? (
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      const ok = await confirm({
                        title: "Delete organisation?",
                        description: `Delete organisation “${selectedOrg.name}” and all its teams/groups?`,
                        confirmLabel: "Delete organisation",
                        tone: "destructive",
                      });
                      if (!ok) return;
                      try {
                        await removeOrg({ data: { id: selectedOrg.id } });
                        toast.success("Organisation deleted");
                        setSelectedOrgId(null);
                        invalidate();
                      } catch (error: unknown) {
                        toast.error(
                          error instanceof Error ? error.message : "Could not delete organisation",
                        );
                      }
                    })();
                  }}
                  className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete organisation
                </button>
              ) : null}
            </div>

            {!selectedOrg ? (
              <EmptyState
                icon="🗂️"
                title="Select an organisation"
                body="Choose an organisation on the left to manage its teams / groups."
              />
            ) : (
              <>
                <form
                  className="mb-4 flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (teamName.trim().length < 2) {
                      toast.error("Team / group name is required");
                      return;
                    }
                    teamMutation.mutate();
                  }}
                >
                  <input
                    className="field flex-1"
                    placeholder="Add team / group…"
                    value={teamName}
                    onChange={(event) => setTeamName(event.target.value)}
                    required
                  />
                  <button
                    type="submit"
                    disabled={teamMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    <Plus className="h-4 w-4" /> Add
                  </button>
                </form>

                {teams.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No teams / groups yet for this organisation.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {teams.map((team) => (
                      <li
                        key={team.id}
                        className="flex items-center justify-between gap-3 px-2 py-3 text-sm"
                      >
                        <span>{team.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            void (async () => {
                              const ok = await confirm({
                                title: "Delete team / group?",
                                description: `Delete team / group “${team.name}”?`,
                                confirmLabel: "Delete",
                                tone: "destructive",
                              });
                              if (!ok) return;
                              try {
                                await removeDept({ data: { id: team.id } });
                                toast.success("Team / group deleted");
                                invalidate();
                              } catch (error: unknown) {
                                toast.error(
                                  error instanceof Error
                                    ? error.message
                                    : "Could not delete team / group",
                                );
                              }
                            })();
                          }}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Delete ${team.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
