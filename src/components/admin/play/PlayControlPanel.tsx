import { AdminEmpty, AdminPanel, ResultCount, StatusPill } from "@/components/admin/AdminPageUi";
import { StatTile } from "@/components/platform";
import {
  createPlayTournament,
  saveEscapeScenario,
  savePlayChallenge,
  setEscapeStatus,
  setPlayKindStatus,
  setPlayMenu,
  startPlayTournament,
} from "@/lib/play.functions";
import { PLAY_KIND_GROUPS, PLAY_KIND_META, type PlayKind, type PlayRules } from "@/lib/play.math";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export type AdminPlayChallenge = {
  id: string;
  kind: PlayKind;
  name: string;
  courseId: string | null;
  poolId: string | null;
  topic: string | null;
  status: "active" | "inactive";
  rules: PlayRules;
  allowedTopics: string[] | null;
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
};

type Panel = "modes" | "escape" | "events";

type ChallengeSavePayload = {
  id?: string;
  kind: PlayKind;
  name: string;
  status: "active" | "inactive";
  courseId: string | null;
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
  };
};

type ChallengeForm = {
  name: string;
  status: "active" | "inactive";
  courseId: string;
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
};

type SceneDraft = { title: string; body: string; topic: string; questionCount: number };

export function PlayControlPanel({ data }: { data: AdminPlayData }) {
  const queryClient = useQueryClient();
  const [panel, setPanel] = useState<Panel>("modes");
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
      setEditingKind(null);
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

      <div className="inline-flex rounded-[var(--radius-md)] border border-border bg-card p-0.5">
        {(
          [
            ["modes", "Modes"],
            ["escape", "Escape rooms"],
            ["events", "Tournaments"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPanel(id)}
            className={cn(
              "rounded-[calc(var(--radius-md)-2px)] px-3 py-1.5 text-xs font-medium",
              panel === id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Live modes"
          value={liveCount}
          hint={`${data.challenges.length} configured`}
        />
        <StatTile
          label="Question pools"
          value={data.pools.length}
          hint={`${data.courses.length} courses`}
        />
        <StatTile label="Plays (7 days)" value={sessions7d} />
        <StatTile
          label="Events"
          value={data.tournaments.length}
          hint={`${data.scenarios.filter((s) => s.status === "active").length} escape rooms live`}
        />
      </div>

      {panel === "modes" ? (
        <ModesPanel
          data={data}
          editingKind={editingKind}
          onEdit={setEditingKind}
          saving={challengeMut.isPending}
          onToggle={(kind, status) => statusMut.mutate({ kind, status })}
          onSave={(payload) => challengeMut.mutate({ data: payload })}
        />
      ) : null}
      {panel === "escape" ? <EscapePanel data={data} /> : null}
      {panel === "events" ? <TournamentPanel data={data} /> : null}
    </div>
  );
}

function ModesPanel({
  data,
  editingKind,
  onEdit,
  saving,
  onToggle,
  onSave,
}: {
  data: AdminPlayData;
  editingKind: PlayKind | null;
  onEdit: (kind: PlayKind | null) => void;
  saving: boolean;
  onToggle: (kind: PlayKind, status: "active" | "inactive") => void;
  onSave: (payload: ChallengeSavePayload) => void;
}) {
  const editing = data.challenges.find((c) => c.kind === editingKind) ?? null;

  return (
    <div className="space-y-5">
      {editing ? (
        <ModeEditor
          challenge={editing}
          data={data}
          saving={saving}
          onCancel={() => onEdit(null)}
          onSave={onSave}
        />
      ) : null}
      {PLAY_KIND_GROUPS.map((group) => (
        <AdminPanel
          key={group.label}
          title={group.label}
          description="Turn a mode on for participants, then bind it to a course, pool, and topic mix."
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
                      <Pencil className="h-3 w-3" />
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
}: {
  challenge: AdminPlayChallenge;
  data: AdminPlayData;
  saving: boolean;
  onCancel: () => void;
  onSave: (payload: ChallengeSavePayload) => void;
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

  return (
    <AdminPanel
      title={`Configure · ${PLAY_KIND_META[challenge.kind].label}`}
      description={
        challenge.kind === "flash"
          ? "Participants pick a course, then a topic, then start the deck. Bind a course (or leave Any) and optionally limit topics."
          : "Participants only see this mode when it is On. Course, pool, and topics control which bank questions are drawn."
      }
      action={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-3 py-1.5 text-xs"
          >
            Cancel
          </button>
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
                poolId: form.poolId || null,
                allowedTopics: form.allTopics ? null : form.allowedTopics,
                rules: {
                  questionCount: form.questionCount,
                  durationSeconds: form.durationMinutes > 0 ? form.durationMinutes * 60 : null,
                  perQuestionSeconds: form.perQuestionSeconds > 0 ? form.perQuestionSeconds : null,
                  lives: form.lives > 0 ? form.lives : null,
                  timeBonus: form.timeBonus,
                  onePerPeriod: form.onePerPeriod,
                  xpPoints: form.xpPoints,
                  reward: form.reward,
                  perItem: form.perItem,
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
        <NumField
          label="Questions"
          value={form.questionCount}
          min={1}
          max={100}
          onChange={(questionCount) => patch({ questionCount })}
        />
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
      </div>

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
    </AdminPanel>
  );
}

function EscapePanel({ data }: { data: AdminPlayData }) {
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
  const [poolId, setPoolId] = useState(data.pools[0]?.id ?? "");
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
                      <Trash2 className="h-3.5 w-3.5" />
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
              <Plus className="h-3.5 w-3.5" />
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

function TournamentPanel({ data }: { data: AdminPlayData }) {
  const queryClient = useQueryClient();
  const createT = useServerFn(createPlayTournament);
  const startT = useServerFn(startPlayTournament);
  const onDone = () => void queryClient.invalidateQueries({ queryKey: ["admin-play"] });
  const [tName, setTName] = useState("Company Cup");
  const [size, setSize] = useState<4 | 8 | 16 | 32>(8);
  const [poolId, setPoolId] = useState(data.pools[0]?.id ?? "");
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

  return (
    <AdminPanel
      title="Knockout tournaments"
      description="Enrolment opens when you create a bracket. Start when the field is full enough."
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
                <button type="button" className="text-accent" onClick={() => startMut.mutate(t.id)}>
                  Start bracket
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </AdminPanel>
  );
}

function formFromChallenge(row: AdminPlayChallenge): ChallengeForm {
  return {
    name: row.name,
    status: row.status,
    courseId: row.courseId ?? "",
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
  if (pool) return `${pool.courseName} · ${pool.name}`;
  if (course) return `${course.name} · any pool`;
  if (row.allowedTopics?.length) return `${row.allowedTopics.length} topics`;
  return "Largest available pool";
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
