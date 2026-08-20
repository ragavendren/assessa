import { AdminEmpty, AdminPanel } from "@/components/admin/AdminPageUi";
import { AssessaIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { PlayKind } from "@/lib/play.math";
import { useMemo, useState, type ReactNode } from "react";
import type { AdminPlayChallenge, AdminPlayData, ChallengeSavePayload } from "./PlayControlPanel";

type EventKind = Extract<PlayKind, "arena" | "escape" | "knockout">;

export type EventStepId = "mode" | "activity" | "pool" | "lobby" | "scenes" | "bracket";

type StepDef = { id: EventStepId; label: string; hint: string };

/** Event modes: pool is chosen on the lobby/scenario/bracket form — no separate Mode/Pool wizard. */
const STEPS: Record<EventKind, StepDef[]> = {
  arena: [
    {
      id: "lobby",
      label: "Lobby",
      hint: "Pick a pool and open a live event. Players join from Play.",
    },
  ],
  escape: [
    {
      id: "scenes",
      label: "Scenes",
      hint: "Author rooms with a pool on each scenario. Players browse /play/escape.",
    },
  ],
  knockout: [
    {
      id: "bracket",
      label: "Bracket",
      hint: "Create a tournament with its pool. Players browse /play/knockout.",
    },
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
  const single = steps.length === 1;
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
      {!single ? (
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
      ) : null}

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
        {!single ? (
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
        ) : saving ? (
          <span className="text-xs text-muted-foreground">Saving…</span>
        ) : null}
      </div>
    </div>
  );
}

function unlockMap(_kind: EventKind, data: AdminPlayData): Record<EventStepId, boolean> {
  const hasPool = data.pools.length > 0;
  return {
    mode: true,
    activity: true,
    pool: true,
    lobby: hasPool,
    scenes: hasPool,
    bracket: hasPool,
  };
}

function nextUnlocked(steps: StepDef[], index: number, unlocked: Record<EventStepId, boolean>) {
  const next = steps[index + 1];
  return Boolean(next && unlocked[next.id]);
}

function lockCopy(_kind: EventKind, step: EventStepId, data: AdminPlayData) {
  if (step === "lobby" && data.pools.length === 0) {
    return "Add a question pool before opening a lobby. Players join from Play — no activity is required.";
  }
  if (step === "scenes" && data.pools.length === 0) {
    return "Import a question pool so each scene can pull a topic set.";
  }
  if (step === "bracket" && data.pools.length === 0) {
    return "Add a question pool first. Knockout does not use activities — players join from Play.";
  }
  return "Finish the previous step first.";
}

/** @deprecated Pool is selected on the lobby/scenario form; kept for non-event editors. */
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
      description="Optional default pool for this mode. Event lobbies pick their own pool when created."
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
                rules: challenge.rules,
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
