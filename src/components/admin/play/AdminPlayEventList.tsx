import { AdminPageHeader, ResultCount, StatusPill } from "@/components/admin/AdminPageUi";
import { EscapePanel, type AdminPlayData } from "@/components/admin/play/PlayControlPanel";
import { ArenaShareCard } from "@/components/play/ArenaShareCard";
import { ListToolbar, useListViewMode } from "@/components/ListToolbar";
import { EmptyState, PageLoader } from "@/components/platform";
import { SlideOver } from "@/components/ui/slide-over";
import {
  declareTournamentWinner,
  deleteLiveArena,
  getTournamentDetail,
  removeTournamentEntrant,
  setEscapeStatus,
  setLiveArenaListed,
  setTournamentListed,
  setTournamentMatchSlot,
  startPlayTournament,
  updateLiveArena,
  updatePlayTournament,
} from "@/lib/play.functions";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  const [managing, setManaging] = useState<TournamentRow | null>(null);

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
      if (managing) {
        void queryClient.invalidateQueries({ queryKey: ["admin-tournament", managing.id] });
      }
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
          label: "Publish & manage",
          body: "Publish so players can join. Use Manage to override slots by email, force winners when nobody plays, and advance the bracket.",
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
                          <button
                            type="button"
                            className={actionBtn}
                            onClick={() => setManaging(row)}
                          >
                            Manage
                          </button>
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
                    <button type="button" className={actionBtn} onClick={() => setManaging(row)}>
                      Manage
                    </button>
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

      <SlideOver
        open={managing != null}
        onClose={() => setManaging(null)}
        title={managing ? `Manage · ${managing.name}` : "Manage bracket"}
        description="Override slots by email, remove entrants, and force winners so the bracket can advance when players do not play."
        size="xl"
      >
        {managing ? (
          <TournamentManagePanel
            key={managing.id}
            tournamentId={managing.id}
            onStarted={() => startMut.mutate(managing.id)}
            starting={startMut.isPending}
          />
        ) : null}
      </SlideOver>
    </div>
  );
}

function TournamentManagePanel({
  tournamentId,
  onStarted,
  starting,
}: {
  tournamentId: string;
  onStarted: () => void;
  starting: boolean;
}) {
  const queryClient = useQueryClient();
  const fetchT = useServerFn(getTournamentDetail);
  const removeEntrant = useServerFn(removeTournamentEntrant);
  const setSlot = useServerFn(setTournamentMatchSlot);
  const declareWinner = useServerFn(declareTournamentWinner);

  const { data, isPending, refetch } = useQuery({
    queryKey: ["admin-tournament", tournamentId],
    queryFn: () => fetchT({ data: { tournamentId } }),
    refetchInterval: 4000,
  });

  const invalidate = () => {
    void refetch();
    void queryClient.invalidateQueries({ queryKey: ["admin-play"] });
  };

  const removeMut = useMutation({
    mutationFn: (entrantUserId: string) => removeEntrant({ data: { tournamentId, entrantUserId } }),
    onSuccess: () => {
      toast.success("Entrant removed");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not remove"),
  });

  const slotMut = useMutation({
    mutationFn: (payload: {
      tournamentMatchId: string;
      playerAEmail?: string | null;
      playerBEmail?: string | null;
      playerAId?: string | null;
      playerBId?: string | null;
    }) => setSlot({ data: payload }),
    onSuccess: () => {
      toast.success("Slot updated");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update slot"),
  });

  const winnerMut = useMutation({
    mutationFn: (payload: { tournamentMatchId: string; winnerId: string | null }) =>
      declareWinner({ data: payload }),
    onSuccess: () => {
      toast.success("Winner set — bracket advanced");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not advance"),
  });

  if (isPending || !data) return <PageLoader label="Loading bracket…" />;

  const { tournament, entrants, matches } = data;
  const openMatches = matches.filter((m) => m.status !== "complete");

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
        {tournament.size}-player · {tournament.status} · {entrants.length} entrants · players are
        identified by name and email. Empty slots become byes when you start; use Force winner to
        move the bracket when nobody plays.
      </div>

      {tournament.status === "open" ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
            disabled={starting || entrants.length < 2}
            onClick={onStarted}
          >
            {starting ? "Starting…" : "Start bracket"}
          </button>
        </div>
      ) : null}

      <section aria-labelledby="admin-entrants">
        <h3 id="admin-entrants" className="text-sm font-semibold">
          Entrants
        </h3>
        {entrants.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No entrants yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {entrants.map((e) => (
              <li
                key={e.userId}
                className="flex items-start justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">{e.name}</p>
                  {e.email ? <p className="text-xs text-muted-foreground">{e.email}</p> : null}
                </div>
                {tournament.status === "open" ? (
                  <button
                    type="button"
                    className={actionBtn}
                    disabled={removeMut.isPending}
                    onClick={() => removeMut.mutate(e.userId)}
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="admin-matches" className="space-y-3">
        <h3 id="admin-matches" className="text-sm font-semibold">
          Matches ({openMatches.length} open)
        </h3>
        {matches.length === 0 ? (
          <p className="text-xs text-muted-foreground">Start the bracket to seed match slots.</p>
        ) : (
          matches.map((match) => (
            <AdminMatchCard
              key={match.id}
              match={match}
              entrants={entrants}
              busy={slotMut.isPending || winnerMut.isPending}
              onSetEmails={(playerAEmail, playerBEmail) =>
                slotMut.mutate({
                  tournamentMatchId: match.id,
                  playerAEmail,
                  playerBEmail,
                })
              }
              onClearSide={(side) =>
                slotMut.mutate({
                  tournamentMatchId: match.id,
                  ...(side === "a" ? { playerAId: null } : { playerBId: null }),
                })
              }
              onPickEntrant={(side, userId) =>
                slotMut.mutate({
                  tournamentMatchId: match.id,
                  ...(side === "a" ? { playerAId: userId } : { playerBId: userId }),
                })
              }
              onDeclare={(winnerId) => winnerMut.mutate({ tournamentMatchId: match.id, winnerId })}
            />
          ))
        )}
      </section>
    </div>
  );
}

function AdminMatchCard({
  match,
  entrants,
  busy,
  onSetEmails,
  onClearSide,
  onPickEntrant,
  onDeclare,
}: {
  match: {
    id: string;
    round: number;
    slot: number;
    status: string;
    playerA: { id: string; name: string; email: string | null } | null;
    playerB: { id: string; name: string; email: string | null } | null;
    winner: { id: string; name: string; email: string | null } | null;
  };
  entrants: Array<{ userId: string; name: string; email: string | null }>;
  busy: boolean;
  onSetEmails: (a: string | null, b: string | null) => void;
  onClearSide: (side: "a" | "b") => void;
  onPickEntrant: (side: "a" | "b", userId: string | null) => void;
  onDeclare: (winnerId: string | null) => void;
}) {
  const [emailA, setEmailA] = useState(match.playerA?.email ?? "");
  const [emailB, setEmailB] = useState(match.playerB?.email ?? "");
  const complete = match.status === "complete";

  return (
    <article className="rounded-xl border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          Round {match.round + 1} · Match {match.slot + 1}
        </p>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {match.status}
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <SlotEditor
          label="Player A"
          name={match.playerA?.name}
          email={emailA}
          onEmailChange={setEmailA}
          entrants={entrants}
          disabled={complete || busy}
          onPick={(id) => onPickEntrant("a", id)}
          onClear={() => onClearSide("a")}
        />
        <SlotEditor
          label="Player B"
          name={match.playerB?.name}
          email={emailB}
          onEmailChange={setEmailB}
          entrants={entrants}
          disabled={complete || busy}
          onPick={(id) => onPickEntrant("b", id)}
          onClear={() => onClearSide("b")}
        />
      </div>

      {!complete ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={actionBtn}
            disabled={busy}
            onClick={() => onSetEmails(emailA.trim() || null, emailB.trim() || null)}
          >
            Apply emails
          </button>
          {match.playerA ? (
            <button
              type="button"
              className={actionBtn}
              disabled={busy}
              onClick={() => onDeclare(match.playerA!.id)}
            >
              Force A wins
            </button>
          ) : null}
          {match.playerB ? (
            <button
              type="button"
              className={actionBtn}
              disabled={busy}
              onClick={() => onDeclare(match.playerB!.id)}
            >
              Force B wins
            </button>
          ) : null}
          {(match.playerA || match.playerB) && !(match.playerA && match.playerB) ? (
            <button
              type="button"
              className={actionBtn}
              disabled={busy}
              onClick={() => onDeclare(null)}
            >
              Advance bye
            </button>
          ) : null}
        </div>
      ) : match.winner ? (
        <p className="mt-3 text-xs text-muted-foreground" role="status">
          Winner: {match.winner.name}
          {match.winner.email ? ` · ${match.winner.email}` : ""}
        </p>
      ) : null}
    </article>
  );
}

function SlotEditor({
  label,
  name,
  email,
  onEmailChange,
  entrants,
  disabled,
  onPick,
  onClear,
}: {
  label: string;
  name?: string | undefined;
  email: string;
  onEmailChange: (v: string) => void;
  entrants: Array<{ userId: string; name: string; email: string | null }>;
  disabled?: boolean;
  onPick: (userId: string | null) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border/70 bg-secondary/10 p-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-medium">{name ?? "Empty"}</p>
      <label className="block text-xs">
        Email
        <input
          type="email"
          className="field mt-1 h-8 w-full text-xs"
          value={email}
          disabled={disabled}
          onChange={(e) => onEmailChange(e.target.value)}
          autoComplete="off"
          placeholder="player@example.com"
        />
      </label>
      <label className="block text-xs">
        Or pick entrant
        <select
          className="field mt-1 h-8 w-full text-xs"
          disabled={disabled}
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            onPick(v);
            e.target.value = "";
          }}
        >
          <option value="">Select…</option>
          {entrants.map((e) => (
            <option key={e.userId} value={e.userId}>
              {e.name}
              {e.email ? ` · ${e.email}` : ""}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className={actionBtn} disabled={disabled} onClick={onClear}>
        Clear slot
      </button>
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
