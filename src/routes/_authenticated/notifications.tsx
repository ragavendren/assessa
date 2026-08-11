import { EmptyState, PageLoader, SectionHeading } from "@/components/platform";
import { formatDate } from "@/lib/gamification";
import { listNotifications, markNotificationsRead } from "@/lib/platform.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

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

function Notifications() {
  const fetchNotifications = useServerFn(listNotifications);
  const markRead = useServerFn(markNotificationsRead);
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(),
  });

  const mutation = useMutation({
    mutationFn: () => markRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  if (isPending || !data) return <PageLoader />;

  const unread = data.filter((item) => !item.read).length;

  return (
    <div className="mx-auto max-w-2xl">
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

      {data.length === 0 ? (
        <EmptyState icon="🔔" title="No notifications yet" />
      ) : (
        <div className="surface-paper divide-y divide-border">
          {data.map((item) => (
            <div
              key={item.id}
              className={"flex gap-3 p-4 " + (item.read ? "" : "bg-accent/[0.06]")}
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
