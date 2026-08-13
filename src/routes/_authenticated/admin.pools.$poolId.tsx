import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy deep link — import lives on the pools index. */
export const Route = createFileRoute("/_authenticated/admin/pools/$poolId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/admin/pools",
      search: { poolId: params.poolId },
    });
  },
  component: () => null,
});
