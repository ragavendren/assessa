import { PageLoader } from "@/components/platform";
import { MODE_BLURB, MODE_LABELS, formatDate, type ExamMode } from "@/lib/gamification";
import { beginAttempt, getExamBriefing } from "@/lib/platform.functions";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/exams/$examId")({
  head: () => ({
    meta: [
      { title: "Assessment briefing — Assessa" },
      {
        name: "description",
        content:
          "Review the rules, duration, pass mark and attempts before starting this assessment.",
      },
      { property: "og:title", content: "Assessment briefing — Assessa" },
      {
        property: "og:description",
        content: "Confirm your details and start your assessment.",
      },
    ],
  }),
  component: Briefing,
});

function Briefing() {
  const { examId } = Route.useParams();
  const navigate = useNavigate();
  const fetchBriefing = useServerFn(getExamBriefing);
  const start = useServerFn(beginAttempt);
  const [extra, setExtra] = useState<Record<string, string>>({});

  const { data, isPending, error } = useQuery({
    queryKey: ["briefing", examId],
    queryFn: () => fetchBriefing({ data: { examId } }),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: () => start({ data: { examId, extra } }),
    onSuccess: (result) => {
      navigate({ to: "/attempt/$attemptId", params: { attemptId: result.attemptId } });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not start"),
  });

  if (isPending) return <PageLoader />;
  if (error || !data) {
    return (
      <div className="surface-paper p-8 text-center">
        <p className="font-display text-xl">This assessment isn't available to you</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Check your invitations and try again."}
        </p>
        <Link
          to="/exams"
          className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Back to my exams
        </Link>
      </div>
    );
  }

  const { exam, profile } = data;
  const canStart = !data.notOpenYet && (data.attemptsLeft > 0 || data.openAttemptId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-hairline text-muted-foreground">{exam.topic}</p>
        <h1 className="mt-1 font-display text-3xl">{exam.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {MODE_LABELS[exam.mode as ExamMode]} · {MODE_BLURB[exam.mode as ExamMode]}
        </p>
        <button
          onClick={async () => {
            const url = `${window.location.origin}/take/${examId}`;
            try {
              await navigator.clipboard.writeText(url);
              toast.success("Share link copied (no login required)");
            } catch {
              toast.error(url);
            }
          }}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          Share link
        </button>
      </div>

      {exam.description ? (
        <p className="text-base leading-relaxed text-muted-foreground">{exam.description}</p>
      ) : null}

      <dl className="surface-paper grid grid-cols-2 gap-5 p-5 sm:grid-cols-4">
        {[
          ["Questions", String(exam.questionCount)],
          ["Duration", `${exam.duration} min`],
          ["Pass mark", `${exam.passMark}%`],
          ["Attempts left", `${data.attemptsLeft} of ${exam.maxAttempts}`],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-hairline text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-display text-xl">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="surface-paper p-5">
        <h2 className="text-hairline text-muted-foreground">Your details</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Detail label="Name" value={profile.full_name} />
          <Detail label="Email" value={profile.email} />
          <Detail label="Participant ID" value={profile.participant_id} />
          <Detail label="Organisation" value={profile.organization} />
        </div>
        <Link
          to="/profile"
          className="mt-4 inline-block text-sm text-accent underline-offset-4 hover:underline"
        >
          Update my profile
        </Link>
      </section>

      {exam.extraFields.length > 0 ? (
        <section className="surface-paper p-5">
          <h2 className="text-hairline text-muted-foreground">Required for this assessment</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {exam.extraFields.map((field) => (
              <label key={field.key} className="block">
                <span className="text-sm">
                  {field.label}
                  {field.required ? <span className="text-destructive"> *</span> : null}
                </span>
                <input
                  className="field mt-1.5"
                  maxLength={120}
                  value={extra[field.key] ?? ""}
                  onChange={(event) =>
                    setExtra((prev) => ({ ...prev, [field.key]: event.target.value }))
                  }
                />
              </label>
            ))}
          </div>
        </section>
      ) : null}

      <section className="surface-paper p-5">
        <h2 className="text-hairline text-muted-foreground">Rules</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>· The timer starts the moment you begin and cannot be paused.</li>
          <li>· Scoring happens on the server — answers are locked once submitted.</li>
          <li>· Leaving the page keeps the attempt running; return to resume.</li>
          {exam.enableXp ? <li>· XP is awarded for completing and passing.</li> : null}
          {exam.enableBadges ? <li>· Badges may unlock based on your performance.</li> : null}
          {exam.enableLeaderboard ? <li>· Your score may appear on leaderboards.</li> : null}
        </ul>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => mutation.mutate()}
          disabled={!canStart || mutation.isPending}
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {mutation.isPending
            ? "Preparing…"
            : data.openAttemptId
              ? "Resume attempt"
              : "Start assessment"}
        </button>
        {data.notOpenYet ? (
          <span className="text-sm text-muted-foreground">
            Opens {formatDate(exam.startsAt)}
          </span>
        ) : null}
        {!data.notOpenYet && data.attemptsLeft <= 0 && !data.openAttemptId ? (
          <span className="text-sm text-muted-foreground">No attempts remaining</span>
        ) : null}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value || "—"}</p>
    </div>
  );
}
