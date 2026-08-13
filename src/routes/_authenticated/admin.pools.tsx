import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout for /admin/pools and nested pool detail routes. */
export const Route = createFileRoute("/_authenticated/admin/pools")({
  component: () => <Outlet />,
});
