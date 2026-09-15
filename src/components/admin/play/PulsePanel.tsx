import { AdminEmpty } from "@/components/admin/AdminPageUi";
import type { AdminPlayData } from "@/components/admin/play/PlayControlPanel";
import { PulseSlidePreview } from "@/components/admin/play/PulseSlidePreview";
import { PulseShareCard } from "@/components/play/PulseShareCard";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { createPlayPulse, deletePlayPulse, setPulseListed } from "@/lib/play.pulse.functions";
import type { PulseRevealMode, PulseSlideInput, PulseSlideType } from "@/lib/play.pulse";
import {
  downloadPulseSurveyTemplate,
  parsePulseSurveyImport,
  PULSE_SURVEY_TEMPLATE_INSTRUCTIONS,
} from "@/lib/play.pulse.survey";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";

const actionBtn =
  "inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-60";

const TYPE_LABELS: Record<PulseSlideType, string> = {
  mcq: "Multiple choice (single)",
  multi: "Multi-select",
  text: "Open text",
  rating: "Rating scale",
  matrix: "Matrix / grid",
  section: "Section (groups following questions)",
};

function blankSlide(type: PulseSlideType = "mcq"): PulseSlideInput {
  if (type === "mcq" || type === "multi") {
    return { type, prompt: "", options: ["Option A", "Option B"], ratingMax: 5 };
  }
  if (type === "matrix") {
    return {
      type,
      prompt: "",
      options: ["Row 1", "Row 2"],
      ratingMax: 5,
    };
  }
  if (type === "rating") {
    return { type, prompt: "", options: [], ratingMax: 10 };
  }
  return { type, prompt: "", options: [], ratingMax: 5 };
}

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
  const confirm = useConfirm();
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
                        void (async () => {
                          const ok = await confirm({
                            title: `Delete “${row.name}”?`,
                            description: "This removes the Pulse and all participant responses.",
                            confirmLabel: "Delete",
                            tone: "destructive",
                          });
                          if (ok) deleteMut.mutate(row.id);
                        })();
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("Pulse session");
  const [revealMode, setRevealMode] = useState<PulseRevealMode>("self");
  const [slides, setSlides] = useState<PulseSlideInput[]>([blankSlide("mcq")]);
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showTemplateHelp, setShowTemplateHelp] = useState(false);
  const [showPreviews, setShowPreviews] = useState(true);

  function updateSlide(index: number, patch: Partial<PulseSlideInput>) {
    setSlides((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        if (patch.type && patch.type !== s.type) {
          const next = blankSlide(patch.type);
          next.prompt = s.prompt;
          if (s.imageUrl) next.imageUrl = s.imageUrl;
          return next;
        }
        return { ...s, ...patch };
      }),
    );
  }

  function applyImport(raw: string) {
    const result = parsePulseSurveyImport(raw);
    if (!result.slides.length) {
      toast.error(result.warnings[0] ?? "Could not parse survey.");
      return;
    }
    setSlides(result.slides);
    if (result.name) setName(result.name);
    setShowPreviews(true);
    for (const w of result.warnings) toast.message(w);
    toast.success(`Imported ${result.slides.length} slides`);
    setShowImport(false);
    setImportText("");
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
              [
                "self",
                "Self-paced — participants fill section-by-section with Next (no host slide control)",
              ],
              ["live", "Live — wall updates as each response arrives (host advances slides)"],
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

      <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Upload survey</p>
            <p className="text-xs text-muted-foreground">
              Download a template, follow the format notes, then paste or upload to create slides.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className={actionBtn}
              onClick={() => downloadPulseSurveyTemplate("txt")}
            >
              Download TXT
            </button>
            <button
              type="button"
              className={actionBtn}
              onClick={() => downloadPulseSurveyTemplate("csv")}
            >
              Download CSV
            </button>
            <button
              type="button"
              className={actionBtn}
              onClick={() => downloadPulseSurveyTemplate("json")}
            >
              Download JSON
            </button>
            <button
              type="button"
              className={actionBtn}
              onClick={() => setShowTemplateHelp((v) => !v)}
            >
              {showTemplateHelp ? "Hide instructions" : "Template instructions"}
            </button>
            <button type="button" className={actionBtn} onClick={() => setShowImport((v) => !v)}>
              {showImport ? "Hide paste" : "Paste text"}
            </button>
            <button type="button" className={actionBtn} onClick={() => fileRef.current?.click()}>
              Upload file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.csv,.json,text/plain,text/csv,application/json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  const text = await file.text();
                  applyImport(text);
                } catch {
                  toast.error("Could not read file.");
                }
              }}
            />
          </div>
        </div>

        {showTemplateHelp ? (
          <div className="mt-3 space-y-2 rounded-lg border border-border bg-card/80 p-3">
            <p className="text-xs font-semibold">How to fill the template</p>
            <ol className="list-decimal space-y-1.5 pl-4 text-xs text-muted-foreground">
              {PULSE_SURVEY_TEMPLATE_INSTRUCTIONS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground">
              Tip: download{" "}
              <button
                type="button"
                className="text-accent underline"
                onClick={() => downloadPulseSurveyTemplate("txt")}
              >
                TXT
              </button>
              ,{" "}
              <button
                type="button"
                className="text-accent underline"
                onClick={() => downloadPulseSurveyTemplate("csv")}
              >
                CSV
              </button>
              , or{" "}
              <button
                type="button"
                className="text-accent underline"
                onClick={() => downloadPulseSurveyTemplate("json")}
              >
                JSON
              </button>{" "}
              templates, then paste or upload.
            </p>
          </div>
        ) : null}

        {showImport ? (
          <div className="mt-3 space-y-2">
            <textarea
              className="field min-h-[10rem] w-full font-mono text-xs"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={`Employee Office Experience Survey\nSection 1 — Overall Experience\n1. On a scale of 1–10, how happy are you…\nScale: 1 = Very unhappy | 10 = Extremely happy\n3. How often…\nAlways\nOften\n…`}
            />
            <button
              type="button"
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
              disabled={!importText.trim()}
              onClick={() => applyImport(importText)}
            >
              Parse &amp; replace slides
            </button>
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">Slides ({slides.length})</p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={actionBtn} onClick={() => setShowPreviews((v) => !v)}>
              {showPreviews ? "Hide previews" : "Show previews"}
            </button>
            <button
              type="button"
              className={actionBtn}
              onClick={() => setSlides((prev) => [...prev, blankSlide("mcq")])}
            >
              Add slide
            </button>
          </div>
        </div>
        {slides.map((slide, index) => (
          <article key={index} className="space-y-3 rounded-xl border border-border p-3">
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

            <div
              className={cn(
                "grid gap-3",
                showPreviews ? "lg:grid-cols-2 lg:items-start" : "grid-cols-1",
              )}
            >
              <div className="space-y-2">
                <label className="block text-xs">
                  Type
                  <select
                    className="field mt-1 h-9 w-full text-sm"
                    value={slide.type}
                    onChange={(e) => updateSlide(index, { type: e.target.value as PulseSlideType })}
                  >
                    {(Object.keys(TYPE_LABELS) as PulseSlideType[]).map((t) => (
                      <option key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs">
                  {slide.type === "section" ? "Section title" : "Prompt"}
                  <textarea
                    className="field mt-1 min-h-[4rem] w-full text-sm"
                    value={slide.prompt}
                    onChange={(e) => updateSlide(index, { prompt: e.target.value })}
                  />
                </label>
                {slide.type !== "section" ? (
                  <label className="block text-xs">
                    Image URL (optional)
                    <input
                      className="field mt-1 h-9 w-full text-sm"
                      value={slide.imageUrl ?? ""}
                      onChange={(e) => updateSlide(index, { imageUrl: e.target.value })}
                      placeholder="https://…"
                    />
                  </label>
                ) : null}
                {slide.type === "mcq" || slide.type === "multi" ? (
                  <label className="block text-xs">
                    Options (one per line)
                    {slide.type === "multi" ? " — include “Other” for a free-text field" : ""}
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
                {slide.type === "matrix" ? (
                  <>
                    <label className="block text-xs">
                      Rows (one aspect per line)
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
                    <label className="block text-xs">
                      Scale max (columns)
                      <select
                        className="field mt-1 h-9 w-full text-sm"
                        value={slide.ratingMax ?? 5}
                        onChange={(e) => updateSlide(index, { ratingMax: Number(e.target.value) })}
                      >
                        {[5, 7, 10].map((n) => (
                          <option key={n} value={n}>
                            1–{n}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                ) : null}
                {slide.type === "rating" ? (
                  <label className="block text-xs">
                    Scale
                    <select
                      className="field mt-1 h-9 w-full text-sm"
                      value={slide.ratingMax ?? 10}
                      onChange={(e) => updateSlide(index, { ratingMax: Number(e.target.value) })}
                    >
                      {[5, 7, 10].map((n) => (
                        <option key={n} value={n}>
                          1–{n}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {slide.type === "section" ? (
                  <p className="text-xs text-muted-foreground">
                    Groups the questions below into a participant segment. In self-paced mode they
                    see this title, answer those questions, then tap Next.
                  </p>
                ) : null}
                {slide.type === "text" ? (
                  <p className="text-xs text-muted-foreground">
                    Open-ended response (up to 2000 chars).
                  </p>
                ) : null}
              </div>

              {showPreviews ? (
                <PulseSlidePreview slide={slide} index={index} total={slides.length} />
              ) : null}
            </div>
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
                ratingMax: s.ratingMax ?? (s.type === "rating" ? 10 : 5),
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
