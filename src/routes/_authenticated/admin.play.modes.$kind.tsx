import { AdminNav } from "@/components/AdminNav";
import { AdminAccessDenied, AdminPageHeader } from "@/components/admin/AdminPageUi";
import { ModeEditor, type ChallengeSavePayload } from "@/components/admin/play/PlayControlPanel";
import { PageLoader } from "@/components/platform";
import { getAdminPlay, savePlayChallenge } from "@/lib/play.functions";
import { PLAY_KIND_META, PLAY_KINDS, type PlayKind } from "@/lib/play.math";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/admin/play/modes/$kind")({
  params: {
    parse: (params) => ({
      kind: z.enum(PLAY_KINDS).parse(params.kind),
    }),
  },
  beforeLoad: ({ params }) => {
    if (params.kind === "arena") {
      throw redirect({ to: "/admin/play/live-arena" });
    }
    if (params.kind === "escape") {
      throw redirect({ to: "/admin/play/escape" });
    }
    if (params.kind === "knockout") {
      throw redirect({ to: "/admin/play/knockout" });
    }
  },
  head: ({ params }) => ({
    meta: [{ title: `${PLAY_KIND_META[params.kind as PlayKind].label} — Assessa Admin` }],
  }),
  component: AdminPlayModePage,
});

function AdminPlayModePage() {
  const { kind } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchAdmin = useServerFn(getAdminPlay);
  const saveChallenge = useServerFn(savePlayChallenge);
  const { data, isPending, error } = useQuery({
    queryKey: ["admin-play"],
    queryFn: () => fetchAdmin(),
    retry: false,
  });

  const challengeMut = useMutation({
    mutationFn: (payload: ChallengeSavePayload) => saveChallenge({ data: payload }),
    onSuccess: () => {
      toast.success("Play mode saved");
      void queryClient.invalidateQueries({ queryKey: ["admin-play"] });
      void queryClient.invalidateQueries({ queryKey: ["play-hub"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save"),
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

  const challenge = data.challenges.find((c) => c.kind === kind);
  if (!challenge) {
    return (
      <div>
        <AdminNav />
        <p className="text-sm text-muted-foreground">Mode not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminNav />
      <AdminPageHeader
        title={PLAY_KIND_META[kind].label}
        help={{
          label: "Mode binding",
          body: "Bind this mode to a course or activity and a question pool. Turn the mode on from the Play control cards when participants should see it.",
        }}
      />
      <Link to="/admin/play" className="text-xs text-accent underline">
        Back to Play
      </Link>
      <ModeEditor
        challenge={challenge}
        data={data}
        saving={challengeMut.isPending}
        onSave={(payload) => challengeMut.mutate(payload)}
      />
    </div>
  );
}
