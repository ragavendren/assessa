import { AdminNav } from "@/components/AdminNav";
import { AdminAccessDenied, AdminPageHeader } from "@/components/admin/AdminPageUi";
import { PlayControlPanel } from "@/components/admin/play/PlayControlPanel";
import { PageLoader } from "@/components/platform";
import { getAdminPlay } from "@/lib/play.functions";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/admin/play/")({
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
  component: AdminPlayIndexPage,
});

function AdminPlayIndexPage() {
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
        <PageLoader />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div>
        <AdminNav />
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
      <AdminPageHeader
        title="Play"
        help={{
          label: "Play vs assessments",
          body: "Play pulls from course pools you bind here. Formal papers live under Assessments and are never cloned into Play.",
        }}
      />
      <PlayControlPanel data={data} />
    </div>
  );
}
