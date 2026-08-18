import { AdminNav } from "@/components/AdminNav";
import { AdminAccessDenied, AdminPageHeader } from "@/components/admin/AdminPageUi";
import { EngagementNav } from "@/components/admin/EngagementNav";
import { PlayControlPanel } from "@/components/admin/play/PlayControlPanel";
import { PageLoader } from "@/components/platform";
import { getAdminPlay } from "@/lib/play.functions";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/admin/play")({
  head: () => ({
    meta: [
      { title: "Play control — Assessa Admin" },
      {
        name: "description",
        content:
          "Enable play modes, bind them to courses and topics, and configure timers, XP, escape rooms and tournaments.",
      },
    ],
  }),
  component: AdminPlayPage,
});

function AdminPlayPage() {
  const fetchAdmin = useServerFn(getAdminPlay);
  const { data, isPending, error } = useQuery({
    queryKey: ["admin-play"],
    queryFn: () => fetchAdmin(),
    retry: false,
  });

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
        <p className="mt-2 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Admin only."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminNav />
      <EngagementNav />
      <AdminPageHeader
        eyebrow="Engagement"
        title="Play control"
        summary="Turn modes on or off, bind each one to a course or an activity, pick the pool and topics it can draw, and set timers, lives, XP and rewards. Escape rooms, Live Arena, and knockout brackets are hosted here."
        help={{
          label: "How play sourcing works",
          body: "Play never clones exam questions. Each live mode pulls from the pool (and optional topic allow-list) you bind here. Assessments on Assessments are unchanged.",
        }}
      />
      <PlayControlPanel data={data} />
    </div>
  );
}
