import { AdminNav } from "@/components/AdminNav";
import { SectionHeading } from "@/components/platform";
import { createExam } from "@/lib/admin.functions";
import { EXAM_MODES, MODE_LABELS } from "@/lib/gamification";
import { downloadQuestionCsvTemplate, parseQuestionsCsv } from "@/lib/questions-csv";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, Download, Eye, Plus, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/exams/new")({
  head: () => ({
    meta: [
      { title: "New assessment — Assessa" },
      {
        name: "description",
        content:
          "Create a course assessment: set topic, mode, duration, pass mark, availability window, and questions.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: NewExamPage,
});

type QuestionForm = {
  prompt: string;
  options: string[];
  correctIndexes: number[];
  multiSelect: boolean;
  subtopic: string;
  explanation: string;
};

const blankQuestion = (): QuestionForm => ({
  prompt: "",
  options: ["", "", "", ""],
  correctIndexes: [0],
  multiSelect: false,
  subtopic: "general",
  explanation: "",
});

const PREVIEW_PAGE_SIZE = 5;

function NewExamPage() {
  const navigate = useNavigate();
  const submit = useServerFn(createExam);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState<(typeof EXAM_MODES)[number]>("assessment");
  const [duration, setDuration] = useState(30);
  const [passMark, setPassMark] = useState(60);
  const [maxAttempts, setMaxAttempts] = useState(2);
  const [access, setAccess] = useState<"public" | "private" | "organization" | "group">("public");
  const [organization, setOrganization] = useState("");
  const [teamGroup, setTeamGroup] = useState("");
  const [invitations, setInvitations] = useState("");
  const [active, setActive] = useState(true);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [questions, setQuestions] = useState<QuestionForm[]>([blankQuestion()]);
  const [step, setStep] = useState<"edit" | "preview">("edit");
  const [previewPage, setPreviewPage] = useState(0);
  const [previewTopic, setPreviewTopic] = useState<string>("all");

  const topics = useMemo(() => {
    const set = new Set(questions.map((q) => q.subtopic.trim() || "general"));
    return ["all", ...[...set].sort((a, b) => a.localeCompare(b))];
  }, [questions]);

  const filteredPreview = useMemo(() => {
    if (previewTopic === "all") return questions;
    return questions.filter((q) => (q.subtopic.trim() || "general") === previewTopic);
  }, [previewTopic, questions]);

  const previewPages = Math.max(1, Math.ceil(filteredPreview.length / PREVIEW_PAGE_SIZE));
  const pageQuestions = filteredPreview.slice(
    previewPage * PREVIEW_PAGE_SIZE,
    previewPage * PREVIEW_PAGE_SIZE + PREVIEW_PAGE_SIZE,
  );

  const mutation = useMutation({
    mutationFn: () =>
      submit({
        data: {
          title,
          description,
          topic,
          mode,
          duration_minutes: duration,
          pass_mark: passMark,
          max_attempts: maxAttempts,
          access,
          organization,
          team_group: teamGroup,
          invitations,
          active,
          starts_at: startsAt ? new Date(startsAt).toISOString() : null,
          ends_at: endsAt ? new Date(endsAt).toISOString() : null,
          questions: questions.map((q) => {
            const options = q.options.filter((o) => o.trim().length > 0);
            const correctIndexes = q.correctIndexes
              .filter((index) => index < options.length)
              .sort((a, b) => a - b);
            return {
              prompt: q.prompt.trim(),
              options,
              correct_index: correctIndexes[0] ?? 0,
              correct_indexes: q.multiSelect ? correctIndexes : [correctIndexes[0] ?? 0],
              multi_select: q.multiSelect,
              subtopic: q.subtopic || "general",
              explanation: q.explanation,
            };
          }),
        },
      }),
    onSuccess: (result) => {
      toast.success("Assessment published");
      navigate({ to: "/admin" });
      if (result.examId) {
        void navigator.clipboard.writeText(`${window.location.origin}/take/${result.examId}`);
      }
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not create assessment"),
  });

  function patchQuestion(index: number, patch: Partial<QuestionForm>) {
    setQuestions((list) => list.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function toggleCorrect(questionIndex: number, optionIndex: number) {
    setQuestions((list) =>
      list.map((q, i) => {
        if (i !== questionIndex) return q;
        if (!q.multiSelect) return { ...q, correctIndexes: [optionIndex] };
        const exists = q.correctIndexes.includes(optionIndex);
        const next = exists
          ? q.correctIndexes.filter((value) => value !== optionIndex)
          : [...q.correctIndexes, optionIndex];
        return { ...q, correctIndexes: next.length ? next : [optionIndex] };
      }),
    );
  }

  function onCsvUpload(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const { questions: parsed, errors } = parseQuestionsCsv(text);
      if (errors.length) toast.error(errors[0] ?? "CSV has errors");
      if (parsed.length === 0) return;
      setQuestions(
        parsed.map((q) => ({
          prompt: q.prompt,
          options: q.options.length >= 4 ? q.options : [...q.options, "", ""].slice(0, 4),
          correctIndexes: q.correctIndexes,
          multiSelect: q.multiSelect,
          subtopic: q.subtopic,
          explanation: q.explanation,
        })),
      );
      toast.success(`Imported ${parsed.length} question(s)`);
    };
    reader.readAsText(file);
  }

  function validateBeforePreview() {
    if (title.trim().length < 3 || topic.trim().length < 2) {
      toast.error("Title and topic are required");
      return false;
    }
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
      toast.error("End date must be after the start date");
      return false;
    }
    for (const [index, q] of questions.entries()) {
      if (q.prompt.trim().length < 4) {
        toast.error(`Question ${index + 1} needs a prompt`);
        return false;
      }
      const options = q.options.filter((o) => o.trim());
      if (options.length < 2) {
        toast.error(`Question ${index + 1} needs at least two options`);
        return false;
      }
      if (q.correctIndexes.length === 0) {
        toast.error(`Question ${index + 1} needs a correct answer`);
        return false;
      }
    }
    return true;
  }

  return (
    <div>
      <AdminNav />
      <SectionHeading eyebrow="Content" title="New assessment" />

      {step === "edit" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!validateBeforePreview()) return;
            setPreviewPage(0);
            setPreviewTopic("all");
            setStep("preview");
          }}
          className="space-y-8"
        >
          <section className="surface-paper space-y-4 p-5">
            <p className="text-hairline text-muted-foreground">Course details</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-xs text-muted-foreground">Title</span>
                <input className="field mt-1" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} />
              </label>
              <label className="block text-sm">
                <span className="text-xs text-muted-foreground">Topic / course</span>
                <input className="field mt-1" value={topic} onChange={(e) => setTopic(e.target.value)} required minLength={2} />
              </label>
            </div>
            <label className="block text-sm">
              <span className="text-xs text-muted-foreground">Description</span>
              <textarea className="field mt-1 min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="block text-sm">
                <span className="text-xs text-muted-foreground">Mode</span>
                <select className="field mt-1" value={mode} onChange={(e) => setMode(e.target.value as (typeof EXAM_MODES)[number])}>
                  {EXAM_MODES.map((value) => (
                    <option key={value} value={value}>
                      {MODE_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-xs text-muted-foreground">Duration (min)</span>
                <input type="number" min={1} max={300} className="field mt-1" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
              </label>
              <label className="block text-sm">
                <span className="text-xs text-muted-foreground">Pass mark (%)</span>
                <input type="number" min={1} max={100} className="field mt-1" value={passMark} onChange={(e) => setPassMark(Number(e.target.value))} />
              </label>
              <label className="block text-sm">
                <span className="text-xs text-muted-foreground">Max attempts</span>
                <input type="number" min={1} max={99} className="field mt-1" value={maxAttempts} onChange={(e) => setMaxAttempts(Number(e.target.value))} />
              </label>
            </div>
          </section>

          <section className="surface-paper space-y-4 p-5">
            <p className="text-hairline text-muted-foreground">Availability & sharing</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                Published / active
              </label>
              <label className="block text-sm">
                <span className="text-xs text-muted-foreground">Opens at</span>
                <input type="datetime-local" className="field mt-1" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="text-xs text-muted-foreground">Closes at</span>
                <input type="datetime-local" className="field mt-1" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-sm">
                <span className="text-xs text-muted-foreground">Who can take it</span>
                <select className="field mt-1" value={access} onChange={(e) => setAccess(e.target.value as typeof access)}>
                  <option value="public">Anyone with the share link (no login)</option>
                  <option value="private">Invited emails only</option>
                  <option value="organization">One organization</option>
                  <option value="group">One team / group</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-xs text-muted-foreground">Organization</span>
                <input className="field mt-1" value={organization} onChange={(e) => setOrganization(e.target.value)} disabled={access !== "organization"} />
              </label>
              <label className="block text-sm">
                <span className="text-xs text-muted-foreground">Team / group</span>
                <input className="field mt-1" value={teamGroup} onChange={(e) => setTeamGroup(e.target.value)} disabled={access !== "group"} />
              </label>
            </div>
            <label className="block text-sm">
              <span className="text-xs text-muted-foreground">Invite by email (optional)</span>
              <textarea className="field mt-1 min-h-20" value={invitations} onChange={(e) => setInvitations(e.target.value)} placeholder="ada@example.com, grace@example.com" />
            </label>
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-hairline text-muted-foreground">Questions ({questions.length})</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => downloadQuestionCsvTemplate()} className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-secondary">
                  <Download className="h-3.5 w-3.5" /> CSV template
                </button>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-secondary">
                  <Upload className="h-3.5 w-3.5" /> Upload CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onCsvUpload(file);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
                <button type="button" onClick={() => setQuestions((list) => [...list, blankQuestion()])} className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-secondary">
                  <Plus className="h-3.5 w-3.5" /> Add question
                </button>
              </div>
            </div>

            {questions.map((question, index) => (
              <div key={index} className="surface-paper space-y-3 p-5">
                <div className="flex items-start gap-3">
                  <span className="mt-2 text-xs text-muted-foreground">{index + 1}</span>
                  <label className="block flex-1 text-sm">
                    <span className="text-xs text-muted-foreground">Question</span>
                    <textarea className="field mt-1" value={question.prompt} onChange={(e) => patchQuestion(index, { prompt: e.target.value })} required minLength={4} />
                  </label>
                  {questions.length > 1 ? (
                    <button type="button" onClick={() => setQuestions((list) => list.filter((_, i) => i !== index))} className="mt-6 rounded-md p-2 text-muted-foreground hover:bg-secondary" aria-label="Remove question">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                <label className="inline-flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={question.multiSelect}
                    onChange={(e) =>
                      patchQuestion(index, {
                        multiSelect: e.target.checked,
                        correctIndexes: e.target.checked
                          ? question.correctIndexes
                          : [question.correctIndexes[0] ?? 0],
                      })
                    }
                  />
                  Multi-select answers
                </label>

                <div className="grid gap-2 sm:grid-cols-2">
                  {question.options.map((option, optionIndex) => (
                    <label key={optionIndex} className="flex items-center gap-2 text-sm">
                      <input
                        type={question.multiSelect ? "checkbox" : "radio"}
                        name={`correct-${index}`}
                        checked={question.correctIndexes.includes(optionIndex)}
                        onChange={() => toggleCorrect(index, optionIndex)}
                        aria-label={`Mark option ${optionIndex + 1} correct`}
                      />
                      <input
                        className="field"
                        value={option}
                        onChange={(e) =>
                          patchQuestion(index, {
                            options: question.options.map((value, i) =>
                              i === optionIndex ? e.target.value : value,
                            ),
                          })
                        }
                        placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`}
                        required={optionIndex < 2}
                      />
                    </label>
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="text-xs text-muted-foreground">Subtopic</span>
                    <input className="field mt-1" value={question.subtopic} onChange={(e) => patchQuestion(index, { subtopic: e.target.value })} />
                  </label>
                  <label className="block text-sm">
                    <span className="text-xs text-muted-foreground">Explanation</span>
                    <input className="field mt-1" value={question.explanation} onChange={(e) => patchQuestion(index, { explanation: e.target.value })} />
                  </label>
                </div>
              </div>
            ))}
          </section>

          <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Eye className="h-4 w-4" /> Preview before publishing
          </button>
        </form>
      ) : (
        <div className="space-y-6">
          <section className="surface-paper space-y-2 p-5">
            <p className="text-hairline text-muted-foreground">{topic}</p>
            <h2 className="font-display text-2xl">{title}</h2>
            <p className="text-sm text-muted-foreground">
              {MODE_LABELS[mode]} · {questions.length} questions · {duration} min · pass {passMark}% ·{" "}
              {active ? "Active" : "Inactive"}
              {startsAt ? ` · opens ${new Date(startsAt).toLocaleString()}` : ""}
              {endsAt ? ` · closes ${new Date(endsAt).toLocaleString()}` : ""}
            </p>
            {description ? <p className="pt-2 text-sm text-muted-foreground">{description}</p> : null}
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {topics.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setPreviewTopic(value);
                    setPreviewPage(0);
                  }}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs font-medium",
                    previewTopic === value ? "border-accent bg-accent/10 text-foreground" : "border-input text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {value === "all" ? "All topics" : value}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Page {previewPage + 1} of {previewPages} · {filteredPreview.length} question(s)
            </p>
          </div>

          <div className="space-y-4">
            {pageQuestions.map((question, index) => {
              const absolute = previewPage * PREVIEW_PAGE_SIZE + index + 1;
              return (
                <article key={`${question.prompt}-${absolute}`} className="surface-paper p-5">
                  <p className="text-hairline text-muted-foreground">
                    Q{absolute} · {question.subtopic || "general"}
                    {question.multiSelect ? " · multi-select" : ""}
                  </p>
                  <h3 className="mt-2 font-display text-xl leading-snug">{question.prompt}</h3>
                  <ul className="mt-4 space-y-2">
                    {question.options
                      .filter((o) => o.trim())
                      .map((option, optionIndex) => {
                        const correct = question.correctIndexes.includes(optionIndex);
                        return (
                          <li
                            key={optionIndex}
                            className={cn(
                              "rounded-md border px-3 py-2 text-sm",
                              correct ? "border-success/40 bg-success/10" : "border-border",
                            )}
                          >
                            <span className="mr-2 font-semibold">{String.fromCharCode(65 + optionIndex)}.</span>
                            {option}
                            {correct ? <span className="ml-2 text-xs text-success">Correct</span> : null}
                          </li>
                        );
                      })}
                  </ul>
                  {question.explanation ? (
                    <p className="mt-3 text-xs text-muted-foreground">Explanation: {question.explanation}</p>
                  ) : null}
                </article>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              disabled={previewPage === 0}
              onClick={() => setPreviewPage((page) => Math.max(0, page - 1))}
              className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-2 text-sm disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <button
              type="button"
              disabled={previewPage >= previewPages - 1}
              onClick={() => setPreviewPage((page) => Math.min(previewPages - 1, page + 1))}
              className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-2 text-sm disabled:opacity-50"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setStep("edit")} className="rounded-md border border-input px-4 py-3 text-sm font-medium hover:bg-secondary">
              Back to edit
            </button>
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
              className="flex-1 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {mutation.isPending ? "Publishing…" : "Publish assessment"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
