import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy edit URL — editor lives on the blueprints index. */
export const Route = createFileRoute("/_authenticated/admin/blueprints/$blueprintId")({
  beforeLoad: ({ params }) => {
    if (params.blueprintId === "new") {
      throw redirect({
        to: "/admin/blueprints",
        search: { create: true },
      });
    }
    throw redirect({
      to: "/admin/blueprints",
      search: { blueprintId: params.blueprintId },
    });
  },
  component: () => null,
});
