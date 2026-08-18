import { AdminEmpty, AdminPanel } from "@/components/admin/AdminPageUi";
import { AssessaIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { PlayKind } from "@/lib/play.math";
import { useMemo, useState, type ReactNode } from "react";
import type { AdminPlayChallenge, AdminPlayData, ChallengeSavePayload } from "./PlayControlPanel";

type EventKind = Extract<PlayKind, "arena" | "escape" | "knockout">;

export type EventStepId = "mode" | "activity" | "pool" | "lobby" | "scenes" | "bracket";

type StepDef = { id: EventStepId; label: string; hint: string };

const STEPS: Record<EventKind, StepDef[]> = {
  arena: [
    { id: "mode", label: "Mode", hint: "Name and availability" },
    { id: "activity", label: "Activity", hint: "Hub the lobby appears under" },
    { id: "pool", label: "Pool", hint: "Questions for the quiz" },
    { id: "lobby", label: "Lobby", hint: "Open a live event" },
  ],
  escape: [
    { id: "mode", label: "Mode", hint: "Name and availability" },
    { id: "pool", label: "Pool", hint: "Topics each scene draws from" },
    { id: "scenes", label: "Scenes", hint: "Author the room path" },
  ],
  knockout: [
    { id: "mode", label: "Mode", hint: "Name and availability" },
    { id: "pool", label: "Pool", hint: "Questions for each match" },
    { id: "bracket", label: "Bracket", hint: "Create a tournament" },
  ],
};

export function isEventKind(kind: PlayKind): kind is EventKind {
  return kind === "arena" || kind === "escape" || kind === "knockout";
}

export function PlayEventSetup({
  kind,
  data,
  saving,
  stepContent,
  onCancel,
}: {
  kind: EventKind;
  data: AdminPlayData;
  saving: boolean;
  stepContent: Partial<Record<EventStepId, ReactNode>>;
  onCancel: () => void;
}) {
  const steps = STEPS[kind];
  const unlocked = useMemo(() => unlockMap(kind, data), [data, kind]);
  const firstOpen = Math.max(
    0,
    steps.findIndex((step) => unlocked[step.id]),
  );
  const [index, setIndex] = useState(firstOpen);
  const safeIndex = Math.min(index, steps.length - 1);
  const current = steps[safeIndex] ?? steps[0]!;
  const atLast = safeIndex >= steps.length - 1;
  const canStay = unlocked[current.id] === true;

  return (
    <div className="space-y-5">
      <ol className="flex flex-wrap gap-2">
        {steps.map((step, stepIndex) => {
          const active = step.id === current.id;
          const open = unlocked[step.id] === true;
          return (
            <li key={step.id}>
              <button
                type="button"
                disabled={!open}
                onClick={() => setIndex(stepIndex)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium",
                  active && "bg-primary text-primary-foreground",
                  !active &&
                    open &&
                    "border border-border bg-card text-foreground hover:bg-secondary",
                  !open &&
                    "cursor-not-allowed border border-border text-muted-foreground opacity-60",
                )}
              >
                {stepIndex + 1}. {step.label}
              </button>
            </li>
          );
        })}
      </ol>

      <p className="text-sm text-muted-foreground">{current.hint}</p>

      {!canStay ? (
        <AdminEmpty title={`${current.label} is locked`} body={lockCopy(kind, current.id, data)} />
      ) : (
        (stepContent[current.id] ?? null)
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-3 py-1.5 text-xs"
        >
          Close
        </button>
        <div className="flex items-center gap-2">
          {saving ? <span className="text-xs text-muted-foreground">Saving…</span> : null}
          <button
            type="button"
            disabled={safeIndex === 0}
            onClick={() => setIndex((value) => Math.max(0, value - 1))}
            className="rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="button"
            disabled={atLast || !nextUnlocked(steps, safeIndex, unlocked)}
            onClick={() => setIndex((value) => Math.min(steps.length - 1, value + 1))}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            Continue
            <AssessaIcon name="arrowRight" className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function unlockMap(kind: EventKind, data: AdminPlayData): Record<EventStepId, boolean> {
  const hasPool = data.pools.length > 0;
  const hasActivity = data.activities.length > 0;
  return {
    mode: true,
    activity: true,
    pool: kind === "arena" ? hasActivity : true,
    lobby: hasActivity && hasPool,
    scenes: hasPool,
    // Knockout never needs an activity — players join the open bracket from Play.
    bracket: hasPool,
  };
}

function nextUnlocked(steps: StepDef[], index: number, unlocked: Record<EventStepId, boolean>) {
  const next = steps[index + 1];
  return Boolean(next && unlocked[next.id]);
}

function lockCopy(kind: EventKind, step: EventStepId, data: AdminPlayData) {
  if (step === "pool" && kind === "arena" && data.activities.length === 0) {
    return "Create an activity first. Live Arena sits under an activity in the Play hub.";
  }
  if (step === "lobby" && data.activities.length === 0) {
    return "Create an activity, then come back to open a lobby.";
  }
  if (step === "lobby" && data.pools.length === 0) {
    return "Add a question pool before opening a lobby.";
  }
  if (step === "scenes" && data.pools.length === 0) {
    return "Import a question pool so each scene can pull a topic set.";
  }
  if (step === "bracket" && data.pools.length === 0) {
    return "Add a question pool first. Knockout does not use activities — players join from Play.";
  }
  return "Finish the previous step first.";
}

export function EventPoolStep({
  challenge,
  data,
  saving,
  onSave,
}: {
  challenge: AdminPlayChallenge;
  data: AdminPlayData;
  saving: boolean;
  onSave: (payload: ChallengeSavePayload) => void;
}) {
  const [poolId, setPoolId] = useState(challenge.poolId ?? "");
  const required = challenge.kind === "escape" || challenge.kind === "arena";

  return (
    <AdminPanel
      title="Question pool"
      description={
        challenge.kind === "knockout"
          ? "Knockout matches draw from this pool. Activities are not required — players join the open bracket from Play."
          : challenge.kind === "escape"
            ? "Each scene picks a topic from this pool."
            : "The lobby pulls questions from this pool."
      }
    >
      {data.pools.length === 0 ? (
        <AdminEmpty title="No pools yet" body="Create a pool under Library, then return here." />
      ) : (
        <div className="space-y-3">
          <select
            className="field h-9 w-full text-sm"
            value={poolId}
            onChange={(e) => setPoolId(e.target.value)}
          >
            <option value="">{required ? "Select a pool" : "Default play pool"}</option>
            {data.pools.map((pool) => (
              <option key={pool.id} value={pool.id}>
                {pool.courseName} · {pool.name} ({pool.questionCount})
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={saving || (required && !poolId)}
            onClick={() =>
              onSave({
                ...(challenge.id ? { id: challenge.id } : {}),
                kind: challenge.kind,
                name: challenge.name,
                status: challenge.status,
                courseId: challenge.courseId,
                activityId: challenge.activityId,
                poolId: poolId || null,
                allowedTopics: challenge.allowedTopics,
                rules: {
                  questionCount: challenge.rules.questionCount,
                  durationSeconds: challenge.rules.durationSeconds,
                  perQuestionSeconds: challenge.rules.perQuestionSeconds,
                  lives: challenge.rules.lives,
                  timeBonus: challenge.rules.timeBonus,
                  onePerPeriod: challenge.rules.onePerPeriod,
                  xpPoints: challenge.rules.xpPoints,
                  reward: challenge.rules.reward,
                  perItem: challenge.rules.perItem,
                },
              })
            }
            className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save pool"}
          </button>
        </div>
      )}
    </AdminPanel>
  );
}
