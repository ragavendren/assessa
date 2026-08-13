import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout for /admin/blueprints and nested new/edit routes. */
export const Route = createFileRoute("/_authenticated/admin/blueprints")({
  component: () => <Outlet />,
});
