import { PageLoader } from "@/components/platform";
import { supabase } from "@/integrations/supabase/client";
import { getPublicExamBriefing, startGuestAttempt } from "@/lib/guest.functions";
import { MODE_BLURB, MODE_LABELS, formatDate, type ExamMode } from "@/lib/gamification";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/take/$examId")({
  head: ({ params }) => ({
    meta: [
      { title: "Take assessment — Assessa" },
      {
        name: "description",
        content: "Enter your details to start this shared Assessa assessment. No account required.",
      },
      { property: "og:title", content: "Take assessment — Assessa" },
      {
        property: "og:description",
        content: "Shared assessment link. Enter participant details to begin.",
      },
      { name: "robots", content: "noindex,nofollow" },
      { property: "og:url", content: `/take/${params.examId}` },
    ],
  }),
  component: TakeExamPage,
});

function TakeExamPage() {
  const { examId } = Route.useParams();
  const navigate = useNavigate();
  const fetchBriefing = useServerFn(getPublicExamBriefing);
  const start = useServerFn(startGuestAttempt);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [mobile, setMobile] = useState("");
  const [extra, setExtra] = useState<Record<string, string>>({});

  const { data, isPending, error } = useQuery({
    queryKey: ["public-briefing", examId],
    queryFn: () => fetchBriefing({ data: { examId } }),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: () =>
      start({
        data: {
          examId,
          fullName,
          email,
          organization,
          participantId: "",
          mobile,
          extra,
        },
      }),
    onSuccess: async (result) => {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
      });
      if (sessionError) {
        toast.error(sessionError.message);
        return;
      }
      navigate({
        to: "/attempt/$attemptId",
        params: { attemptId: result.attemptId },
      });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not start"),
  });

  if (isPending) return <PageLoader label="Loading assessment…" />;
  if (error || !data) {
    return (
      <GuestShell>
        <div className="surface-paper p-8 text-center">
          <h1 className="font-display text-2xl">Assessment unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "This link is invalid or expired."}
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Go home
          </Link>
        </div>
      </GuestShell>
    );
  }

  const { exam, availability } = data;
  const canStart = availability.ok;

  return (
    <GuestShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <p className="text-hairline text-muted-foreground">{exam.topic}</p>
          <h1 className="mt-1 font-display text-3xl">{exam.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {MODE_LABELS[exam.mode as ExamMode]} · {MODE_BLURB[exam.mode as ExamMode]}
          </p>
        </div>

        {exam.description ? (
          <p className="text-base leading-relaxed text-muted-foreground">{exam.description}</p>
        ) : null}

        <dl className="surface-paper grid grid-cols-2 gap-5 p-5 sm:grid-cols-4">
          {[
            ["Questions", String(exam.questionCount)],
            ["Duration", `${exam.duration} min`],
            ["Pass mark", `${exam.passMark}%`],
            ["Attempts", String(exam.maxAttempts)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-hairline text-muted-foreground">{label}</dt>
              <dd className="mt-1 font-display text-xl">{value}</dd>
            </div>
          ))}
        </dl>

        {!availability.ok ? (
          <div className="surface-paper border border-destructive/30 p-5 text-sm text-destructive">
            {availability.reason}
            {"notOpenYet" in availability && exam.startsAt ? (
              <p className="mt-1 text-muted-foreground">Opens {formatDate(exam.startsAt)}</p>
            ) : null}
            {"closed" in availability && exam.endsAt ? (
              <p className="mt-1 text-muted-foreground">Closed {formatDate(exam.endsAt)}</p>
            ) : null}
          </div>
        ) : null}

        <form
          className="surface-paper space-y-4 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = z
              .object({
                fullName: z.string().trim().min(2),
                email: z.string().trim().email(),
              })
              .safeParse({ fullName, email });
            if (!parsed.success) {
              toast.error(parsed.error.issues[0]?.message ?? "Check your details");
              return;
            }
            for (const field of exam.extraFields) {
              if (field.required && !String(extra[field.key] ?? "").trim()) {
                toast.error(`${field.label} is required`);
                return;
              }
            }
            mutation.mutate();
          }}
        >
          <h2 className="text-hairline text-muted-foreground">Participant details</h2>
          <p className="text-sm text-muted-foreground">
            No account needed. Enter your details to begin — your progress is scored on the server.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name *">
              <input
                className="field"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                maxLength={100}
              />
            </Field>
            <Field label="Email *">
              <input
                className="field"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={255}
              />
            </Field>
            <Field label="Organisation">
              <input
                className="field"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                maxLength={120}
              />
            </Field>
            <Field label="Mobile">
              <input
                className="field"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                maxLength={40}
              />
            </Field>
          </div>

          {exam.extraFields.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {exam.extraFields.map((field) => (
                <Field key={field.key} label={`${field.label}${field.required ? " *" : ""}`}>
                  <input
                    className="field"
                    maxLength={120}
                    value={extra[field.key] ?? ""}
                    onChange={(e) =>
                      setExtra((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    required={!!field.required}
                  />
                </Field>
              ))}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!canStart || mutation.isPending}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {mutation.isPending ? "Starting…" : "Start assessment"}
          </button>
        </form>
      </div>
    </GuestShell>
  );
}

function GuestShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex h-14 max-w-3xl items-center px-4">
        <Link to="/" className="font-display text-lg">
          Assessa
        </Link>
      </header>
      <main className="px-4 pb-16">{children}</main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
