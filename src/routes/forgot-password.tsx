import { supabase } from "@/integrations/supabase/client";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — Assessa" },
      {
        name: "description",
        content: "Request a password reset link for your Assessa participant account.",
      },
      { property: "og:title", content: "Reset your password — Assessa" },
      {
        property: "og:description",
        content: "Request a secure password reset link for Assessa.",
      },
    ],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = z.string().trim().email().max(255).safeParse(email);
    if (!parsed.success) {
      toast.error("Enter a valid email address");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: window.location.origin + "/reset-password",
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="surface-paper w-full max-w-sm p-7">
        <h1 className="font-display text-2xl">Reset password</h1>
        {sent ? (
          <p className="mt-3 text-sm text-muted-foreground">
            If an account exists for {email}, a reset link is on its way.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <label className="block">
              <span className="text-hairline text-muted-foreground">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={255}
                className="field mt-1.5"
                placeholder="you@example.com"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
        <Link
          to="/auth"
          className="mt-5 block text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
