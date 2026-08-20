import { AdminNav } from "@/components/AdminNav";
import { AdminAccessDenied } from "@/components/admin/AdminPageUi";
import { AdminArenaList } from "@/components/admin/play/AdminPlayEventList";
import { PageLoader } from "@/components/platform";
import { getAdminPlay } from "@/lib/play.functions";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/admin/play/live-arena")({
  head: () => ({
    meta: [{ title: "Live Arena lobbies — Assessa Admin" }],
  }),
  component: AdminLiveArenaListPage,
});

function AdminLiveArenaListPage() {
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
      </div>
    );
  }

  return (
    <div>
      <AdminNav />
      <AdminArenaList data={data} />
    </div>
  );
}
