import { createFileRoute, redirect } from "@tanstack/react-router";

/** Progress was merged into Dashboard — keep this route as a redirect. */
export const Route = createFileRoute("/_authenticated/progress")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
