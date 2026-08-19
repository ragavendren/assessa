import { AdminEmpty, AdminPanel, ResultCount, StatusPill } from "@/components/admin/AdminPageUi";
import { EventPoolStep, PlayEventSetup, isEventKind } from "@/components/admin/play/PlayEventSetup";
import { AssessaIcon } from "@/components/icons";
import { ArenaShareCard } from "@/components/play/ArenaShareCard";
import { StatTile } from "@/components/platform";
import { SlideOver } from "@/components/ui/slide-over";
import {
  createLiveArena,
  createPlayTournament,
  deleteLiveArena,
  deletePlayActivity,
  saveEscapeScenario,
  savePlayActivity,
  savePlayChallenge,
  setEscapeStatus,
  setPlayKindStatus,
  setPlayMenu,
  startPlayTournament,
} from "@/lib/play.functions";
import { PLAY_KIND_GROUPS, PLAY_KIND_META, type PlayKind, type PlayRules } from "@/lib/play.math";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export type AdminPlayChallenge = {
  id: string;
  kind: PlayKind;
  name: string;
  courseId: string | null;
  activityId: string | null;
  poolId: string | null;
  topic: string | null;
  status: "active" | "inactive";
  rules: PlayRules;
  allowedTopics: string[] | null;
  segmentCount: number | null;
  questionsPerSegment: number | null;
  correctMarks: number | null;
  wrongMarks: number | null;
  sessions7d: number;
};

export type AdminPlayPool = {
  id: string;
  name: string;
  courseId: string;
  courseName: string;
  topics: Array<{ label: string; count: number }>;
  questionCount: number;
};

export type AdminPlayData = {
  menuEnabled: boolean;
  challenges: AdminPlayChallenge[];
  courses: Array<{ id: string; name: string }>;
  activities: Array<{ id: string; name: string; status: string }>;
  pools: AdminPlayPool[];
  scenarios: Array<{
    id: string;
    name: string;
    intro: string;
    pool_id: string | null;
    course_id: string | null;
    status: string;
    scenes: Array<{
      id: string;
      title: string;
      body: string;
      topic: string;
      question_count: number;
    }>;
  }>;
  tournaments: Array<{
    id: string;
    name: string;
    size: number;
    status: string;
    pool_id: string | null;
  }>;
  arenas: Array<{
    id: string;
    name: string;
    activity_id: string | null;
    status: string;
    segment_count: number;
    questions_per_segment: number;
    created_at: string;
  }>;
};

export type ChallengeSavePayload = {
  id?: string;
  kind: PlayKind;
  name: string;
  status: "active" | "inactive";
  courseId: string | null;
  activityId: string | null;
  poolId: string | null;
  allowedTopics: string[] | null;
  rules: {
    questionCount: number;
    durationSeconds: number | null;
    perQuestionSeconds: number | null;
    lives: number | null;
    timeBonus: boolean;
    onePerPeriod: boolean;
    xpPoints: number;
    reward: boolean;
    perItem: boolean;
    segmentCount?: number;
    questionsPerSegment?: number;
    correctMarks?: number;
    wrongMarks?: number;
  };
};

type ChallengeForm = {
  name: string;
  status: "active" | "inactive";
  courseId: string;
  activityId: string;
  poolId: string;
  allTopics: boolean;
  allowedTopics: string[];
  questionCount: number;
  durationMinutes: number;
  perQuestionSeconds: number;
  lives: number;
  timeBonus: boolean;
  onePerPeriod: boolean;
  xpPoints: number;
  reward: boolean;
  perItem: boolean;
  segmentCount: number;
  questionsPerSegment: number;
  correctMarks: number;
  wrongMarks: number;
};

type SceneDraft = { title: string; body: string; topic: string; questionCount: number };

export function PlayControlPanel({ data }: { data: AdminPlayData }) {
  const queryClient = useQueryClient();
  const [editingKind, setEditingKind] = useState<PlayKind | null>(null);
  const saveChallenge = useServerFn(savePlayChallenge);
  const setKindStatus = useServerFn(setPlayKindStatus);
  const setMenu = useServerFn(setPlayMenu);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-play"] });
    void queryClient.invalidateQueries({ queryKey: ["play-flags"] });
    void queryClient.invalidateQueries({ queryKey: ["play-hub"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const challengeMut = useMutation({
    mutationFn: saveChallenge,
    onSuccess: () => {
      toast.success("Play mode saved");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save"),
  });
  const statusMut = useMutation({
    mutationFn: ({ kind, status }: { kind: PlayKind; status: "active" | "inactive" }) =>
      setKindStatus({ data: { kind, status } }),
    onSuccess: () => {
      toast.success("Availability updated");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update"),
  });
  const menuMut = useMutation({
    mutationFn: (menuEnabled: boolean) => setMenu({ data: { menuEnabled } }),
    onSuccess: (result) => {
      toast.success(result.menuEnabled ? "Play menu is on" : "Play menu is off");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update"),
  });

  const liveCount = data.challenges.filter((c) => c.status === "active").length;
  const sessions7d = data.challenges.reduce((sum, c) => sum + c.sessions7d, 0);
  const editing = data.challenges.find((c) => c.kind === editingKind) ?? null;

  return (
    <div className="space-y-5">
      <AdminPanel
        title="Play menu"
        description="Turn the entire Play item off in the participant nav. Individual modes below stay configured so you can bring Play back without redoing bindings."
        action={
          <StatusPill tone={data.menuEnabled ? "live" : "draft"}>
            {data.menuEnabled ? "Menu on" : "Menu off"}
          </StatusPill>
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {data.menuEnabled
              ? "Participants see Play and any modes you have turned on."
              : "Play is hidden from the nav. Dashboard shortcuts and new sessions are blocked."}
          </p>
          <button
            type="button"
            disabled={menuMut.isPending}
            onClick={() => menuMut.mutate(!data.menuEnabled)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium",
              data.menuEnabled ? "border border-border" : "bg-primary text-primary-foreground",
            )}
          >
            {menuMut.isPending
              ? "Updating…"
              : data.menuEnabled
                ? "Turn Play menu off"
                : "Turn Play menu on"}
          </button>
        </div>
      </AdminPanel>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Live modes"
          value={liveCount}
          hint={`${data.challenges.length} configured`}
        />
        <StatTile
          label="Question pools"
          value={data.pools.length}
          hint={`${data.courses.length} courses · ${data.activities.length} activities`}
        />
        <StatTile label="Plays (7 days)" value={sessions7d} />
        <StatTile
          label="Events"
          value={data.tournaments.length + data.arenas.length}
          hint={`${data.scenarios.filter((s) => s.status === "active").length} escape rooms live`}
        />
      </div>

      <ModesPanel
        data={data}
        onEdit={setEditingKind}
        onToggle={(kind, status) => statusMut.mutate({ kind, status })}
      />

      <SlideOver
        open={editingKind != null}
        onClose={() => setEditingKind(null)}
        title={editingKind ? `Configure · ${PLAY_KIND_META[editingKind].label}` : "Configure"}
        description={
          editingKind === "escape"
            ? "Work through mode, pool, then scenes. A pool is required before you can author rooms."
            : editingKind === "arena"
              ? "Bind a pool, then open a lobby. Players join from Play — no activity is required."
              : editingKind === "knockout"
                ? "Bind a pool, then create a bracket. Knockout does not use activities — players join from Play."
                : "Course and activity control where it appears. Pool and topics control the bank."
        }
        size="xl"
      >
        {editing && isEventKind(editing.kind) ? (
          <PlayEventSetup
            key={editing.kind}
            kind={editing.kind}
            data={data}
            saving={challengeMut.isPending}
            onCancel={() => setEditingKind(null)}
            stepContent={{
              mode: (
                <ModeEditor
                  key={`${editing.kind}-mode`}
                  challenge={editing}
                  data={data}
                  saving={challengeMut.isPending}
                  scope="basics"
                  onCancel={() => setEditingKind(null)}
                  onSave={(payload) => challengeMut.mutate({ data: payload })}
                />
              ),
              activity: <TournamentPanel data={data} show={{ activities: true }} />,
              pool: (
                <EventPoolStep
                  challenge={editing}
                  data={data}
                  saving={challengeMut.isPending}
                  onSave={(payload) => challengeMut.mutate({ data: payload })}
                />
              ),
              lobby: (
                <TournamentPanel
                  data={data}
                  show={{ arena: true }}
                  defaultPoolId={editing.poolId}
                />
              ),
              scenes: <EscapePanel data={data} defaultPoolId={editing.poolId} />,
              bracket: (
                <TournamentPanel
                  data={data}
                  show={{ knockout: true }}
                  defaultPoolId={editing.poolId}
                />
              ),
            }}
          />
        ) : editing ? (
          <ModeEditor
            key={editing.kind}
            challenge={editing}
            data={data}
            saving={challengeMut.isPending}
            onCancel={() => setEditingKind(null)}
            onSave={(payload) => challengeMut.mutate({ data: payload })}
          />
        ) : null}
      </SlideOver>
    </div>
  );
}

function ModesPanel({
  data,
  onEdit,
  onToggle,
}: {
  data: AdminPlayData;
  onEdit: (kind: PlayKind) => void;
  onToggle: (kind: PlayKind, status: "active" | "inactive") => void;
}) {
  return (
    <div className="space-y-5">
      {PLAY_KIND_GROUPS.map((group) => (
        <AdminPanel
          key={group.label}
          title={group.label}
          description={
            group.label === "Events"
              ? "Configure in order. Live Arena needs a pool, then a lobby — players join from Play. Escape needs a pool, then scenes. Knockout needs a pool only."
              : "Turn a mode on for participants, then bind it to a course, an activity, a pool, and a topic mix."
          }
          action={
            <ResultCount shown={group.kinds.length} total={group.kinds.length} noun="modes" />
          }
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.kinds.map((kind) => {
              const row = data.challenges.find((c) => c.kind === kind);
              if (!row) return null;
              const source = sourceLabel(row, data);
              return (
                <article key={kind} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{PLAY_KIND_META[kind].label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {PLAY_KIND_META[kind].blurb}
                      </p>
                    </div>
                    <StatusPill tone={row.status === "active" ? "live" : "draft"}>
                      {row.status === "active" ? "On" : "Off"}
                    </StatusPill>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">{source}</p>
                  <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                    {row.rules.questionCount} Q
                    {row.rules.durationSeconds
                      ? ` · ${Math.round(row.rules.durationSeconds / 60)} min`
                      : " · no timer"}
                    {row.rules.lives != null ? ` · ${row.rules.lives} lives` : ""}
                    {` · +${row.rules.xpPoints} XP`}
                    {` · ${row.sessions7d} plays`}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onToggle(kind, row.status === "active" ? "inactive" : "active")
                      }
                      className="rounded-md border border-border px-2.5 py-1 text-xs"
                    >
                      {row.status === "active" ? "Turn off" : "Turn on"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(kind)}
                      className="inline-flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-xs"
                    >
                      <AssessaIcon name="pencil" className="h-3 w-3" />
                      Configure
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </AdminPanel>
      ))}
    </div>
  );
}

function ModeEditor({
  challenge,
  data,
  saving,
  onCancel,
  onSave,
  scope = "full",
}: {
  challenge: AdminPlayChallenge;
  data: AdminPlayData;
  saving: boolean;
  onCancel: () => void;
  onSave: (payload: ChallengeSavePayload) => void;
  scope?: "full" | "basics";
}) {
  const [form, setForm] = useState<ChallengeForm>(() => formFromChallenge(challenge));
  const topicOptions = useMemo(
    () => topicsForSource(data.pools, form.courseId || null, form.poolId || null),
    [data.pools, form.courseId, form.poolId],
  );
  const pools = form.courseId ? data.pools.filter((p) => p.courseId === form.courseId) : data.pools;

  function patch(next: Partial<ChallengeForm>) {
    setForm((prev) => ({ ...prev, ...next }));
  }

  const basics = scope === "basics";
  const showActivity =
    !basics &&
    challenge.kind !== "knockout" &&
    challenge.kind !== "escape" &&
    challenge.kind !== "arena";
  const showCourse = !basics;
  const showPool = !basics && challenge.kind !== "arena";
  const showArenaRules = !basics && challenge.kind === "arena";
  const showTopics = !basics && challenge.kind !== "knockout" && challenge.kind !== "escape";

  return (
    <AdminPanel
      title={basics ? "Mode" : `Configure · ${PLAY_KIND_META[challenge.kind].label}`}
      description={
        basics
          ? "Turn the mode on when you are ready for participants to see it."
          : challenge.kind === "flash"
            ? "Participants pick a course, then a topic, then start the deck. Bind a course (or leave Any) and optionally limit topics."
            : "Participants only see this mode when it is On. Course and Activity control which Play hub segment it appears under; pool and topics control the bank."
      }
      action={
        <div className="flex gap-2">
          {basics ? null : (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-border px-3 py-1.5 text-xs"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              onSave({
                ...(challenge.id ? { id: challenge.id } : {}),
                kind: challenge.kind,
                name: form.name,
                status: form.status,
                courseId: form.courseId || null,
                activityId: form.activityId || null,
                poolId: form.poolId || null,
                allowedTopics: form.allTopics ? null : form.allowedTopics,
                rules: {
                  questionCount:
                    challenge.kind === "arena"
                      ? form.segmentCount * form.questionsPerSegment
                      : form.questionCount,
                  durationSeconds: form.durationMinutes > 0 ? form.durationMinutes * 60 : null,
                  perQuestionSeconds: form.perQuestionSeconds > 0 ? form.perQuestionSeconds : null,
                  lives: form.lives > 0 ? form.lives : null,
                  timeBonus: form.timeBonus,
                  onePerPeriod: form.onePerPeriod,
                  xpPoints: form.xpPoints,
                  reward: form.reward,
                  perItem: form.perItem,
                  ...(challenge.kind === "arena"
                    ? {
                        segmentCount: form.segmentCount,
                        questionsPerSegment: form.questionsPerSegment,
                        correctMarks: form.correctMarks,
                        wrongMarks: form.wrongMarks,
                      }
                    : {}),
                },
              })
            }
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save mode"}
          </button>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="block text-xs">
          Display name
          <input
            className="field mt-1 h-9 w-full text-sm"
            value={form.name}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={form.status === "active"}
            onChange={(e) => patch({ status: e.target.checked ? "active" : "inactive" })}
          />
          Available to participants
        </label>
        {showCourse ? (
          <label className="block text-xs">
            Course
            <select
              className="field mt-1 h-9 w-full text-sm"
              value={form.courseId}
              onChange={(e) => patch({ courseId: e.target.value, poolId: "" })}
            >
              <option value="">
                {challenge.kind === "flash"
                  ? "Any course (participant chooses)"
                  : "Any course (largest pool)"}
              </option>
              {data.courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {showActivity ? (
          <label className="block text-xs">
            Activity
            <select
              className="field mt-1 h-9 w-full text-sm"
              value={form.activityId}
              onChange={(e) => patch({ activityId: e.target.value })}
            >
              <option value="">None (course hub only)</option>
              {data.activities.map((activity) => (
                <option key={activity.id} value={activity.id}>
                  {activity.name}
                  {activity.status !== "active" ? " (hidden)" : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {showPool ? (
          <label className="block text-xs">
            Question pool
            <select
              className="field mt-1 h-9 w-full text-sm"
              value={form.poolId}
              onChange={(e) => patch({ poolId: e.target.value })}
            >
              <option value="">Largest matching pool</option>
              {pools.map((pool) => (
                <option key={pool.id} value={pool.id}>
                  {pool.courseName} · {pool.name} ({pool.questionCount})
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {basics ? (
          <NumField
            label="XP on finish"
            value={form.xpPoints}
            min={0}
            max={500}
            onChange={(xpPoints) => patch({ xpPoints })}
          />
        ) : (
          <>
            <NumField
              label="Questions"
              value={form.questionCount}
              min={1}
              max={100}
              onChange={(questionCount) => patch({ questionCount })}
            />
            {showArenaRules ? (
              <>
                <NumField
                  label="Segments"
                  value={form.segmentCount}
                  min={1}
                  max={12}
                  onChange={(segmentCount) => patch({ segmentCount })}
                />
                <NumField
                  label="Questions per segment"
                  value={form.questionsPerSegment}
                  min={1}
                  max={20}
                  onChange={(questionsPerSegment) => patch({ questionsPerSegment })}
                />
                <NumField
                  label="Marks for a correct answer"
                  value={form.correctMarks}
                  min={0}
                  max={20}
                  onChange={(correctMarks) => patch({ correctMarks })}
                />
                <NumField
                  label="Marks deducted for a wrong answer"
                  value={form.wrongMarks}
                  min={0}
                  max={20}
                  onChange={(wrongMarks) => patch({ wrongMarks })}
                />
              </>
            ) : null}
            <NumField
              label="Session timer (minutes, 0 = none)"
              value={form.durationMinutes}
              min={0}
              max={300}
              onChange={(durationMinutes) => patch({ durationMinutes })}
            />
            <NumField
              label="Per-question timer (seconds, 0 = none)"
              value={form.perQuestionSeconds}
              min={0}
              max={600}
              onChange={(perQuestionSeconds) => patch({ perQuestionSeconds })}
            />
            <NumField
              label="Lives (0 = none)"
              value={form.lives}
              min={0}
              max={20}
              onChange={(lives) => patch({ lives })}
            />
            <NumField
              label="XP on finish"
              value={form.xpPoints}
              min={0}
              max={500}
              onChange={(xpPoints) => patch({ xpPoints })}
            />
            <div className="grid gap-2 text-xs sm:grid-cols-2">
              <CheckField
                label="Time-bonus scoring"
                checked={form.timeBonus}
                onChange={(timeBonus) => patch({ timeBonus })}
              />
              <CheckField
                label="One attempt per period"
                checked={form.onePerPeriod}
                onChange={(onePerPeriod) => patch({ onePerPeriod })}
              />
              <CheckField
                label="Grade each item immediately"
                checked={form.perItem}
                onChange={(perItem) => patch({ perItem })}
              />
              <CheckField
                label="Mystery box / lucky wheel"
                checked={form.reward}
                onChange={(reward) => patch({ reward })}
              />
            </div>
          </>
        )}
      </div>

      {showTopics ? (
        <div className="mt-5 border-t border-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Enabled topics</p>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={form.allTopics}
                onChange={(e) =>
                  patch({
                    allTopics: e.target.checked,
                    allowedTopics: e.target.checked ? [] : topicOptions.map((t) => t.label),
                  })
                }
              />
              All topics in this source
            </label>
          </div>
          {topicOptions.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Import pool questions to choose topics for this mode.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {topicOptions.map((topic) => {
                const on = form.allTopics || form.allowedTopics.includes(topic.label);
                return (
                  <button
                    key={topic.label}
                    type="button"
                    disabled={form.allTopics}
                    onClick={() =>
                      patch({
                        allowedTopics: on
                          ? form.allowedTopics.filter((label) => label !== topic.label)
                          : [...form.allowedTopics, topic.label],
                      })
                    }
                    className={cn(
                      "rounded-full px-3 py-1 text-xs",
                      on
                        ? "bg-primary text-primary-foreground"
                        : "border border-border text-muted-foreground",
                      form.allTopics && "opacity-70",
                    )}
                  >
                    {topic.label} ({topic.count})
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </AdminPanel>
  );
}

function EscapePanel({
  data,
  defaultPoolId,
}: {
  data: AdminPlayData;
  defaultPoolId?: string | null;
}) {
  const queryClient = useQueryClient();
  const saveEscape = useServerFn(saveEscapeScenario);
  const setEscStatus = useServerFn(setEscapeStatus);
  const onDone = () => void queryClient.invalidateQueries({ queryKey: ["admin-play"] });
  const emptyScene = (): SceneDraft => ({
    title: "",
    body: "",
    topic: data.pools[0]?.topics[0]?.label ?? "general",
    questionCount: 4,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("Production Down");
  const [intro, setIntro] = useState("");
  const [poolId, setPoolId] = useState(defaultPoolId ?? data.pools[0]?.id ?? "");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [scenes, setScenes] = useState<SceneDraft[]>([emptyScene()]);

  const saveMut = useMutation({
    mutationFn: () =>
      saveEscape({
        data: {
          ...(editingId ? { id: editingId } : {}),
          name,
          intro,
          poolId: poolId || null,
          status,
          scenes: scenes.filter((s) => s.title.trim()),
        },
      }),
    onSuccess: () => {
      toast.success(editingId ? "Scenario updated" : "Scenario saved");
      setEditingId(null);
      onDone();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Save failed"),
  });
  const statusMut = useMutation({
    mutationFn: ({ scenarioId, next }: { scenarioId: string; next: "active" | "inactive" }) =>
      setEscStatus({ data: { scenarioId, status: next } }),
    onSuccess: onDone,
    onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed"),
  });

  function loadScenario(id: string) {
    const row = data.scenarios.find((s) => s.id === id);
    if (!row) return;
    setEditingId(row.id);
    setName(row.name);
    setIntro(row.intro);
    setPoolId(row.pool_id ?? "");
    setStatus(row.status === "inactive" ? "inactive" : "active");
    setScenes(
      row.scenes.length
        ? row.scenes.map((s) => ({
            title: s.title,
            body: s.body,
            topic: s.topic,
            questionCount: s.question_count,
          }))
        : [emptyScene()],
    );
  }

  const topicLabels = topicsForSource(data.pools, null, poolId || null).map((t) => t.label);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <AdminPanel
        title={editingId ? "Edit scenario" : "New scenario"}
        description="Each scene pulls a topic set from the bound pool. Order is the participant path."
      >
        <div className="space-y-3">
          <input
            className="field h-9 w-full text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <textarea
            className="field min-h-[4.5rem] w-full text-sm"
            placeholder="Intro copy"
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              className="field h-9 text-sm"
              value={poolId}
              onChange={(e) => setPoolId(e.target.value)}
            >
              <option value="">Default play pool</option>
              {data.pools.map((pool) => (
                <option key={pool.id} value={pool.id}>
                  {pool.courseName} · {pool.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={status === "active"}
                onChange={(e) => setStatus(e.target.checked ? "active" : "inactive")}
              />
              Visible to participants
            </label>
          </div>
          <ul className="space-y-3">
            {scenes.map((scene, index) => (
              <li key={index} className="rounded-md border border-border p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  Scene {index + 1}
                  {scenes.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setScenes((rows) => rows.filter((_, i) => i !== index))}
                      className="text-destructive"
                    >
                      <AssessaIcon name="trash" className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
                <input
                  className="field h-8 w-full text-sm"
                  placeholder="Title"
                  value={scene.title}
                  onChange={(e) =>
                    setScenes((rows) =>
                      rows.map((row, i) => (i === index ? { ...row, title: e.target.value } : row)),
                    )
                  }
                />
                <textarea
                  className="field mt-2 min-h-[3rem] w-full text-sm"
                  placeholder="Story copy"
                  value={scene.body}
                  onChange={(e) =>
                    setScenes((rows) =>
                      rows.map((row, i) => (i === index ? { ...row, body: e.target.value } : row)),
                    )
                  }
                />
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <select
                    className="field h-8 text-sm"
                    value={scene.topic}
                    onChange={(e) =>
                      setScenes((rows) =>
                        rows.map((row, i) =>
                          i === index ? { ...row, topic: e.target.value } : row,
                        ),
                      )
                    }
                  >
                    {(topicLabels.length ? topicLabels : [scene.topic]).map((label) => (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input
                    className="field h-8 text-sm"
                    type="number"
                    min={1}
                    max={20}
                    value={scene.questionCount}
                    onChange={(e) =>
                      setScenes((rows) =>
                        rows.map((row, i) =>
                          i === index
                            ? { ...row, questionCount: Number(e.target.value) || 1 }
                            : row,
                        ),
                      )
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setScenes((rows) => [...rows, emptyScene()])}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs"
            >
              <AssessaIcon name="plus" className="h-3.5 w-3.5" />
              Add scene
            </button>
            <button
              type="button"
              onClick={() => saveMut.mutate()}
              className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground"
            >
              {saveMut.isPending ? "Saving…" : "Save scenario"}
            </button>
          </div>
        </div>
      </AdminPanel>
      <AdminPanel title="Scenarios" description="Inactive rooms stay hidden on /play/escape.">
        {data.scenarios.length === 0 ? (
          <AdminEmpty title="No scenarios yet" body="Author a room with ordered scenes." />
        ) : (
          <ul className="space-y-2">
            {data.scenarios.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.scenes.length} scenes · {row.status}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs text-accent"
                    onClick={() => loadScenario(row.id)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-xs"
                    onClick={() =>
                      statusMut.mutate({
                        scenarioId: row.id,
                        next: row.status === "active" ? "inactive" : "active",
                      })
                    }
                  >
                    {row.status === "active" ? "Hide" : "Show"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminPanel>
    </div>
  );
}

function TournamentPanel({
  data,
  show = {},
  defaultPoolId,
}: {
  data: AdminPlayData;
  show?: { activities?: boolean; arena?: boolean; knockout?: boolean };
  defaultPoolId?: string | null;
}) {
  const queryClient = useQueryClient();
  const createT = useServerFn(createPlayTournament);
  const startT = useServerFn(startPlayTournament);
  const saveActivity = useServerFn(savePlayActivity);
  const removeActivity = useServerFn(deletePlayActivity);
  const createArena = useServerFn(createLiveArena);
  const removeArena = useServerFn(deleteLiveArena);
  const onDone = () => void queryClient.invalidateQueries({ queryKey: ["admin-play"] });
  const [tName, setTName] = useState("Company Cup");
  const [size, setSize] = useState<4 | 8 | 16 | 32>(8);
  const [poolId, setPoolId] = useState(defaultPoolId ?? data.pools[0]?.id ?? "");
  const [activityName, setActivityName] = useState("");
  const [arenaName, setArenaName] = useState("Live Arena");
  const [arenaPoolId, setArenaPoolId] = useState(defaultPoolId ?? data.pools[0]?.id ?? "");
  const [segmentCount, setSegmentCount] = useState(3);
  const [questionsPerSegment, setQuestionsPerSegment] = useState(4);
  const [perQuestionSeconds, setPerQuestionSeconds] = useState(30);
  const [correctMarks, setCorrectMarks] = useState(2);
  const [wrongMarks, setWrongMarks] = useState(1);
  const [timeBonusMax, setTimeBonusMax] = useState(0);
  const [earlyLockBonus, setEarlyLockBonus] = useState(0);
  const [shareArenaId, setShareArenaId] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: () =>
      createT({
        data: { name: tName, size, ...(poolId ? { poolId } : {}) },
      }),
    onSuccess: () => {
      toast.success("Tournament created");
      onDone();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Create failed"),
  });
  const startMut = useMutation({
    mutationFn: (tournamentId: string) => startT({ data: { tournamentId } }),
    onSuccess: () => {
      toast.success("Bracket started");
      onDone();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Start failed"),
  });
  const activityMut = useMutation({
    mutationFn: () => saveActivity({ data: { name: activityName } }),
    onSuccess: () => {
      toast.success("Activity saved");
      setActivityName("");
      onDone();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save activity"),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => removeActivity({ data: { id } }),
    onSuccess: () => {
      toast.success("Activity removed");
      onDone();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not delete"),
  });
  const arenaMut = useMutation({
    mutationFn: () =>
      createArena({
        data: {
          name: arenaName,
          poolId: arenaPoolId,
          segmentCount,
          questionsPerSegment,
          perQuestionSeconds,
          correctMarks,
          wrongMarks,
          timeBonusMax,
          earlyLockBonus,
        },
      }),
    onSuccess: () => {
      toast.success("Live Arena lobby is open");
      onDone();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not create arena"),
  });
  const deleteArenaMut = useMutation({
    mutationFn: (arenaId: string) => removeArena({ data: { arenaId } }),
    onSuccess: () => {
      toast.success("Event deleted");
      setShareArenaId(null);
      onDone();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not delete"),
  });

  return (
    <div className="space-y-5">
      {show.activities ? (
        <AdminPanel
          title="Activities"
          description="Activities are Play hub segments alongside courses. Map modes to an activity so participants can find them there."
        >
          <div className="flex flex-wrap gap-2">
            <input
              className="field h-9 min-w-[12rem] text-sm"
              placeholder="Team quiz night"
              value={activityName}
              onChange={(e) => setActivityName(e.target.value)}
            />
            <button
              type="button"
              disabled={activityMut.isPending || activityName.trim().length < 2}
              onClick={() => activityMut.mutate()}
              className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-60"
            >
              Add activity
            </button>
          </div>
          {data.activities.length === 0 ? (
            <div className="mt-3">
              <AdminEmpty
                title="No activities"
                body="Create an activity, then map Live Arena or other modes to it."
              />
            </div>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {data.activities.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                >
                  <span>
                    {row.name}
                    <span className="ml-2 text-xs text-muted-foreground">{row.status}</span>
                  </span>
                  <button
                    type="button"
                    className="text-xs text-destructive"
                    onClick={() => deleteMut.mutate(row.id)}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>
      ) : null}

      {show.arena ? (
        <AdminPanel
          title="Live Arena"
          description="Hosted team quiz: pick a pool, segments × questions, a per-question timer, +/− marks, and optional time / early-lock bonuses. Teams join from Play. You reveal each key."
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <input
              className="field h-9 text-sm"
              value={arenaName}
              onChange={(e) => setArenaName(e.target.value)}
            />
            <select
              className="field h-9 text-sm"
              value={arenaPoolId}
              onChange={(e) => setArenaPoolId(e.target.value)}
            >
              <option value="">Select pool</option>
              {data.pools.map((pool) => (
                <option key={pool.id} value={pool.id}>
                  {pool.courseName} · {pool.name} ({pool.questionCount})
                </option>
              ))}
            </select>
            <NumField
              label="Segments"
              value={segmentCount}
              min={1}
              max={12}
              onChange={setSegmentCount}
            />
            <NumField
              label="Questions per segment"
              value={questionsPerSegment}
              min={1}
              max={20}
              onChange={setQuestionsPerSegment}
            />
            <NumField
              label="Seconds per question"
              value={perQuestionSeconds}
              min={5}
              max={600}
              onChange={setPerQuestionSeconds}
            />
            <NumField
              label="Correct marks"
              value={correctMarks}
              min={0}
              max={20}
              onChange={setCorrectMarks}
            />
            <NumField
              label="Wrong marks (deducted)"
              value={wrongMarks}
              min={0}
              max={20}
              onChange={setWrongMarks}
            />
            <NumField
              label="Time bonus (max extra)"
              value={timeBonusMax}
              min={0}
              max={50}
              onChange={setTimeBonusMax}
            />
            <NumField
              label="Early lock-in bonus"
              value={earlyLockBonus}
              min={0}
              max={50}
              onChange={setEarlyLockBonus}
            />
          </div>
          <button
            type="button"
            disabled={arenaMut.isPending || !arenaPoolId}
            onClick={() => arenaMut.mutate()}
            className="mt-3 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-60"
          >
            {arenaMut.isPending ? "Opening…" : "Open lobby"}
          </button>
          {data.arenas.length === 0 ? (
            <div className="mt-3">
              <AdminEmpty
                title="No arenas"
                body="Open a lobby after you have a question pool. Players join from Play."
              />
            </div>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {data.arenas.map((row) => (
                <li key={row.id} className="rounded-md border border-border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      {row.name} · {row.status} · {row.segment_count}×{row.questions_per_segment}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="text-xs text-accent"
                        onClick={() => setShareArenaId(shareArenaId === row.id ? null : row.id)}
                      >
                        {shareArenaId === row.id ? "Hide QR" : "QR / link"}
                      </button>
                      <Link
                        to="/admin/play/arena/$arenaId"
                        params={{ arenaId: row.id }}
                        className="text-xs text-accent"
                      >
                        Host
                      </Link>
                      <button
                        type="button"
                        className="text-xs text-destructive"
                        disabled={deleteArenaMut.isPending}
                        onClick={() => {
                          if (window.confirm(`Delete “${row.name}”?`))
                            deleteArenaMut.mutate(row.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {shareArenaId === row.id ? (
                    <div className="mt-3">
                      <ArenaShareCard arenaId={row.id} arenaName={row.name} compact />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>
      ) : null}

      {show.knockout ? (
        <AdminPanel
          title="Knockout tournaments"
          description="Players join from Play — no activity is required. Enrolment opens when you create a bracket. Start when the field is full enough."
        >
          <div className="flex flex-wrap gap-2">
            <input
              className="field h-9 text-sm"
              value={tName}
              onChange={(e) => setTName(e.target.value)}
            />
            <select
              className="field h-9 text-sm"
              value={size}
              onChange={(e) => setSize(Number(e.target.value) as 4 | 8 | 16 | 32)}
            >
              <option value={4}>4</option>
              <option value={8}>8</option>
              <option value={16}>16</option>
              <option value={32}>32</option>
            </select>
            <select
              className="field h-9 text-sm"
              value={poolId}
              onChange={(e) => setPoolId(e.target.value)}
            >
              <option value="">Default play pool</option>
              {data.pools.map((pool) => (
                <option key={pool.id} value={pool.id}>
                  {pool.courseName} · {pool.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => createMut.mutate()}
              className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground"
            >
              Create
            </button>
          </div>
          {data.tournaments.length === 0 ? (
            <div className="mt-3">
              <AdminEmpty title="No tournaments" body="Create a knockout and bind it to a pool." />
            </div>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {data.tournaments.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                >
                  <span>
                    {t.name} · {t.size} · {t.status}
                  </span>
                  {t.status === "open" ? (
                    <button
                      type="button"
                      className="text-accent"
                      onClick={() => startMut.mutate(t.id)}
                    >
                      Start bracket
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>
      ) : null}
    </div>
  );
}

function formFromChallenge(row: AdminPlayChallenge): ChallengeForm {
  return {
    name: row.name,
    status: row.status,
    courseId: row.courseId ?? "",
    activityId: row.activityId ?? "",
    poolId: row.poolId ?? "",
    allTopics: !row.allowedTopics?.length,
    allowedTopics: row.allowedTopics ?? [],
    questionCount: row.rules.questionCount,
    durationMinutes: row.rules.durationSeconds ? Math.round(row.rules.durationSeconds / 60) : 0,
    perQuestionSeconds: row.rules.perQuestionSeconds ?? 0,
    lives: row.rules.lives ?? 0,
    timeBonus: row.rules.timeBonus,
    onePerPeriod: row.rules.onePerPeriod,
    xpPoints: row.rules.xpPoints,
    reward: row.rules.reward,
    perItem: row.rules.perItem,
    segmentCount: row.segmentCount ?? 3,
    questionsPerSegment: row.questionsPerSegment ?? 4,
    correctMarks: row.correctMarks ?? 2,
    wrongMarks: row.wrongMarks ?? 1,
  };
}

function topicsForSource(pools: AdminPlayPool[], courseId: string | null, poolId: string | null) {
  const filtered = pools.filter((pool) => {
    if (poolId) return pool.id === poolId;
    if (courseId) return pool.courseId === courseId;
    return true;
  });
  const merged = new Map<string, { label: string; count: number }>();
  for (const pool of filtered) {
    for (const topic of pool.topics) {
      const current = merged.get(topic.label) ?? { label: topic.label, count: 0 };
      current.count += topic.count;
      merged.set(topic.label, current);
    }
  }
  return [...merged.values()].sort((a, b) => b.count - a.count);
}

function sourceLabel(row: AdminPlayChallenge, data: AdminPlayData) {
  const pool = data.pools.find((p) => p.id === row.poolId);
  const course = data.courses.find((c) => c.id === row.courseId);
  const activity = data.activities.find((a) => a.id === row.activityId);
  if (row.kind === "knockout") {
    return pool ? `${pool.courseName} · ${pool.name}` : "Join from Play · no activity needed";
  }
  if (row.kind === "escape") {
    return pool ? `${pool.courseName} · ${pool.name}` : "Needs a question pool";
  }
  if (row.kind === "arena") {
    return pool ? `${pool.courseName} · ${pool.name}` : "Join from Play · no activity needed";
  }
  const parts = [
    activity ? `Activity · ${activity.name}` : null,
    pool ? `${pool.courseName} · ${pool.name}` : course ? `${course.name} · any pool` : null,
    !pool && !course && row.allowedTopics?.length ? `${row.allowedTopics.length} topics` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Largest available pool";
}

function NumField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-xs">
      {label}
      <input
        className="field mt-1 h-9 w-full text-sm"
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
