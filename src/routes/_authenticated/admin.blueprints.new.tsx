import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy create URL — create opens in a modal on the blueprints index. */
export const Route = createFileRoute("/_authenticated/admin/blueprints/new")({
  beforeLoad: () => {
    throw redirect({
      to: "/admin/blueprints",
      search: { create: true },
    });
  },
  component: () => null,
});
