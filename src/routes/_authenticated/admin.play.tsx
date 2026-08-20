import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout for /admin/play and nested list/configure routes. */
export const Route = createFileRoute("/_authenticated/admin/play")({
  component: () => <Outlet />,
});
