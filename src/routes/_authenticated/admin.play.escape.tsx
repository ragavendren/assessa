import { AdminNav } from "@/components/AdminNav";
import { AdminAccessDenied } from "@/components/admin/AdminPageUi";
import { AdminEscapeList } from "@/components/admin/play/AdminPlayEventList";
import { PageLoader } from "@/components/platform";
import { getAdminPlay } from "@/lib/play.functions";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/admin/play/escape")({
  head: () => ({
    meta: [{ title: "Escape scenarios — Assessa Admin" }],
  }),
  component: AdminEscapeListPage,
});

function AdminEscapeListPage() {
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
      <AdminEscapeList data={data} />
    </div>
  );
}
