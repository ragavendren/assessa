import { AdminEmpty } from "@/components/admin/AdminPageUi";
import type { AdminPlayData } from "@/components/admin/play/PlayControlPanel";
import { PulseShareCard } from "@/components/play/PulseShareCard";
import { createPlayPulse, deletePlayPulse, setPulseListed } from "@/lib/play.pulse.functions";
import type { PulseRevealMode, PulseSlideInput, PulseSlideType } from "@/lib/play.pulse";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

const actionBtn =
  "inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-60";

/** Inline create + recent list — same pattern as Live Arena lobby create in Configure. */
export function PulsePanel({
  data,
  showManagedList = true,
}: {
  data: AdminPlayData;
  showManagedList?: boolean;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createFn = useServerFn(createPlayPulse);
  const listedFn = useServerFn(setPulseListed);
  const deleteFn = useServerFn(deletePlayPulse);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-play"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-pulses"] });
  };

  const createMut = useMutation({
    mutationFn: (payload: {
      name: string;
      revealMode: PulseRevealMode;
      slides: PulseSlideInput[];
    }) => createFn({ data: payload }),
    onSuccess: (result) => {
      toast.success(`Pulse created · code ${result.joinCode}`);
      invalidate();
      void navigate({ to: "/admin/play/pulse/$pulseId", params: { pulseId: result.pulseId } });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not create"),
  });

  const listedMut = useMutation({
    mutationFn: (payload: { pulseId: string; listed: boolean }) => listedFn({ data: payload }),
    onSuccess: (_d, vars) => {
      toast.success(vars.listed ? "Published to Play" : "Unpublished from Play");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update"),
  });

  const deleteMut = useMutation({
    mutationFn: (pulseId: string) => deleteFn({ data: { pulseId } }),
    onSuccess: () => {
      toast.success("Pulse deleted");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not delete"),
  });

  return (
    <div className="space-y-5">
      <PulseCreateForm
        saving={createMut.isPending}
        onSave={(payload) => createMut.mutate(payload)}
      />

      {showManagedList ? (
        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-sm font-semibold">Recent pulses</p>
          {data.pulses.length === 0 ? (
            <AdminEmpty
              title="No pulses yet"
              body="Create one above, then open Host to run slides and share the join code."
            />
          ) : (
            <ul className="space-y-2">
              {data.pulses.slice(0, 8).map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Code {row.joinCode} · {row.status} · reveal {row.revealMode}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Link
                      to="/admin/play/pulse/$pulseId"
                      params={{ pulseId: row.id }}
                      className={cn(actionBtn, "text-accent")}
                    >
                      Host
                    </Link>
                    <button
                      type="button"
                      className={actionBtn}
                      disabled={listedMut.isPending}
                      onClick={() => listedMut.mutate({ pulseId: row.id, listed: !row.listed })}
                    >
                      {row.listed ? "Unpublish" : "Publish"}
                    </button>
                    <button
                      type="button"
                      className={cn(actionBtn, "text-destructive")}
                      disabled={deleteMut.isPending}
                      onClick={() => {
                        if (window.confirm(`Delete “${row.name}”?`)) deleteMut.mutate(row.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                  {row.listed ? (
                    <div className="w-full">
                      <PulseShareCard
                        pulseId={row.id}
                        pulseName={row.name}
                        joinCode={row.joinCode}
                        compact
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Open{" "}
            <Link to="/admin/play/live-pulse" className="text-accent underline">
              List pulses
            </Link>{" "}
            to publish, host, and manage all sessions.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function PulseCreateForm({
  saving,
  onCancel,
  onSave,
}: {
  saving: boolean;
  onCancel?: () => void;
  onSave: (payload: {
    name: string;
    revealMode: PulseRevealMode;
    slides: PulseSlideInput[];
  }) => void;
}) {
  const [name, setName] = useState("Pulse session");
  const [revealMode, setRevealMode] = useState<PulseRevealMode>("host");
  const [slides, setSlides] = useState<PulseSlideInput[]>([
    { type: "mcq", prompt: "", options: ["Option A", "Option B"], ratingMax: 5 },
  ]);

  function updateSlide(index: number, patch: Partial<PulseSlideInput>) {
    setSlides((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

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
      <fieldset>
        <legend className="text-xs font-medium">Reveal mode</legend>
        <div className="mt-2 space-y-2 text-sm">
          {(
            [
              ["live", "Live — wall updates as each response arrives"],
              ["all_in", "All in — wall opens when every participant has answered"],
              ["host", "Host — wall opens only when you press Reveal"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-start gap-2">
              <input
                type="radio"
                name="reveal"
                checked={revealMode === value}
                onChange={() => setRevealMode(value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Slides</p>
          <button
            type="button"
            className={actionBtn}
            onClick={() =>
              setSlides((prev) => [
                ...prev,
                { type: "mcq", prompt: "", options: ["Option A", "Option B"], ratingMax: 5 },
              ])
            }
          >
            Add slide
          </button>
        </div>
        {slides.map((slide, index) => (
          <article key={index} className="space-y-2 rounded-xl border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Slide {index + 1}
              </p>
              <button
                type="button"
                className={actionBtn}
                disabled={slides.length <= 1}
                onClick={() => setSlides((prev) => prev.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
            <label className="block text-xs">
              Type
              <select
                className="field mt-1 h-9 w-full text-sm"
                value={slide.type}
                onChange={(e) => updateSlide(index, { type: e.target.value as PulseSlideType })}
              >
                <option value="mcq">Multiple choice</option>
                <option value="text">Open text</option>
                <option value="rating">Rating (1–5)</option>
              </select>
            </label>
            <label className="block text-xs">
              Prompt
              <textarea
                className="field mt-1 min-h-[4rem] w-full text-sm"
                value={slide.prompt}
                onChange={(e) => updateSlide(index, { prompt: e.target.value })}
              />
            </label>
            <label className="block text-xs">
              Image URL (optional)
              <input
                className="field mt-1 h-9 w-full text-sm"
                value={slide.imageUrl ?? ""}
                onChange={(e) => updateSlide(index, { imageUrl: e.target.value })}
                placeholder="https://…"
              />
            </label>
            {slide.type === "mcq" ? (
              <label className="block text-xs">
                Options (one per line)
                <textarea
                  className="field mt-1 min-h-[5rem] w-full text-sm"
                  value={(slide.options ?? []).join("\n")}
                  onChange={(e) =>
                    updateSlide(index, {
                      options: e.target.value
                        .split("\n")
                        .map((l) => l.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
            ) : null}
            {slide.type === "rating" ? (
              <p className="text-xs text-muted-foreground">Participants rate from 1 to 5.</p>
            ) : null}
          </article>
        ))}
      </div>

      <div className="flex justify-end gap-2 border-t border-border pt-3">
        {onCancel ? (
          <button type="button" className={actionBtn} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button
          type="button"
          disabled={saving || name.trim().length < 2 || slides.some((s) => !s.prompt.trim())}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
          onClick={() =>
            onSave({
              name: name.trim(),
              revealMode,
              slides: slides.map((s) => ({
                ...s,
                ratingMax: 5,
                imageUrl: s.imageUrl?.trim() || null,
              })),
            })
          }
        >
          {saving ? "Creating…" : "Create Pulse"}
        </button>
      </div>
    </div>
  );
}
