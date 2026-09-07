import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout so /play/pulse and /play/pulse/$pulseId both mount correctly. */
export const Route = createFileRoute("/_authenticated/play/pulse")({
  component: () => <Outlet />,
});
