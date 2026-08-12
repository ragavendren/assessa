import { ListToolbar, listViewClass, useListViewMode } from "@/components/ListToolbar";
import { EmptyState, PageLoader, SectionHeading } from "@/components/platform";
import { formatDate } from "@/lib/gamification";
import { listNotifications, markNotificationsRead } from "@/lib/platform.functions";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Assessa" },
      {
        name: "description",
        content: "Invitations, results, badge unlocks and reminders for your assessments.",
      },
      { property: "og:title", content: "Notifications — Assessa" },
      { property: "og:description", content: "Your assessment notifications." },
    ],
  }),
  component: Notifications,
});

type StatusFilter = "all" | "unread" | "read";

function Notifications() {
  const fetchNotifications = useServerFn(listNotifications);
  const markRead = useServerFn(markNotificationsRead);
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(),
  });
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useListViewMode("notifications", "stack");

  const mutation = useMutation({
    mutationFn: () => markRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((item) => {
      if (status === "unread" && item.read) return false;
      if (status === "read" && !item.read) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        (item.body ?? "").toLowerCase().includes(q) ||
        (item.kind ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, search, status]);

  if (isPending || !data) return <PageLoader />;

  const unread = data.filter((item) => !item.read).length;

  return (
    <div className="mx-auto max-w-3xl">
      <SectionHeading
        eyebrow={unread > 0 ? `${unread} unread` : "All caught up"}
        title="Notifications"
        action={
          unread > 0 ? (
            <button
              onClick={() => mutation.mutate()}
              className="text-sm text-accent underline-offset-4 hover:underline"
            >
              Mark all read
            </button>
          ) : null
        }
      />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search notifications…"
        filters={
          [
            { value: "all" as const, label: "All", count: data.length },
            { value: "unread" as const, label: "Unread", count: unread },
            { value: "read" as const, label: "Read", count: data.length - unread },
          ] as const
        }
        filter={status}
        onFilterChange={setStatus}
        view={view}
        onViewChange={setView}
      />

      {data.length === 0 ? (
        <EmptyState icon="🔔" title="No notifications yet" />
      ) : visible.length === 0 ? (
        <EmptyState icon="🔔" title="No matching notifications" />
      ) : view === "table" ? (
        <div className="surface-paper overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Message</th>
                <th className="p-3 font-medium">Kind</th>
                <th className="p-3 font-medium">When</th>
                <th className="p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((item) => (
                <tr key={item.id} className={cn(!item.read && "bg-accent/[0.06]")}>
                  <td className="p-3">
                    <p className="font-medium">
                      {item.icon ?? "🔔"} {item.title}
                    </p>
                    {item.body ? (
                      <p className="text-xs text-muted-foreground">{item.body}</p>
                    ) : null}
                  </td>
                  <td className="p-3 capitalize">{item.kind ?? "info"}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(item.created_at)}</td>
                  <td className="p-3">{item.read ? "Read" : "Unread"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={listViewClass(view)}>
          {visible.map((item) => (
            <div
              key={item.id}
              className={cn("surface-paper flex gap-3 p-4", !item.read && "bg-accent/[0.06]")}
            >
              <span className="text-xl">{item.icon ?? "🔔"}</span>
              <div>
                <p className="font-medium">{item.title}</p>
                {item.body ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">{item.body}</p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(item.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
