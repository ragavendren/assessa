import type { PulseResponsePayload, PulseSectionGroup } from "@/lib/play.pulse";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

export type PulsePlayerSlide = {
  index: number;
  type: "mcq" | "multi" | "text" | "rating" | "matrix" | "section";
  prompt: string;
  imageUrl: string | null;
  options: string[];
  ratingMax: number;
};

type Props = {
  pulseName: string;
  sections: PulseSectionGroup[];
  slides: PulsePlayerSlide[];
  /** Already-submitted answers (after final submit). */
  myResponses: Record<number, PulseResponsePayload>;
  answerableCount: number;
  canAnswer: boolean;
  submitting: boolean;
  onSubmitAll: (
    answers: Array<{ slideIndex: number; response: PulseResponsePayload }>,
  ) => Promise<void> | void;
};

function hasAnswer(payload: PulseResponsePayload | undefined | null) {
  if (payload == null) return false;
  if ("text" in payload) return payload.text.trim().length > 0;
  if ("choiceIndexes" in payload) return payload.choiceIndexes.length > 0;
  if ("ratings" in payload)
    return payload.ratings.length > 0 && payload.ratings.every((r) => r >= 1);
  if ("choiceIndex" in payload) return true;
  if ("rating" in payload) return true;
  return false;
}

export function PulseSelfPacedForm({
  pulseName,
  sections,
  slides,
  myResponses,
  answerableCount,
  canAnswer,
  submitting,
  onSubmitAll,
}: Props) {
  const [sectionPos, setSectionPos] = useState(0);
  const [drafts, setDrafts] = useState<Record<number, PulseResponsePayload>>({});
  const [draftOther, setDraftOther] = useState<Record<number, string>>({});
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Seed drafts from server only when already submitted (read-only review).
  useEffect(() => {
    const keys = Object.keys(myResponses);
    if (keys.length >= answerableCount && answerableCount > 0) {
      setDrafts(myResponses);
      setSubmitted(true);
    }
  }, [myResponses, answerableCount]);

  const section = sections[sectionPos] ?? null;
  const editable = canAnswer && !submitted;

  const answerFor = (index: number) => drafts[index] ?? myResponses[index];

  const draftedCount = useMemo(() => {
    return slides.filter(
      (s) => s.type !== "section" && hasAnswer(drafts[s.index] ?? myResponses[s.index]),
    ).length;
  }, [slides, drafts, myResponses]);

  const progressPct = answerableCount > 0 ? Math.round((draftedCount / answerableCount) * 100) : 0;

  const sectionQuestions = useMemo(() => {
    if (!section) return [];
    return section.questionIndexes
      .map((i) => slides.find((s) => s.index === i))
      .filter((s): s is PulsePlayerSlide => Boolean(s));
  }, [section, slides]);

  const sectionComplete = sectionQuestions.every((q) => hasAnswer(answerFor(q.index)));

  function setAnswer(slideIndex: number, response: PulseResponsePayload) {
    setDrafts((prev) => ({ ...prev, [slideIndex]: response }));
    setLocalError(null);
  }

  function goNext() {
    setLocalError(null);
    if (!section) return;
    const missing = sectionQuestions.filter((q) => !hasAnswer(answerFor(q.index)));
    if (missing.length && editable) {
      setLocalError(`Answer all questions in this section (${missing.length} left).`);
      return;
    }
    if (sectionPos < sections.length - 1) {
      setSectionPos((p) => p + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function finishSurvey() {
    setLocalError(null);
    const questions = slides.filter((s) => s.type !== "section");
    const missing = questions.filter((q) => !hasAnswer(answerFor(q.index)));
    if (missing.length) {
      setLocalError(`Answer all questions before submitting (${missing.length} left).`);
      // Jump to first incomplete section
      const firstMissing = missing[0]!.index;
      const secIdx = sections.findIndex((s) => s.questionIndexes.includes(firstMissing));
      if (secIdx >= 0) setSectionPos(secIdx);
      return;
    }
    const answers = questions.map((q) => ({
      slideIndex: q.index,
      response: answerFor(q.index)!,
    }));
    await onSubmitAll(answers);
    setSubmitted(true);
  }

  const isLast = sectionPos >= sections.length - 1;

  return (
    <div className="space-y-5">
      <header className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-teal-500/10 via-card to-amber-500/10 p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-300">
          Self-paced survey
        </p>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl">{pulseName}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {submitted
            ? "Your responses have been submitted. Thank you."
            : "Work through each section, then submit all answers at the end."}
        </p>
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
            <span>
              {draftedCount}/{answerableCount} questions filled
            </span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-teal-600 transition-[width] duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
        {sections.length > 1 ? (
          <ol className="mt-4 flex flex-wrap gap-1.5">
            {sections.map((s, i) => {
              const done = s.questionIndexes.every((qi) => hasAnswer(answerFor(qi)));
              return (
                <li key={`${s.title}-${i}`}>
                  <button
                    type="button"
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                      i === sectionPos
                        ? "bg-teal-700 text-white"
                        : done
                          ? "bg-teal-500/20 text-teal-900 dark:text-teal-200"
                          : "bg-secondary text-muted-foreground",
                    )}
                    onClick={() => {
                      if (
                        i <= sectionPos ||
                        sections
                          .slice(0, i)
                          .every((prev) =>
                            prev.questionIndexes.every((qi) => hasAnswer(answerFor(qi))),
                          )
                      ) {
                        setSectionPos(i);
                        setLocalError(null);
                      }
                    }}
                  >
                    {i + 1}. {s.title.length > 28 ? `${s.title.slice(0, 28)}…` : s.title}
                  </button>
                </li>
              );
            })}
          </ol>
        ) : null}
      </header>

      {section ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-teal-600/20 bg-teal-500/5 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-300">
              Section {sectionPos + 1} of {sections.length}
            </p>
            <h2 className="mt-0.5 text-lg font-semibold">{section.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {sectionQuestions.length} question{sectionQuestions.length === 1 ? "" : "s"}
              {sectionComplete ? " · complete" : ""}
            </p>
          </div>

          {sectionQuestions.map((q, qn) => (
            <QuestionCard
              key={q.index}
              ordinal={qn + 1}
              slide={q}
              value={answerFor(q.index)}
              otherText={draftOther[q.index] ?? ""}
              setOtherText={(v) => setDraftOther((d) => ({ ...d, [q.index]: v }))}
              canEdit={editable}
              disabled={submitting}
              onChange={(response) => setAnswer(q.index, response)}
            />
          ))}

          {localError ? (
            <p className="text-sm text-amber-700 dark:text-amber-300" role="alert">
              {localError}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <button
              type="button"
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"
              disabled={sectionPos === 0}
              onClick={() => {
                setSectionPos((p) => Math.max(0, p - 1));
                setLocalError(null);
              }}
            >
              Previous section
            </button>
            {!isLast ? (
              <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                disabled={submitting}
                onClick={goNext}
              >
                Next section
              </button>
            ) : editable ? (
              <button
                type="button"
                className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                disabled={submitting}
                onClick={() => void finishSurvey()}
              >
                {submitting ? "Submitting…" : "Submit all responses"}
              </button>
            ) : (
              <p className="text-sm text-muted-foreground">
                {submitted ? "Submitted" : "Survey closed."}
              </p>
            )}
          </div>
        </section>
      ) : (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No sections available yet.
        </p>
      )}
    </div>
  );
}

function QuestionCard({
  ordinal,
  slide,
  value,
  otherText,
  setOtherText,
  canEdit,
  disabled,
  onChange,
}: {
  ordinal: number;
  slide: PulsePlayerSlide;
  value?: PulseResponsePayload;
  otherText: string;
  setOtherText: (v: string) => void;
  canEdit: boolean;
  disabled: boolean;
  onChange: (response: PulseResponsePayload) => void;
}) {
  const answered = value != null;
  const otherIdx = slide.options.findIndex((o) => /^other\b/i.test(o));
  const multiIndexes = value && "choiceIndexes" in value ? value.choiceIndexes : ([] as number[]);

  return (
    <article
      className={cn(
        "space-y-3 rounded-2xl border bg-card p-4 shadow-sm transition-colors",
        answered ? "border-teal-600/30" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Q{ordinal} · {slide.type}
          </p>
          <h3 className="mt-1 text-base font-semibold leading-snug">{slide.prompt}</h3>
        </div>
        {answered ? (
          <span className="shrink-0 rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-semibold text-teal-800 dark:text-teal-200">
            Filled
          </span>
        ) : null}
      </div>
      {slide.imageUrl ? (
        <img src={slide.imageUrl} alt="" className="max-h-48 w-full rounded-xl object-cover" />
      ) : null}

      {slide.type === "mcq" ? (
        <ul className="space-y-2">
          {slide.options.map((opt, index) => {
            const selected = value && "choiceIndex" in value && value.choiceIndex === index;
            return (
              <li key={`${opt}-${index}`}>
                <button
                  type="button"
                  disabled={!canEdit || disabled}
                  className={cn(
                    "w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                    selected ? "border-teal-600 bg-teal-500/10 font-medium" : "border-border",
                    canEdit && "hover:bg-secondary",
                  )}
                  onClick={() => onChange({ choiceIndex: index })}
                >
                  {opt}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {slide.type === "rating" ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: slide.ratingMax }, (_, i) => i + 1).map((rating) => {
            const selected = value && "rating" in value && value.rating === rating;
            return (
              <button
                key={rating}
                type="button"
                disabled={!canEdit || disabled}
                className={cn(
                  "h-11 w-11 rounded-full border text-sm font-semibold transition-colors",
                  selected ? "border-teal-600 bg-teal-500/15" : "border-border",
                  canEdit && "hover:bg-secondary",
                )}
                onClick={() => onChange({ rating })}
              >
                {rating}
              </button>
            );
          })}
        </div>
      ) : null}

      {slide.type === "multi" ? (
        <div className="space-y-3">
          <ul className="space-y-2">
            {slide.options.map((opt, index) => {
              const checked = multiIndexes.includes(index);
              return (
                <li key={`${opt}-${index}`}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2.5 text-sm",
                      checked ? "border-teal-600 bg-teal-500/10" : "border-border",
                      !canEdit && "opacity-70",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      disabled={!canEdit || disabled}
                      checked={checked}
                      onChange={() => {
                        const next = checked
                          ? multiIndexes.filter((i) => i !== index)
                          : [...multiIndexes, index];
                        onChange({
                          choiceIndexes: next,
                          ...(otherText.trim() ? { otherText: otherText.trim() } : {}),
                        });
                      }}
                    />
                    <span>{opt}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          {otherIdx >= 0 && multiIndexes.includes(otherIdx) ? (
            <input
              className="field h-9 w-full text-sm"
              disabled={!canEdit}
              value={
                otherText || (value && "choiceIndexes" in value ? (value.otherText ?? "") : "")
              }
              maxLength={200}
              placeholder="Please specify…"
              onChange={(e) => {
                setOtherText(e.target.value);
                onChange({
                  choiceIndexes: multiIndexes,
                  ...(e.target.value.trim() ? { otherText: e.target.value.trim() } : {}),
                });
              }}
            />
          ) : null}
        </div>
      ) : null}

      {slide.type === "matrix" ? (
        <MatrixDraft
          slide={slide}
          value={value && "ratings" in value ? value.ratings : null}
          canEdit={canEdit}
          disabled={disabled}
          onChange={onChange}
        />
      ) : null}

      {slide.type === "text" ? (
        <textarea
          className="field min-h-[5rem] w-full text-sm"
          disabled={!canEdit || disabled}
          maxLength={2000}
          value={value && "text" in value ? value.text : ""}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Type your response…"
        />
      ) : null}
    </article>
  );
}

function MatrixDraft({
  slide,
  value,
  canEdit,
  disabled,
  onChange,
}: {
  slide: PulsePlayerSlide;
  value: number[] | null;
  canEdit: boolean;
  disabled: boolean;
  onChange: (response: PulseResponsePayload) => void;
}) {
  const [partial, setPartial] = useState<Array<number | null>>(
    () => value ?? slide.options.map(() => null),
  );

  useEffect(() => {
    if (value) setPartial(value);
  }, [value]);

  return (
    <div className="space-y-3">
      {slide.options.map((rowLabel, rowIndex) => (
        <fieldset key={`${rowLabel}-${rowIndex}`}>
          <legend className="mb-1.5 text-sm font-medium">{rowLabel}</legend>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: slide.ratingMax }, (_, i) => i + 1).map((rating) => {
              const selected = partial[rowIndex] === rating;
              return (
                <button
                  key={rating}
                  type="button"
                  disabled={!canEdit || disabled}
                  className={cn(
                    "h-9 w-9 rounded-md border text-xs font-semibold",
                    selected ? "border-teal-600 bg-teal-500/15" : "border-border",
                  )}
                  onClick={() => {
                    const next = [...partial];
                    while (next.length < slide.options.length) next.push(null);
                    next[rowIndex] = rating;
                    setPartial(next);
                    if (next.every((r) => r != null)) {
                      onChange({ ratings: next as number[] });
                    }
                  }}
                >
                  {rating}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
