import { AdminNav } from "@/components/AdminNav";
import { AdminAccessDenied } from "@/components/admin/AdminPageUi";
import { AdminPulseList } from "@/components/admin/play/AdminPlayEventList";
import { PageLoader } from "@/components/platform";
import { getAdminPlay } from "@/lib/play.functions";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/admin/play/pulse")({
  head: () => ({
    meta: [{ title: "Pulse sessions — Assessa Admin" }],
  }),
  component: AdminPulseListPage,
});

function AdminPulseListPage() {
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
    const message =
      error instanceof Error
        ? error.message
        : error &&
            typeof error === "object" &&
            "message" in error &&
            typeof (error as { message: unknown }).message === "string"
          ? (error as { message: string }).message
          : "Admin only.";
    if (/administrator access required/i.test(message)) {
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
        <div className="surface-paper p-8 text-center">
          <p className="font-display text-xl">Pulse list could not load</p>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AdminNav />
      <AdminPulseList data={data} />
    </div>
  );
}
