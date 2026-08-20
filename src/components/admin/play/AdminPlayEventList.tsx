import { AdminPageHeader, ResultCount, StatusPill } from "@/components/admin/AdminPageUi";
import { EscapePanel, type AdminPlayData } from "@/components/admin/play/PlayControlPanel";
import { ArenaShareCard } from "@/components/play/ArenaShareCard";
import { ListToolbar, useListViewMode } from "@/components/ListToolbar";
import { EmptyState } from "@/components/platform";
import { SlideOver } from "@/components/ui/slide-over";
import {
  deleteLiveArena,
  setEscapeStatus,
  setLiveArenaListed,
  setTournamentListed,
  startPlayTournament,
  updateLiveArena,
  updatePlayTournament,
} from "@/lib/play.functions";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type PublishFilter = "all" | "published" | "draft";
type ArenaRow = AdminPlayData["arenas"][number];
type TournamentRow = AdminPlayData["tournaments"][number];

const actionBtn =
  "inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-60";

function matchesSearch(haystack: string, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystack.toLowerCase().includes(q);
}

/** Unpublished, or not finished — config may still change. */
function canEditArena(row: ArenaRow) {
  if (row.status === "complete") return false;
  return true;
}

function canEditEscape(status: string) {
  return status !== "active";
}

function canEditTournament(row: TournamentRow) {
  if (row.status === "complete") return false;
  return true;
}

export function AdminArenaList({ data }: { data: AdminPlayData }) {
  const queryClient = useQueryClient();
  const setListed = useServerFn(setLiveArenaListed);
  const removeArena = useServerFn(deleteLiveArena);
  const saveArena = useServerFn(updateLiveArena);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PublishFilter>("all");
  const [view, setView] = useListViewMode("admin-play-arenas", "stack");
  const [shareId, setShareId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ArenaRow | null>(null);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["admin-play"] });

  const listedMut = useMutation({
    mutationFn: (payload: { arenaId: string; listed: boolean }) => setListed({ data: payload }),
    onSuccess: (_d, vars) => {
      toast.success(vars.listed ? "Published to Play" : "Unpublished from Play");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update"),
  });
  const deleteMut = useMutation({
    mutationFn: (arenaId: string) => removeArena({ data: { arenaId } }),
    onSuccess: () => {
      toast.success("Arena deleted");
      setShareId(null);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not delete"),
  });
  const saveMut = useMutation({
    mutationFn: (payload: Parameters<typeof saveArena>[0]["data"]) => saveArena({ data: payload }),
    onSuccess: () => {
      toast.success("Lobby updated");
      setEditing(null);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save"),
  });

  const rows = useMemo(() => {
    return data.arenas.filter((row) => {
      const published = row.listed !== false;
      if (filter === "published" && !published) return false;
      if (filter === "draft" && published) return false;
      return matchesSearch(`${row.name} ${row.status}`, search);
    });
  }, [data.arenas, filter, search]);

  const publishedCount = data.arenas.filter((r) => r.listed !== false).length;

  return (
    <div>
      <AdminPageHeader
        title="Live Arena lobbies"
        back={{ to: "/admin/play", label: "Play" }}
        help={{
          label: "Publish to Play",
          body: "Publish a lobby so participants see it on Play → Live Arena. Edit is available while unpublished or before the event is finished. Create new lobbies from Configure on the Play card.",
        }}
      />
      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search lobbies…"
        filters={
          [
            { value: "all" as const, label: "All", count: data.arenas.length },
            { value: "published" as const, label: "Published", count: publishedCount },
            {
              value: "draft" as const,
              label: "Unpublished",
              count: data.arenas.length - publishedCount,
            },
          ] as const
        }
        filter={filter}
        onFilterChange={setFilter}
        view={view}
        onViewChange={setView}
      />
      <div className="mb-3">
        <ResultCount shown={rows.length} total={data.arenas.length} noun="lobbies" />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title={data.arenas.length === 0 ? "No lobbies yet" : "No match"}
          body={
            data.arenas.length === 0
              ? "Open Configure on the Live Arena card to create a lobby, then publish it here."
              : undefined
          }
        />
      ) : (
        <div
          className={cn(
            view === "grid" && "grid gap-3 sm:grid-cols-2 xl:grid-cols-3",
            view === "stack" && "space-y-3",
            view === "table" && "overflow-x-auto rounded-xl border border-border",
          )}
        >
          {view === "table" ? (
            <>
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="border-b border-border bg-secondary/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Format</th>
                    <th className="px-3 py-2 font-medium">Visibility</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const published = row.listed !== false;
                    return (
                      <tr key={row.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-medium">{row.name}</td>
                        <td className="px-3 py-2 capitalize text-muted-foreground">{row.status}</td>
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">
                          {row.segment_count}×{row.questions_per_segment}
                        </td>
                        <td className="px-3 py-2">
                          <StatusPill tone={published ? "live" : "draft"}>
                            {published ? "Published" : "Unpublished"}
                          </StatusPill>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <ArenaActions
                              row={row}
                              published={published}
                              shareOpen={shareId === row.id}
                              pending={listedMut.isPending || deleteMut.isPending}
                              onEdit={canEditArena(row) ? () => setEditing(row) : undefined}
                              onToggleShare={() => setShareId(shareId === row.id ? null : row.id)}
                              onPublish={() =>
                                listedMut.mutate({ arenaId: row.id, listed: !published })
                              }
                              onDelete={() => {
                                if (window.confirm(`Delete “${row.name}”?`))
                                  deleteMut.mutate(row.id);
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {shareId
                ? (() => {
                    const row = rows.find((r) => r.id === shareId);
                    return row ? (
                      <div className="border-t border-border p-4">
                        <ArenaShareCard arenaId={row.id} arenaName={row.name} compact />
                      </div>
                    ) : null;
                  })()
                : null}
            </>
          ) : (
            rows.map((row) => {
              const published = row.listed !== false;
              return (
                <article key={row.id} className="surface-paper p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{row.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {row.status} · {row.segment_count}×{row.questions_per_segment} questions
                      </p>
                    </div>
                    <StatusPill tone={published ? "live" : "draft"}>
                      {published ? "Published" : "Unpublished"}
                    </StatusPill>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ArenaActions
                      row={row}
                      published={published}
                      shareOpen={shareId === row.id}
                      pending={listedMut.isPending || deleteMut.isPending}
                      onEdit={canEditArena(row) ? () => setEditing(row) : undefined}
                      onToggleShare={() => setShareId(shareId === row.id ? null : row.id)}
                      onPublish={() => listedMut.mutate({ arenaId: row.id, listed: !published })}
                      onDelete={() => {
                        if (window.confirm(`Delete “${row.name}”?`)) deleteMut.mutate(row.id);
                      }}
                    />
                  </div>
                  {shareId === row.id ? (
                    <div className="mt-3">
                      <ArenaShareCard arenaId={row.id} arenaName={row.name} compact />
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      )}

      <SlideOver
        open={editing != null}
        onClose={() => setEditing(null)}
        title={editing ? `Edit · ${editing.name}` : "Edit lobby"}
        description="Update name and scoring. Question set and segment layout stay fixed after create."
        size="lg"
      >
        {editing ? (
          <ArenaEditForm
            key={editing.id}
            row={editing}
            saving={saveMut.isPending}
            onCancel={() => setEditing(null)}
            onSave={(payload) => saveMut.mutate(payload)}
          />
        ) : null}
      </SlideOver>
    </div>
  );
}

function ArenaActions({
  row,
  published,
  shareOpen,
  pending,
  onEdit,
  onToggleShare,
  onPublish,
  onDelete,
}: {
  row: ArenaRow;
  published: boolean;
  shareOpen: boolean;
  pending: boolean;
  onEdit?: () => void;
  onToggleShare: () => void;
  onPublish: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      {onEdit ? (
        <button type="button" className={actionBtn} onClick={onEdit}>
          Edit
        </button>
      ) : null}
      <button type="button" className={actionBtn} disabled={pending} onClick={onPublish}>
        {published ? "Unpublish" : "Publish"}
      </button>
      <button type="button" className={actionBtn} onClick={onToggleShare}>
        {shareOpen ? "Hide QR" : "QR / link"}
      </button>
      <Link
        to="/admin/play/arena/$arenaId"
        params={{ arenaId: row.id }}
        className={cn(actionBtn, "text-accent")}
      >
        Host
      </Link>
      <button
        type="button"
        className={cn(actionBtn, "text-destructive")}
        disabled={pending}
        onClick={onDelete}
      >
        Delete
      </button>
    </>
  );
}

function ArenaEditForm({
  row,
  saving,
  onCancel,
  onSave,
}: {
  row: ArenaRow;
  saving: boolean;
  onCancel: () => void;
  onSave: (payload: {
    arenaId: string;
    name: string;
    perQuestionSeconds: number;
    correctMarks: number;
    wrongMarks: number;
    timeBonusMax: number;
    earlyLockBonus: number;
    allowOpenTeams: boolean;
  }) => void;
}) {
  const [name, setName] = useState(row.name);
  const [perQuestionSeconds, setPerQuestionSeconds] = useState(row.per_question_seconds ?? 30);
  const [correctMarks, setCorrectMarks] = useState(row.correct_marks ?? 2);
  const [wrongMarks, setWrongMarks] = useState(row.wrong_marks ?? 1);
  const [timeBonusMax, setTimeBonusMax] = useState(row.time_bonus_max ?? 0);
  const [earlyLockBonus, setEarlyLockBonus] = useState(row.early_lock_bonus ?? 0);
  const [allowOpenTeams, setAllowOpenTeams] = useState(row.allow_open_teams !== false);

  return (
    <div className="space-y-4">
      <label className="block text-xs">
        Name
        <input
          className="field mt-1 h-9 w-full text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Format locked at {row.segment_count}×{row.questions_per_segment} questions.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
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
          label="Time bonus (max)"
          value={timeBonusMax}
          min={0}
          max={50}
          onChange={setTimeBonusMax}
        />
        <NumField
          label="First-lock bonus"
          value={earlyLockBonus}
          min={0}
          max={50}
          onChange={setEarlyLockBonus}
        />
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={allowOpenTeams}
          onChange={(e) => setAllowOpenTeams(e.target.checked)}
        />
        Allow players to create / join open teams
      </label>
      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <button type="button" className={actionBtn} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          disabled={saving || name.trim().length < 2}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
          onClick={() =>
            onSave({
              arenaId: row.id,
              name: name.trim(),
              perQuestionSeconds,
              correctMarks,
              wrongMarks,
              timeBonusMax,
              earlyLockBonus,
              allowOpenTeams,
            })
          }
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
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
        type="number"
        className="field mt-1 h-9 w-full text-sm"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function AdminEscapeList({ data }: { data: AdminPlayData }) {
  const queryClient = useQueryClient();
  const setStatus = useServerFn(setEscapeStatus);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PublishFilter>("all");
  const [view, setView] = useListViewMode("admin-play-escape", "stack");
  const [editingId, setEditingId] = useState<string | null>(null);

  const statusMut = useMutation({
    mutationFn: (payload: { scenarioId: string; status: "active" | "inactive" }) =>
      setStatus({ data: payload }),
    onSuccess: (_d, vars) => {
      toast.success(vars.status === "active" ? "Published to Play" : "Unpublished from Play");
      void queryClient.invalidateQueries({ queryKey: ["admin-play"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update"),
  });

  const rows = useMemo(() => {
    return data.scenarios.filter((row) => {
      const published = row.status === "active";
      if (filter === "published" && !published) return false;
      if (filter === "draft" && published) return false;
      return matchesSearch(`${row.name} ${row.intro}`, search);
    });
  }, [data.scenarios, filter, search]);

  const publishedCount = data.scenarios.filter((r) => r.status === "active").length;

  return (
    <div>
      <AdminPageHeader
        title="Escape scenarios"
        back={{ to: "/admin/play", label: "Play" }}
        help={{
          label: "Publish to Play",
          body: "Publish a scenario so participants see it on Play → Escape. Edit is available while unpublished. Author new rooms from Configure on the Escape card.",
        }}
      />
      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search scenarios…"
        filters={
          [
            { value: "all" as const, label: "All", count: data.scenarios.length },
            { value: "published" as const, label: "Published", count: publishedCount },
            {
              value: "draft" as const,
              label: "Unpublished",
              count: data.scenarios.length - publishedCount,
            },
          ] as const
        }
        filter={filter}
        onFilterChange={setFilter}
        view={view}
        onViewChange={setView}
      />
      <div className="mb-3">
        <ResultCount shown={rows.length} total={data.scenarios.length} noun="scenarios" />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title={data.scenarios.length === 0 ? "No scenarios yet" : "No match"}
          body={
            data.scenarios.length === 0
              ? "Open Configure on the Escape card to author a scenario, then publish it here."
              : undefined
          }
        />
      ) : (
        <div
          className={cn(
            view === "grid" && "grid gap-3 sm:grid-cols-2 xl:grid-cols-3",
            view === "stack" && "space-y-3",
            view === "table" && "overflow-x-auto rounded-xl border border-border",
          )}
        >
          {view === "table" ? (
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b border-border bg-secondary/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Scenes</th>
                  <th className="px-3 py-2 font-medium">Visibility</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const published = row.status === "active";
                  return (
                    <tr key={row.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-medium">{row.name}</td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">
                        {row.scenes.length}
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill tone={published ? "live" : "draft"}>
                          {published ? "Published" : "Unpublished"}
                        </StatusPill>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          {canEditEscape(row.status) ? (
                            <button
                              type="button"
                              className={actionBtn}
                              onClick={() => setEditingId(row.id)}
                            >
                              Edit
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className={actionBtn}
                            disabled={statusMut.isPending}
                            onClick={() =>
                              statusMut.mutate({
                                scenarioId: row.id,
                                status: published ? "inactive" : "active",
                              })
                            }
                          >
                            {published ? "Unpublish" : "Publish"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            rows.map((row) => {
              const published = row.status === "active";
              return (
                <article key={row.id} className="surface-paper p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{row.name}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {row.scenes.length} scenes
                        {row.intro ? ` · ${row.intro}` : ""}
                      </p>
                    </div>
                    <StatusPill tone={published ? "live" : "draft"}>
                      {published ? "Published" : "Unpublished"}
                    </StatusPill>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canEditEscape(row.status) ? (
                      <button
                        type="button"
                        className={actionBtn}
                        onClick={() => setEditingId(row.id)}
                      >
                        Edit
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={actionBtn}
                      disabled={statusMut.isPending}
                      onClick={() =>
                        statusMut.mutate({
                          scenarioId: row.id,
                          status: published ? "inactive" : "active",
                        })
                      }
                    >
                      {published ? "Unpublish" : "Publish"}
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}

      <SlideOver
        open={editingId != null}
        onClose={() => setEditingId(null)}
        title="Edit scenario"
        description="Update scenes and pool while the room is unpublished."
        size="xl"
      >
        {editingId ? (
          <EscapePanel
            key={editingId}
            data={data}
            showManagedList={false}
            initialScenarioId={editingId}
            onSaved={() => setEditingId(null)}
          />
        ) : null}
      </SlideOver>
    </div>
  );
}

export function AdminKnockoutList({ data }: { data: AdminPlayData }) {
  const queryClient = useQueryClient();
  const setListed = useServerFn(setTournamentListed);
  const startT = useServerFn(startPlayTournament);
  const saveTournament = useServerFn(updatePlayTournament);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PublishFilter>("all");
  const [view, setView] = useListViewMode("admin-play-knockout", "stack");
  const [editing, setEditing] = useState<TournamentRow | null>(null);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["admin-play"] });

  const listedMut = useMutation({
    mutationFn: (payload: { tournamentId: string; listed: boolean }) =>
      setListed({ data: payload }),
    onSuccess: (_d, vars) => {
      toast.success(vars.listed ? "Published to Play" : "Unpublished from Play");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update"),
  });
  const startMut = useMutation({
    mutationFn: (tournamentId: string) => startT({ data: { tournamentId } }),
    onSuccess: () => {
      toast.success("Bracket started");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Start failed"),
  });
  const saveMut = useMutation({
    mutationFn: (payload: {
      tournamentId: string;
      name: string;
      size: 4 | 8 | 16 | 32;
      poolId: string | null;
    }) => saveTournament({ data: payload }),
    onSuccess: () => {
      toast.success("Bracket updated");
      setEditing(null);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save"),
  });

  const rows = useMemo(() => {
    return data.tournaments.filter((row) => {
      const published = row.listed !== false;
      if (filter === "published" && !published) return false;
      if (filter === "draft" && published) return false;
      return matchesSearch(`${row.name} ${row.status}`, search);
    });
  }, [data.tournaments, filter, search]);

  const publishedCount = data.tournaments.filter((r) => r.listed !== false).length;

  return (
    <div>
      <AdminPageHeader
        title="Knockout brackets"
        back={{ to: "/admin/play", label: "Play" }}
        help={{
          label: "Publish to Play",
          body: "Publish a bracket so participants see it on Play → Knockout. Edit is available while unpublished or before the bracket is finished.",
        }}
      />
      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search brackets…"
        filters={
          [
            { value: "all" as const, label: "All", count: data.tournaments.length },
            { value: "published" as const, label: "Published", count: publishedCount },
            {
              value: "draft" as const,
              label: "Unpublished",
              count: data.tournaments.length - publishedCount,
            },
          ] as const
        }
        filter={filter}
        onFilterChange={setFilter}
        view={view}
        onViewChange={setView}
      />
      <div className="mb-3">
        <ResultCount shown={rows.length} total={data.tournaments.length} noun="brackets" />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title={data.tournaments.length === 0 ? "No brackets yet" : "No match"}
          body={
            data.tournaments.length === 0
              ? "Open Configure on the Knockout card to create a bracket, then publish it here."
              : undefined
          }
        />
      ) : (
        <div
          className={cn(
            view === "grid" && "grid gap-3 sm:grid-cols-2 xl:grid-cols-3",
            view === "stack" && "space-y-3",
            view === "table" && "overflow-x-auto rounded-xl border border-border",
          )}
        >
          {view === "table" ? (
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-border bg-secondary/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Size</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Visibility</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const published = row.listed !== false;
                  return (
                    <tr key={row.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-medium">{row.name}</td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">{row.size}</td>
                      <td className="px-3 py-2 capitalize text-muted-foreground">{row.status}</td>
                      <td className="px-3 py-2">
                        <StatusPill tone={published ? "live" : "draft"}>
                          {published ? "Published" : "Unpublished"}
                        </StatusPill>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          {canEditTournament(row) ? (
                            <button
                              type="button"
                              className={actionBtn}
                              onClick={() => setEditing(row)}
                            >
                              Edit
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className={actionBtn}
                            disabled={listedMut.isPending}
                            onClick={() =>
                              listedMut.mutate({ tournamentId: row.id, listed: !published })
                            }
                          >
                            {published ? "Unpublish" : "Publish"}
                          </button>
                          {row.status === "open" ? (
                            <button
                              type="button"
                              className={actionBtn}
                              disabled={startMut.isPending}
                              onClick={() => startMut.mutate(row.id)}
                            >
                              Start bracket
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            rows.map((row) => {
              const published = row.listed !== false;
              return (
                <article key={row.id} className="surface-paper p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{row.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {row.size}-player · {row.status}
                      </p>
                    </div>
                    <StatusPill tone={published ? "live" : "draft"}>
                      {published ? "Published" : "Unpublished"}
                    </StatusPill>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canEditTournament(row) ? (
                      <button type="button" className={actionBtn} onClick={() => setEditing(row)}>
                        Edit
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={actionBtn}
                      disabled={listedMut.isPending}
                      onClick={() => listedMut.mutate({ tournamentId: row.id, listed: !published })}
                    >
                      {published ? "Unpublish" : "Publish"}
                    </button>
                    {row.status === "open" ? (
                      <button
                        type="button"
                        className={actionBtn}
                        disabled={startMut.isPending}
                        onClick={() => startMut.mutate(row.id)}
                      >
                        Start bracket
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}

      <SlideOver
        open={editing != null}
        onClose={() => setEditing(null)}
        title={editing ? `Edit · ${editing.name}` : "Edit bracket"}
        description="Update name, size, and pool while the bracket is unpublished or not finished."
        size="md"
      >
        {editing ? (
          <TournamentEditForm
            key={editing.id}
            row={editing}
            pools={data.pools}
            saving={saveMut.isPending}
            onCancel={() => setEditing(null)}
            onSave={(payload) => saveMut.mutate(payload)}
          />
        ) : null}
      </SlideOver>
    </div>
  );
}

function TournamentEditForm({
  row,
  pools,
  saving,
  onCancel,
  onSave,
}: {
  row: TournamentRow;
  pools: AdminPlayData["pools"];
  saving: boolean;
  onCancel: () => void;
  onSave: (payload: {
    tournamentId: string;
    name: string;
    size: 4 | 8 | 16 | 32;
    poolId: string | null;
  }) => void;
}) {
  const [name, setName] = useState(row.name);
  const [size, setSize] = useState<4 | 8 | 16 | 32>(
    ([4, 8, 16, 32].includes(row.size) ? row.size : 8) as 4 | 8 | 16 | 32,
  );
  const [poolId, setPoolId] = useState(row.pool_id ?? "");

  return (
    <div className="space-y-4">
      <label className="block text-xs">
        Name
        <input
          className="field mt-1 h-9 w-full text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="block text-xs">
        Bracket size
        <select
          className="field mt-1 h-9 w-full text-sm"
          value={size}
          onChange={(e) => setSize(Number(e.target.value) as 4 | 8 | 16 | 32)}
        >
          <option value={4}>4</option>
          <option value={8}>8</option>
          <option value={16}>16</option>
          <option value={32}>32</option>
        </select>
      </label>
      <label className="block text-xs">
        Question pool
        <select
          className="field mt-1 h-9 w-full text-sm"
          value={poolId}
          onChange={(e) => setPoolId(e.target.value)}
        >
          <option value="">Default play pool</option>
          {pools.map((pool) => (
            <option key={pool.id} value={pool.id}>
              {pool.courseName} · {pool.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <button type="button" className={actionBtn} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          disabled={saving || name.trim().length < 2}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
          onClick={() =>
            onSave({
              tournamentId: row.id,
              name: name.trim(),
              size,
              poolId: poolId || null,
            })
          }
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
