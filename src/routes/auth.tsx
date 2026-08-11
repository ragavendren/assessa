import { BrandMark } from "@/components/BrandMark";
import { supabase } from "@/integrations/supabase/client";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — Assessa" },
      {
        name: "description",
        content:
          "Sign in or create your Assessa account to take assessments, track progress and earn achievements.",
      },
      { property: "og:title", content: "Sign in — Assessa" },
      {
        property: "og:description",
        content: "One account for every assessment, with progress, badges and analytics.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AuthPage,
});

const credentials = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

function safeInternalPath(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const destination = safeInternalPath(search.redirect);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active || !data.session) return;
      navigate({ to: destination, replace: true });
    });
    return () => {
      active = false;
    };
  }, [destination, navigate]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = credentials.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your details");
      return;
    }
    if (mode === "signup" && fullName.trim().length < 2) {
      toast.error("Enter your full name");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName.trim() },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setCheckEmail(true);
          return;
        }
        navigate({ to: destination, replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) throw error;
        navigate({ to: destination, replace: true });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination)}`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) {
        const message = error.message || "";
        toast.error(
          /provider is not enabled|unsupported provider/i.test(message)
            ? "Google sign-in is not enabled yet. Ask an admin to enable Google under Supabase → Authentication → Providers."
            : message || "Google sign-in failed. Please try again.",
        );
        setBusy(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google sign-in failed");
      setBusy(false);
    }
  }

  if (checkEmail) {
    return (
      <AuthLayout>
        <div className="surface-paper p-8 text-center">
          <span className="font-display text-2xl text-primary">Assessa</span>
          <h1 className="mt-3 font-display text-2xl">Confirm your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your
            account, then sign in.
          </p>
          <button
            onClick={() => {
              setCheckEmail(false);
              setMode("signin");
            }}
            className="mt-6 w-full rounded-md border border-input bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
          >
            Back to sign in
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="surface-paper p-7">
        <div className="flex rounded-md bg-secondary p-1 text-sm">
          {(["signup", "signin"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setMode(value)}
              className={
                "flex-1 rounded-[6px] px-3 py-2 font-medium transition-colors " +
                (mode === value ? "bg-card shadow-sm" : "text-muted-foreground")
              }
            >
              {value === "signup" ? "Create account" : "Sign in"}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {mode === "signup" ? (
            <Field label="Full name">
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                maxLength={100}
                autoComplete="name"
                className="field"
                placeholder="Ada Lovelace"
              />
            </Field>
          ) : null}
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={255}
              autoComplete="email"
              className="field"
              placeholder="you@example.com"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              maxLength={72}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className="field"
              placeholder="At least 8 characters"
            />
          </Field>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={onGoogle}
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2.5 rounded-md border border-input bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-60"
        >
          <GoogleMark />
          {busy ? "Redirecting…" : "Continue with Google"}
        </button>

        {mode === "signin" ? (
          <Link
            to="/forgot-password"
            className="mt-4 block text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Forgot your password?
          </Link>
        ) : null}
      </div>
    </AuthLayout>
  );
}

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground md:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 top-20 h-64 w-64 rounded-full bg-accent/25 blur-3xl"
        />
        <Link to="/" className="relative z-10 inline-flex">
          <BrandMark
            wordmarkClassName="text-primary-foreground"
            markClassName="ring-1 ring-primary-foreground/15"
          />
        </Link>
        <div className="relative z-10">
          <h2 className="font-display text-4xl leading-tight">
            One profile.
            <br />
            Every assessment.
          </h2>
          <p className="mt-4 max-w-sm text-sm text-primary-foreground/70">
            Your results, topic mastery, XP, badges and streaks travel with you across every exam on
            the platform.
          </p>
        </div>
        <p className="relative z-10 text-xs text-primary-foreground/50">
          Server-scored assessments · Verified results
        </p>
      </div>
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-6 inline-flex md:hidden">
            <BrandMark />
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-hairline text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
