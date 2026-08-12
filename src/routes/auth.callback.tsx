import { PageLoader } from "@/components/platform";
import { supabase } from "@/integrations/supabase/client";
import { clearPendingOrgSignup, readPendingOrgSignup } from "@/lib/pending-org-signup";
import { saveProfile } from "@/lib/platform.functions";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";

const searchSchema = z.object({
  code: z.string().optional(),
  next: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export const Route = createFileRoute("/auth/callback")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Signing in — Assessa" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const save = useServerFn(saveProfile);
  const [message, setMessage] = useState("Completing sign-in…");

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      if (search.error) {
        setMessage(search.error_description || search.error || "Sign-in failed");
        return;
      }

      try {
        if (search.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(search.code);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          if (!data.session) throw new Error("No session returned from the identity provider.");
        }

        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Signed in, but no user was returned.");

        const pending = readPendingOrgSignup();
        if (pending) {
          const meta = (userData.user.user_metadata ?? {}) as Record<string, unknown>;
          const fullName = String(
            meta.full_name ?? meta.name ?? userData.user.email?.split("@")[0] ?? "Participant",
          );

          await supabase.auth.updateUser({
            data: {
              organization: pending.organization,
              department: pending.department,
              team_group: pending.department,
            },
          });

          await save({
            data: {
              full_name: fullName.trim().length >= 2 ? fullName.trim() : "Participant",
              mobile: typeof meta.mobile === "string" ? meta.mobile : "",
              participant_id: typeof meta.participant_id === "string" ? meta.participant_id : "",
              organization: pending.organization,
              department: pending.department,
              display_name: typeof meta.display_name === "string" ? meta.display_name : "",
              team_group: pending.department,
              leaderboard_opt_out: false,
              avatar_id: null,
            },
          });
          clearPendingOrgSignup();
        }

        const next =
          search.next?.startsWith("/") && !search.next.startsWith("//")
            ? search.next
            : "/dashboard";

        if (!cancelled) {
          navigate({ to: next, replace: true });
        }
      } catch (error) {
        clearPendingOrgSignup();
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Sign-in failed");
        }
      }
    }

    void finish();
    return () => {
      cancelled = true;
    };
  }, [navigate, save, search.code, search.error, search.error_description, search.next]);

  if (message !== "Completing sign-in…") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="surface-paper max-w-md p-8 text-center">
          <h1 className="font-display text-2xl">Sign-in issue</h1>
          <p className="mt-3 text-sm text-muted-foreground">{message}</p>
          <a
            href="/auth"
            className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return <PageLoader label="Completing sign-in…" />;
}
