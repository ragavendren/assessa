import { AdminNav } from "@/components/AdminNav";
import {
  AdminEmpty,
  AdminPageHeader,
  AdminPanel,
  ResultCount,
  StatusPill,
} from "@/components/admin/AdminPageUi";
import { PageLoader } from "@/components/platform";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  deleteDepartment,
  deleteOrganization,
  getAdminOrganizations,
  upsertDepartment,
  upsertOrganization,
} from "@/lib/admin.functions";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  const [orgSearch, setOrgSearch] = useState("");

  const orgs = data?.organizations ?? [];
  const departments = data?.departments ?? [];

  const filteredOrgs = useMemo(() => {
    const q = orgSearch.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter((org) => org.name.toLowerCase().includes(q));
  }, [orgs, orgSearch]);

  const teamCountByOrg = useMemo(() => {
    const map = new Map<string, number>();
    for (const dept of departments) {
      map.set(dept.organization_id, (map.get(dept.organization_id) ?? 0) + 1);
    }
    return map;
  }, [departments]);

  useEffect(() => {
    if (selectedOrgId || filteredOrgs.length === 0) return;
    setSelectedOrgId(filteredOrgs[0]!.id);
  }, [filteredOrgs, selectedOrgId]);

  const selectedOrg = useMemo(
    () => orgs.find((org) => org.id === selectedOrgId) ?? null,
    [orgs, selectedOrgId],
  );

  const teams = useMemo(
    () =>
      departments.filter((dept) =>
        selectedOrgId ? dept.organization_id === selectedOrgId : false,
      ),
    [departments, selectedOrgId],
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
      <AdminPageHeader
        eyebrow="People"
        title="Organisations"
        summary="Participants pick an organisation, then a team / group at signup. Names must match assessment access and leaderboard filters."
        help={{
          label: "Why this matters",
          body: "Organisation and group access on assessments match these names exactly. Keep spelling consistent.",
        }}
      />

      {isPending || !data ? (
        <PageLoader />
      ) : (
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
          <AdminPanel
            title="Organisations"
            description="Add a company or school, then select it to manage teams."
            help={{
              label: "Inactive orgs",
              body: "Inactive organisations stay in history but are hidden from signup pickers.",
            }}
            action={<ResultCount shown={filteredOrgs.length} total={orgs.length} noun="orgs" />}
          >
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

            {orgs.length > 0 ? (
              <label className="relative mb-3 block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="field pl-9"
                  value={orgSearch}
                  onChange={(event) => setOrgSearch(event.target.value)}
                  placeholder="Filter organisations…"
                  aria-label="Filter organisations"
                />
              </label>
            ) : null}

            {filteredOrgs.length === 0 ? (
              <AdminEmpty
                title={orgs.length === 0 ? "No organisations yet" : "No match"}
                body={
                  orgs.length === 0
                    ? "Add the companies or schools that participants belong to."
                    : "Try a different search."
                }
              />
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
                {filteredOrgs.map((org) => {
                  const count = teamCountByOrg.get(org.id) ?? 0;
                  const selected = selectedOrgId === org.id;
                  return (
                    <li key={org.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedOrgId(org.id)}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 px-3 py-3 text-left text-sm transition-colors",
                          selected ? "bg-primary/5" : "hover:bg-secondary/50",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{org.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {count} team{count === 1 ? "" : "s"} / group{count === 1 ? "" : "s"}
                          </span>
                        </span>
                        <StatusPill tone={org.active ? "live" : "draft"}>
                          {org.active ? "Active" : "Inactive"}
                        </StatusPill>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </AdminPanel>

          <AdminPanel
            className="lg:sticky lg:top-20"
            title={selectedOrg ? `Teams / groups · ${selectedOrg.name}` : "Teams / groups"}
            description="These names appear in signup and One team / group assessment access."
            action={
              selectedOrg ? (
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
              ) : null
            }
          >
            {!selectedOrg ? (
              <AdminEmpty
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
                  <p className="rounded-md border border-dashed border-border bg-secondary/20 px-3 py-8 text-center text-sm text-muted-foreground">
                    No teams / groups yet for this organisation.
                  </p>
                ) : (
                  <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
                    {teams.map((team) => (
                      <li
                        key={team.id}
                        className="flex items-center justify-between gap-3 px-3 py-3 text-sm"
                      >
                        <span>
                          <span className="block font-medium">{team.name}</span>
                          {!team.active ? (
                            <span className="text-xs text-muted-foreground">Inactive</span>
                          ) : null}
                        </span>
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
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
          </AdminPanel>
        </div>
      )}
    </div>
  );
}
