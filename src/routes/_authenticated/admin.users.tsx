import { AdminNav } from "@/components/AdminNav";
import {
  AdminAccessDenied,
  AdminEmpty,
  AdminPageHeader,
  ResultCount,
  StatusPill,
} from "@/components/admin/AdminPageUi";
import { ListToolbar, listViewClass, useListViewMode } from "@/components/ListToolbar";
import { EmptyState, Meter, PageLoader, ScorePill, StatTile } from "@/components/platform";
import { UserAvatar } from "@/components/UserAvatar";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  deleteAdminUser,
  getAdminUserDetail,
  getAdminUsers,
  setUserBanned,
  setUserRole,
  updateAdminUser,
} from "@/lib/admin.functions";
import { formatDate, formatDateTime } from "@/lib/gamification";
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

const ghostBtn =
  "rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-60";
const dangerBtn =
  "rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60";

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

  useEffect(() => {
    if (!filtered.length) return;
    if (selectedUserId && filtered.some((user) => user.id === selectedUserId)) return;
    setSelectedUserId(filtered[0]!.id);
  }, [filtered, selectedUserId]);

  if (isPending) {
    return (
      <div>
        <AdminNav />
        <PageLoader label="Loading users…" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div>
        <AdminNav />
        <AdminAccessDenied />
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

  const selectedUser = data.users.find((user) => user.id === selectedUserId);

  return (
    <div className="space-y-10">
      <AdminNav />
      <AdminPageHeader
        eyebrow="People"
        title="Users & activity"
        summary="Find a participant, review their papers, then edit profile, role, or access from the detail panel."
        help={{
          label: "Roles and bans",
          body: "Admins can author assessments. Ban blocks sign-in without deleting history. Delete is permanent.",
        }}
      />

      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        <StatTile label="Users" value={totals.users} hint="Everyone with an account" />
        <StatTile label="Admins" value={totals.admins} hint="Can access this control panel" />
        <StatTile
          label="Active participants"
          value={totals.active}
          hint="At least one assessment attempt"
        />
        <StatTile
          label="Avg pass rate"
          value={totals.avgPass}
          suffix="%"
          hint="Mean of each user’s pass rate"
        />
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:items-start">
        <section className="min-w-0 max-w-full space-y-5">
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
            trailing={
              <ResultCount shown={filtered.length} total={data.users.length} noun="users" />
            }
          />
          {filtered.length === 0 ? (
            <EmptyState
              icon="👤"
              title={data.users.length === 0 ? "No users yet" : "No match"}
              body={
                data.users.length === 0
                  ? "Accounts appear here after signup."
                  : "Try a different search or role filter."
              }
            />
          ) : view === "table" ? (
            <div className="surface-paper max-w-full overflow-hidden">
              <table className="w-full table-fixed text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="w-[44%] px-3 py-3.5 font-medium">User</th>
                    <th className="w-[18%] px-3 py-3.5 font-medium">Role</th>
                    <th className="hidden w-[12%] px-3 py-3.5 font-medium sm:table-cell">Done</th>
                    <th className="w-[13%] px-3 py-3.5 font-medium">Pass</th>
                    <th className="w-[13%] px-3 py-3.5 font-medium">Avg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((user) => (
                    <tr
                      key={user.id}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-secondary/40",
                        selectedUserId === user.id && "bg-primary/5",
                      )}
                      onClick={() => setSelectedUserId(user.id)}
                    >
                      <td className="px-3 py-3.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <UserAvatar
                            avatarId={user.avatarId}
                            name={user.name}
                            className="h-9 w-9 shrink-0"
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{user.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {user.email}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                              {user.optedAssessments} opted
                              {user.lastActivity
                                ? ` · ${formatDateTime(user.lastActivity)}`
                                : ""}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <StatusPill tone={user.isAdmin ? "admin" : "neutral"}>
                          {user.isAdmin ? "admin" : "participant"}
                        </StatusPill>
                      </td>
                      <td className="hidden px-3 py-3.5 tabular-nums sm:table-cell">
                        {user.completedAssessments}
                        <span className="text-muted-foreground"> ({user.completionRate}%)</span>
                      </td>
                      <td className="px-3 py-3.5 tabular-nums">{user.passRate}%</td>
                      <td className="px-3 py-3.5 tabular-nums">{user.averageScore}%</td>
                    </tr>
                  ))}
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
                    "surface-paper w-full p-5 text-left transition-colors hover:bg-secondary/30",
                    selectedUserId === user.id && "ring-1 ring-primary/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar avatarId={user.avatarId} name={user.name} className="h-10 w-10" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{user.name}</span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      </span>
                    </div>
                    <StatusPill tone={user.isAdmin ? "admin" : "neutral"}>
                      {user.isAdmin ? "admin" : "participant"}
                    </StatusPill>
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Done</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums">
                        {user.completedAssessments}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Pass</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums">{user.passRate}%</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Avg</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums">{user.averageScore}%</dd>
                    </div>
                  </dl>
                  <div className="mt-4 space-y-2">
                    <Meter
                      value={user.completionRate}
                      tone={user.completionRate >= 70 ? "success" : "accent"}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {user.completionRate}% of opted assessments completed
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="min-w-0 max-w-full surface-paper p-6 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6.5rem)] lg:overflow-y-auto">
          {!selectedUserId ? (
            <AdminEmpty
              title="Select a user"
              body="Choose someone on the left to view activity, edit details, or change access."
            />
          ) : detailQuery.isPending ? (
            <PageLoader label="Loading activity…" />
          ) : detailQuery.error || !detailQuery.data ? (
            <p className="text-sm text-destructive">Could not load user detail.</p>
          ) : (
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <UserAvatar
                  avatarId={detailQuery.data.profile.avatarId ?? selectedUser?.avatarId ?? null}
                  name={detailQuery.data.profile.name}
                  className="h-14 w-14 text-sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-hairline text-muted-foreground">Participant</p>
                  <h3 className="mt-1 truncate font-display text-2xl leading-tight">
                    {detailQuery.data.profile.name}
                  </h3>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {detailQuery.data.profile.email}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {detailQuery.data.profile.organization || "No organisation"}
                    {detailQuery.data.profile.department
                      ? ` · ${detailQuery.data.profile.department}`
                      : ""}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <StatusPill tone={detailQuery.data.profile.isAdmin ? "admin" : "neutral"}>
                      {detailQuery.data.profile.isAdmin ? "admin" : "participant"}
                    </StatusPill>
                    {detailQuery.data.profile.leaderboardOptOut ? (
                      <StatusPill>Leaderboard opt-out</StatusPill>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-secondary/20 p-3.5">
                <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Account
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing((value) => !value)}
                    className={ghostBtn}
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
                    className={ghostBtn}
                  >
                    {detailQuery.data.profile.isAdmin ? "Make participant" : "Make admin"}
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
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
                    className={dangerBtn}
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
                    className={ghostBtn}
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
                    className={dangerBtn}
                  >
                    Delete user
                  </button>
                </div>
              </div>

              {editing && form ? (
                <form
                  className="space-y-4 rounded-lg border border-border bg-secondary/20 p-4"
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
                          key === "participant_id" ? "field mt-1.5 bg-secondary/50" : "field mt-1.5"
                        }
                        value={form[key]}
                        readOnly={key === "participant_id"}
                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                        required={required}
                      />
                      {key === "participant_id" ? (
                        <span className="mt-1.5 block text-xs text-muted-foreground">
                          Auto-generated. Leave blank to assign a new ID on save if missing.
                        </span>
                      ) : null}
                    </label>
                  ))}
                  <button
                    type="submit"
                    disabled={saveMutation.isPending}
                    className="w-full rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    {saveMutation.isPending ? "Saving…" : "Save changes"}
                  </button>
                </form>
              ) : null}

              <div className="border-t border-border pt-6">
                <p className="text-hairline text-muted-foreground">Assessments</p>
                <div className="mt-3 space-y-3">
                  {detailQuery.data.assessments.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
                      No assessment activity yet.
                    </p>
                  ) : (
                    detailQuery.data.assessments.map((item) => (
                      <div key={item.examId} className="rounded-md border border-border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium">{item.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
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

              <div className="border-t border-border pt-6">
                <p className="text-hairline text-muted-foreground">Recent activity</p>
                <div className="mt-3 space-y-3">
                  {detailQuery.data.activity.slice(0, 8).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-md border border-border px-4 py-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">{item.title}</p>
                        <StatusPill
                          tone={
                            item.status === "submitted"
                              ? item.passed
                                ? "success"
                                : "danger"
                              : "neutral"
                          }
                        >
                          {item.status}
                        </StatusPill>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
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
