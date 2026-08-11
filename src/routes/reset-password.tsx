import { supabase } from "@/integrations/supabase/client";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — Assessa" },
      {
        name: "description",
        content: "Set a new password for your Assessa participant account.",
      },
      { property: "og:title", content: "Choose a new password — Assessa" },
      { property: "og:description", content: "Set a new password for your Assessa account." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={onSubmit} className="surface-paper w-full max-w-sm p-7">
        <h1 className="font-display text-2xl">New password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a password you haven't used before.
        </p>
        <label className="mt-5 block">
          <span className="text-hairline text-muted-foreground">New password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            maxLength={72}
            autoComplete="new-password"
            className="field mt-1.5"
          />
        </label>
        <label className="mt-4 block">
          <span className="text-hairline text-muted-foreground">Confirm password</span>
          <input
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            maxLength={72}
            autoComplete="new-password"
            className="field mt-1.5"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
