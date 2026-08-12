import { AdminNav } from "@/components/AdminNav";
import { ListToolbar, listViewClass, useListViewMode } from "@/components/ListToolbar";
import { PageLoader, SectionHeading, StatTile, ScorePill } from "@/components/platform";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  deleteAdminUser,
  getAdminUserDetail,
  getAdminUsers,
  setUserBanned,
  setUserRole,
  updateAdminUser,
} from "@/lib/admin.functions";
import { formatDate } from "@/lib/gamification";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "Users & activity — Assessa" },
      {
        name: "description",
        content: "Manage participants, roles, and track assessment activity and performance.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminUsersPage,
});

type EditForm = {
  full_name: string;
  email: string;
  organization: string;
  department: string;
  mobile: string;
  participant_id: string;
  display_name: string;
  team_group: string;
};

function AdminUsersPage() {
  const fetchUsers = useServerFn(getAdminUsers);
  const fetchDetail = useServerFn(getAdminUserDetail);
  const updateRole = useServerFn(setUserRole);
  const updateBan = useServerFn(setUserBanned);
  const saveUser = useServerFn(updateAdminUser);
  const removeUser = useServerFn(deleteAdminUser);
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "participant">("all");
  const [view, setView] = useListViewMode("admin-users", "table");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);

  const { data, isPending, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchUsers(),
    retry: false,
  });

  const detailQuery = useQuery({
    queryKey: ["admin-user-detail", selectedUserId],
    queryFn: () => fetchDetail({ data: { userId: selectedUserId! } }),
    enabled: !!selectedUserId,
    retry: false,
  });

  useEffect(() => {
    setEditing(false);
    setForm(null);
  }, [selectedUserId]);

  useEffect(() => {
    if (!detailQuery.data || !editing) return;
    const profile = detailQuery.data.profile;
    setForm({
      full_name: profile.fullName,
      email: profile.email,
      organization: profile.organization,
      department: profile.department,
      mobile: profile.mobile,
      participant_id: profile.participantId,
      display_name: profile.displayName,
      team_group: profile.teamGroup,
    });
  }, [detailQuery.data, editing]);

  const roleMutation = useMutation({
    mutationFn: (payload: { userId: string; role: "admin" | "participant" }) =>
      updateRole({ data: payload }),
    onSuccess: () => {
      toast.success("Role updated");
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      void queryClient.invalidateQueries({
        queryKey: ["admin-user-detail", selectedUserId],
      });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update role"),
  });

  const banMutation = useMutation({
    mutationFn: (payload: { userId: string; banned: boolean }) => updateBan({ data: payload }),
    onSuccess: (_, variables) => {
      toast.success(variables.banned ? "User banned" : "User unbanned");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update user"),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: EditForm & { userId: string }) => saveUser({ data: payload }),
    onSuccess: () => {
      toast.success("User updated");
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      void queryClient.invalidateQueries({
        queryKey: ["admin-user-detail", selectedUserId],
      });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save user"),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => removeUser({ data: { userId } }),
    onSuccess: () => {
      toast.success("User deleted");
      setSelectedUserId(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not delete user"),
  });

  const filtered = useMemo(() => {
    const users = data?.users ?? [];
    const needle = query.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter === "admin" && !user.isAdmin) return false;
      if (roleFilter === "participant" && user.isAdmin) return false;
      if (!needle) return true;
      return (
        user.name.toLowerCase().includes(needle) ||
        user.email.toLowerCase().includes(needle) ||
        (user.organization ?? "").toLowerCase().includes(needle) ||
        (user.department ?? "").toLowerCase().includes(needle)
      );
    });
  }, [data?.users, query, roleFilter]);

  if (isPending) return <PageLoader label="Loading users…" />;
  if (error || !data) {
    return (
      <div className="surface-paper p-8 text-center">
        <p className="font-display text-xl">Administrator access required</p>
      </div>
    );
  }

  const totals = {
    users: data.users.length,
    admins: data.users.filter((user) => user.isAdmin).length,
    active: data.users.filter((user) => user.attempts > 0).length,
    avgPass: data.users.length
      ? Math.round(data.users.reduce((sum, user) => sum + user.passRate, 0) / data.users.length)
      : 0,
  };

  return (
    <div className="space-y-8">
      <AdminNav />
      <SectionHeading eyebrow="People" title="Users & activity" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Users" value={totals.users} />
        <StatTile label="Admins" value={totals.admins} />
        <StatTile label="Active participants" value={totals.active} />
        <StatTile label="Avg pass rate" value={totals.avgPass} suffix="%" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-3">
          <ListToolbar
            search={query}
            onSearchChange={setQuery}
            searchPlaceholder="Search name, email, organisation…"
            filters={
              [
                { value: "all" as const, label: "All", count: data.users.length },
                {
                  value: "admin" as const,
                  label: "Admins",
                  count: data.users.filter((u) => u.isAdmin).length,
                },
                {
                  value: "participant" as const,
                  label: "Participants",
                  count: data.users.filter((u) => !u.isAdmin).length,
                },
              ] as const
            }
            filter={roleFilter}
            onFilterChange={setRoleFilter}
            view={view}
            onViewChange={setView}
          />
          {view === "table" ? (
            <div className="surface-paper overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3 font-medium">User</th>
                    <th className="p-3 font-medium">Role</th>
                    <th className="p-3 font-medium">Opted</th>
                    <th className="p-3 font-medium">Done</th>
                    <th className="p-3 font-medium">Pass</th>
                    <th className="p-3 font-medium">Avg</th>
                    <th className="p-3 font-medium">Last activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((user) => (
                    <tr
                      key={user.id}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-secondary/40",
                        selectedUserId === user.id && "bg-secondary/50",
                      )}
                      onClick={() => setSelectedUserId(user.id)}
                    >
                      <td className="p-3">
                        <p className="font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </td>
                      <td className="p-3">
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold">
                          {user.isAdmin ? "admin" : "participant"}
                        </span>
                      </td>
                      <td className="p-3 tabular-nums">{user.optedAssessments}</td>
                      <td className="p-3 tabular-nums">
                        {user.completedAssessments}
                        <span className="text-muted-foreground"> ({user.completionRate}%)</span>
                      </td>
                      <td className="p-3 tabular-nums">{user.passRate}%</td>
                      <td className="p-3 tabular-nums">{user.averageScore}%</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {user.lastActivity ? formatDate(user.lastActivity) : "—"}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-muted-foreground">
                        No users match your search.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={listViewClass(view)}>
              {filtered.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setSelectedUserId(user.id)}
                  className={cn(
                    "surface-paper w-full p-4 text-left transition-colors hover:bg-secondary/30",
                    selectedUserId === user.id && "ring-1 ring-accent",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold">
                      {user.isAdmin ? "admin" : "participant"}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Done</dt>
                      <dd className="font-semibold tabular-nums">{user.completedAssessments}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Pass</dt>
                      <dd className="font-semibold tabular-nums">{user.passRate}%</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Avg</dt>
                      <dd className="font-semibold tabular-nums">{user.averageScore}%</dd>
                    </div>
                  </dl>
                </button>
              ))}
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground">No users match your search.</p>
              ) : null}
            </div>
          )}
        </section>

        <aside className="surface-paper p-5">
          {!selectedUserId ? (
            <p className="text-sm text-muted-foreground">
              Select a user to view assessment activity, edit profile details, or delete the
              account.
            </p>
          ) : detailQuery.isPending ? (
            <PageLoader label="Loading activity…" />
          ) : detailQuery.error || !detailQuery.data ? (
            <p className="text-sm text-destructive">Could not load user detail.</p>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-hairline text-muted-foreground">Participant</p>
                <h3 className="mt-1 font-display text-2xl">{detailQuery.data.profile.name}</h3>
                <p className="text-sm text-muted-foreground">{detailQuery.data.profile.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {detailQuery.data.profile.organization || "No organisation"}
                  {detailQuery.data.profile.department
                    ? ` · ${detailQuery.data.profile.department}`
                    : ""}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setEditing((value) => !value)}
                  className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                >
                  {editing ? "Cancel edit" : "Edit user"}
                </button>
                <button
                  type="button"
                  disabled={roleMutation.isPending}
                  onClick={() =>
                    roleMutation.mutate({
                      userId: detailQuery.data.profile.id,
                      role: detailQuery.data.profile.isAdmin ? "participant" : "admin",
                    })
                  }
                  className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-60"
                >
                  {detailQuery.data.profile.isAdmin ? "Make participant" : "Make admin"}
                </button>
                <button
                  type="button"
                  disabled={banMutation.isPending}
                  onClick={() => {
                    void (async () => {
                      const ok = await confirm({
                        title: "Ban this user?",
                        description:
                          "They will be blocked from signing in. You can reverse this later.",
                        confirmLabel: "Ban user",
                        tone: "destructive",
                      });
                      if (!ok) return;
                      banMutation.mutate({
                        userId: detailQuery.data.profile.id,
                        banned: true,
                      });
                    })();
                  }}
                  className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
                >
                  Ban user
                </button>
                <button
                  type="button"
                  disabled={banMutation.isPending}
                  onClick={() =>
                    banMutation.mutate({
                      userId: detailQuery.data.profile.id,
                      banned: false,
                    })
                  }
                  className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-60"
                >
                  Unban
                </button>
                <button
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    void (async () => {
                      const ok = await confirm({
                        title: "Delete user permanently?",
                        description: `Permanently delete ${detailQuery.data.profile.name}? This cannot be undone.`,
                        confirmLabel: "Delete user",
                        tone: "destructive",
                      });
                      if (!ok) return;
                      deleteMutation.mutate(detailQuery.data.profile.id);
                    })();
                  }}
                  className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
                >
                  Delete user
                </button>
              </div>

              {editing && form ? (
                <form
                  className="space-y-3 rounded-md border border-border p-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    saveMutation.mutate({
                      userId: detailQuery.data.profile.id,
                      ...form,
                    });
                  }}
                >
                  <p className="text-hairline text-muted-foreground">Edit profile</p>
                  {(
                    [
                      ["full_name", "Full name *", true],
                      ["email", "Email *", true],
                      ["display_name", "Display name", false],
                      ["participant_id", "Participant ID", false],
                      ["mobile", "Mobile", false],
                      ["organization", "Organisation *", true],
                      ["department", "Team / Group *", true],
                    ] as const
                  ).map(([key, label, required]) => (
                    <label key={key} className="block text-sm">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <input
                        className={
                          key === "participant_id" ? "field mt-1 bg-secondary/50" : "field mt-1"
                        }
                        value={form[key]}
                        readOnly={key === "participant_id"}
                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                        required={required}
                      />
                      {key === "participant_id" ? (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          Auto-generated. Leave blank to assign a new ID on save if missing.
                        </span>
                      ) : null}
                    </label>
                  ))}
                  <button
                    type="submit"
                    disabled={saveMutation.isPending}
                    className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    {saveMutation.isPending ? "Saving…" : "Save changes"}
                  </button>
                </form>
              ) : null}

              <div>
                <p className="text-hairline text-muted-foreground">Assessments</p>
                <div className="mt-2 space-y-2">
                  {detailQuery.data.assessments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No assessment activity yet.</p>
                  ) : (
                    detailQuery.data.assessments.map((item) => (
                      <div key={item.examId} className="rounded-md border border-border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{item.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.topic} · {item.attempts} attempt(s) · {item.submitted} submitted
                            </p>
                          </div>
                          {item.bestScore != null ? (
                            <ScorePill score={item.bestScore} passed={item.passed} />
                          ) : (
                            <span className="text-xs text-muted-foreground">{item.lastStatus}</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="text-hairline text-muted-foreground">Recent activity</p>
                <div className="mt-2 space-y-2">
                  {detailQuery.data.activity.slice(0, 8).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{item.title}</p>
                        <span className="text-xs text-muted-foreground">{item.status}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.submittedAt
                          ? `Submitted ${formatDate(item.submittedAt)}`
                          : `Started ${formatDate(item.startedAt)}`}
                        {item.score != null ? ` · ${item.score}%` : ""}
                        {item.passed == null ? "" : item.passed ? " · passed" : " · not passed"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
