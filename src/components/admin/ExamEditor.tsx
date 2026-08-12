import { EXAM_MODES, MODE_LABELS } from "@/lib/gamification";
import { listOrgCatalog } from "@/lib/platform.functions";
import { downloadQuestionCsvTemplate, parseQuestionsCsv } from "@/lib/questions-csv";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Eye,
  FileQuestion,
  Plus,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export type QuestionForm = {
  prompt: string;
  options: string[];
  correctIndexes: number[];
  multiSelect: boolean;
  subtopic: string;
  explanation: string;
};

export type ExamEditorValues = {
  title: string;
  description: string;
  topic: string;
  mode: (typeof EXAM_MODES)[number];
  duration: number;
  passMark: number;
  maxAttempts: number;
  access: "public" | "private" | "organization" | "group";
  organization: string;
  teamGroup: string;
  invitations: string;
  active: boolean;
  startsAt: string;
  endsAt: string;
  questions: QuestionForm[];
};

export type ExamSubmitPayload = {
  title: string;
  description: string;
  topic: string;
  mode: (typeof EXAM_MODES)[number];
  duration_minutes: number;
  pass_mark: number;
  max_attempts: number;
  access: ExamEditorValues["access"];
  organization: string;
  team_group: string;
  invitations: string;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  questions: Array<{
    prompt: string;
    options: string[];
    correct_index: number;
    correct_indexes: number[];
    multi_select: boolean;
    subtopic: string;
    explanation: string;
  }>;
};

type TabId = "details" | "questions" | "preview" | "submit";

const TABS: Array<{ id: TabId; label: string; hint: string; icon: typeof ClipboardList }> = [
  { id: "details", label: "Details", hint: "Title, rules, access", icon: ClipboardList },
  { id: "questions", label: "Questions", hint: "Build the paper", icon: FileQuestion },
  { id: "preview", label: "Preview", hint: "Review as a participant", icon: Eye },
  { id: "submit", label: "Publish", hint: "Save and invite", icon: Send },
];

const PREVIEW_PAGE_SIZE = 5;

export function blankQuestion(): QuestionForm {
  return {
    prompt: "",
    options: ["", "", "", ""],
    correctIndexes: [0],
    multiSelect: false,
    subtopic: "",
    explanation: "",
  };
}

export function defaultExamValues(): ExamEditorValues {
  return {
    title: "",
    description: "",
    topic: "",
    mode: "assessment",
    duration: 30,
    passMark: 60,
    maxAttempts: 2,
    access: "public",
    organization: "",
    teamGroup: "",
    invitations: "",
    active: true,
    startsAt: "",
    endsAt: "",
    questions: [blankQuestion()],
  };
}

function toLocalInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function examToEditorValues(exam: {
  title: string;
  description: string;
  topic: string;
  mode: string;
  duration_minutes: number;
  pass_mark: number;
  max_attempts: number;
  access: string;
  organization: string;
  team_group: string;
  invitations: string;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  questions: Array<{
    prompt: string;
    options: string[];
    correct_indexes: number[];
    multi_select: boolean;
    subtopic: string;
    explanation: string;
  }>;
}): ExamEditorValues {
  return {
    title: exam.title,
    description: exam.description,
    topic: exam.topic,
    mode: exam.mode as ExamEditorValues["mode"],
    duration: exam.duration_minutes,
    passMark: exam.pass_mark,
    maxAttempts: exam.max_attempts,
    access: exam.access as ExamEditorValues["access"],
    organization: exam.organization,
    teamGroup: exam.team_group,
    invitations: exam.invitations,
    active: exam.active,
    startsAt: toLocalInput(exam.starts_at),
    endsAt: toLocalInput(exam.ends_at),
    questions:
      exam.questions.length > 0
        ? exam.questions.map((q) => ({
            prompt: q.prompt,
            options: q.options.length >= 4 ? q.options : [...q.options, "", "", "", ""].slice(0, 4),
            correctIndexes: q.correct_indexes,
            multiSelect: q.multi_select,
            subtopic: q.subtopic,
            explanation: q.explanation,
          }))
        : [blankQuestion()],
  };
}

function buildPayload(values: ExamEditorValues): ExamSubmitPayload {
  return {
    title: values.title,
    description: values.description,
    topic: values.topic,
    mode: values.mode,
    duration_minutes: values.duration,
    pass_mark: values.passMark,
    max_attempts: values.maxAttempts,
    access: values.access,
    organization: values.organization,
    team_group: values.teamGroup,
    invitations: values.invitations,
    active: values.active,
    starts_at: values.startsAt ? new Date(values.startsAt).toISOString() : null,
    ends_at: values.endsAt ? new Date(values.endsAt).toISOString() : null,
    questions: values.questions.map((q) => {
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
        subtopic: q.subtopic.trim() || "general",
        explanation: q.explanation,
      };
    }),
  };
}

type ExamEditorProps = {
  mode: "create" | "edit";
  initial?: ExamEditorValues;
  categories?: string[];
  submitLabel?: string;
  onSubmit: (payload: ExamSubmitPayload) => Promise<{ examId: string }>;
  onSuccess?: (examId: string) => void;
};

export function ExamEditor({
  mode,
  initial,
  categories = [],
  submitLabel,
  onSubmit,
  onSuccess,
}: ExamEditorProps) {
  const [values, setValues] = useState<ExamEditorValues>(initial ?? defaultExamValues());
  const [tab, setTab] = useState<TabId>("details");
  const [categoryDraft, setCategoryDraft] = useState("");
  const [tagDraftByIndex, setTagDraftByIndex] = useState<Record<number, string>>({});
  const [previewPage, setPreviewPage] = useState(0);
  const [previewTag, setPreviewTag] = useState("all");
  const [previewSeen, setPreviewSeen] = useState(mode === "edit");

  const fetchCatalog = useServerFn(listOrgCatalog);
  const { data: orgCatalog } = useQuery({
    queryKey: ["org-catalog"],
    queryFn: () => fetchCatalog(),
  });

  const knownCategories = useMemo(() => {
    const set = new Set(categories.filter(Boolean));
    if (values.topic.trim()) set.add(values.topic.trim());
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [categories, values.topic]);

  const knownTags = useMemo(() => {
    const set = new Set(
      values.questions.map((q) => q.subtopic.trim()).filter((tag) => tag.length > 0),
    );
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [values.questions]);

  const previewTags = useMemo(() => ["all", ...knownTags], [knownTags]);

  const filteredPreview = useMemo(() => {
    if (previewTag === "all") return values.questions;
    return values.questions.filter((q) => (q.subtopic.trim() || "general") === previewTag);
  }, [previewTag, values.questions]);

  const previewPages = Math.max(1, Math.ceil(filteredPreview.length / PREVIEW_PAGE_SIZE));
  const pageQuestions = filteredPreview.slice(
    previewPage * PREVIEW_PAGE_SIZE,
    previewPage * PREVIEW_PAGE_SIZE + PREVIEW_PAGE_SIZE,
  );

  const mutation = useMutation({
    mutationFn: () => onSubmit(buildPayload(values)),
    onSuccess: (result) => {
      toast.success(mode === "edit" ? "Assessment updated" : "Assessment saved");
      onSuccess?.(result.examId);
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not save assessment"),
  });

  function patch(partial: Partial<ExamEditorValues>) {
    setValues((current) => ({ ...current, ...partial }));
  }

  function patchQuestion(index: number, partial: Partial<QuestionForm>) {
    setValues((current) => ({
      ...current,
      questions: current.questions.map((q, i) => (i === index ? { ...q, ...partial } : q)),
    }));
  }

  function toggleCorrect(questionIndex: number, optionIndex: number) {
    setValues((current) => ({
      ...current,
      questions: current.questions.map((q, i) => {
        if (i !== questionIndex) return q;
        if (!q.multiSelect) return { ...q, correctIndexes: [optionIndex] };
        const exists = q.correctIndexes.includes(optionIndex);
        const next = exists
          ? q.correctIndexes.filter((value) => value !== optionIndex)
          : [...q.correctIndexes, optionIndex];
        return { ...q, correctIndexes: next.length ? next : [optionIndex] };
      }),
    }));
  }

  function validateDetails() {
    if (values.title.trim().length < 3) {
      toast.error("Title is required");
      return false;
    }
    if (values.topic.trim().length < 2) {
      toast.error("Category is required");
      return false;
    }
    if (values.startsAt && values.endsAt && new Date(values.endsAt) <= new Date(values.startsAt)) {
      toast.error("End date must be after the start date");
      return false;
    }
    return true;
  }

  function validateQuestions() {
    for (const [index, q] of values.questions.entries()) {
      if (q.prompt.trim().length < 4) {
        toast.error(`Question ${index + 1} needs a prompt`);
        return false;
      }
      if (q.prompt.trim().length > 4000) {
        toast.error(`Question ${index + 1} prompt must be at most 4000 characters`);
        return false;
      }
      const options = q.options.filter((o) => o.trim());
      if (options.length < 2) {
        toast.error(`Question ${index + 1} needs at least two options`);
        return false;
      }
      if (options.some((option) => option.trim().length > 1000)) {
        toast.error(`Question ${index + 1} has an option over 1000 characters`);
        return false;
      }
      if (q.explanation.trim().length > 4000) {
        toast.error(`Question ${index + 1} explanation must be at most 4000 characters`);
        return false;
      }
      if (q.correctIndexes.length === 0) {
        toast.error(`Question ${index + 1} needs a correct answer`);
        return false;
      }
    }
    return true;
  }

  function goToTab(next: TabId) {
    if (next === "questions" || next === "preview" || next === "submit") {
      if (!validateDetails()) {
        setTab("details");
        return;
      }
    }
    if (next === "preview" || next === "submit") {
      if (!validateQuestions()) {
        setTab("questions");
        return;
      }
      setPreviewPage(0);
      setPreviewTag("all");
    }
    if (next === "preview") setPreviewSeen(true);
    setTab(next);
  }

  const detailsReady =
    values.title.trim().length >= 3 &&
    values.topic.trim().length >= 2 &&
    !(values.startsAt && values.endsAt && new Date(values.endsAt) <= new Date(values.startsAt));

  const validQuestionCount = values.questions.filter((q) => {
    const options = q.options.filter((o) => o.trim());
    return q.prompt.trim().length >= 4 && options.length >= 2 && q.correctIndexes.length > 0;
  }).length;

  const questionsReady = validQuestionCount > 0 && validQuestionCount === values.questions.length;
  const stepComplete = {
    details: detailsReady,
    questions: questionsReady,
    preview: previewSeen && questionsReady,
    submit: detailsReady && questionsReady,
  } as const;

  const progressPercent = Math.round(
    ((Number(stepComplete.details) +
      Number(stepComplete.questions) +
      Number(stepComplete.preview) +
      Number(stepComplete.submit && tab === "submit")) /
      4) *
      100,
  );

  const inviteCount = values.invitations
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean).length;

  function onCsvUpload(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const { questions: parsed, errors } = parseQuestionsCsv(text);
      if (errors.length) toast.error(errors[0] ?? "CSV has errors");
      if (parsed.length === 0) return;
      patch({
        questions: parsed.map((q) => ({
          prompt: q.prompt,
          options: q.options.length >= 4 ? q.options : [...q.options, "", ""].slice(0, 4),
          correctIndexes: q.correctIndexes,
          multiSelect: q.multiSelect,
          subtopic: q.subtopic,
          explanation: q.explanation,
        })),
      });
      toast.success(`Imported ${parsed.length} question(s)`);
    };
    reader.readAsText(file);
  }

  function addCategoryFromDraft() {
    const next = categoryDraft.trim();
    if (next.length < 2) {
      toast.error("Category needs at least 2 characters");
      return;
    }
    patch({ topic: next });
    setCategoryDraft("");
  }

  function setQuestionTag(index: number, tag: string) {
    patchQuestion(index, { subtopic: tag.trim() });
    setTagDraftByIndex((current) => ({ ...current, [index]: "" }));
  }

  return (
    <div className="space-y-6">
      <div className="surface-paper overflow-hidden">
        <div className="border-b border-border bg-secondary/40 px-5 py-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-hairline text-muted-foreground">Assessment progress</p>
              <p className="mt-1 font-display text-xl">
                {mode === "edit" ? "Edit assessment" : "New assessment"}
              </p>
            </div>
            <p className="text-sm tabular-nums text-muted-foreground">
              <span className="font-semibold text-foreground">{progressPercent}%</span> complete
            </p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-border/80">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <ol className="grid gap-0 sm:grid-cols-4">
          {TABS.map((item, index) => {
            const Icon = item.icon;
            const active = tab === item.id;
            const done = stepComplete[item.id];
            return (
              <li key={item.id} className="border-border sm:border-r sm:last:border-r-0">
                <button
                  type="button"
                  onClick={() => goToTab(item.id)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-4 text-left transition-colors",
                    active ? "bg-accent/10" : "hover:bg-secondary/60",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      done
                        ? "bg-primary text-primary-foreground"
                        : active
                          ? "bg-accent text-accent-foreground"
                          : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{item.hint}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0 space-y-6">
          {tab === "details" ? (
            <div className="space-y-6">
              <section className="surface-paper space-y-4 p-5">
                <p className="text-hairline text-muted-foreground">Course details</p>
                <label className="block text-sm">
                  <span className="text-xs text-muted-foreground">Title *</span>
                  <input
                    className="field mt-1"
                    value={values.title}
                    onChange={(e) => patch({ title: e.target.value })}
                    required
                    minLength={3}
                  />
                </label>

                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Category * (high-level topic)</p>
                  <div className="flex flex-wrap gap-2">
                    {knownCategories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => patch({ topic: category })}
                        className={cn(
                          "rounded-md border px-3 py-1.5 text-xs font-medium",
                          values.topic === category
                            ? "border-accent bg-accent/10 text-foreground"
                            : "border-input text-muted-foreground hover:bg-secondary",
                        )}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      className="field min-w-[12rem] flex-1"
                      placeholder="Add a new category…"
                      value={categoryDraft}
                      onChange={(e) => setCategoryDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCategoryFromDraft();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={addCategoryFromDraft}
                      className="rounded-md border border-input px-3 py-2 text-sm hover:bg-secondary"
                    >
                      Use category
                    </button>
                  </div>
                  {values.topic ? (
                    <p className="text-xs text-muted-foreground">
                      Selected category:{" "}
                      <span className="font-medium text-foreground">{values.topic}</span>
                    </p>
                  ) : null}
                </div>

                <label className="block text-sm">
                  <span className="text-xs text-muted-foreground">Description</span>
                  <textarea
                    className="field mt-1 min-h-20"
                    value={values.description}
                    onChange={(e) => patch({ description: e.target.value })}
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-4">
                  <label className="block text-sm">
                    <span className="text-xs text-muted-foreground">Mode *</span>
                    <select
                      className="field mt-1"
                      value={values.mode}
                      onChange={(e) => patch({ mode: e.target.value as ExamEditorValues["mode"] })}
                    >
                      {EXAM_MODES.map((value) => (
                        <option key={value} value={value}>
                          {MODE_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="text-xs text-muted-foreground">Duration (min) *</span>
                    <input
                      type="number"
                      min={1}
                      max={300}
                      className="field mt-1"
                      value={values.duration}
                      onChange={(e) => patch({ duration: Number(e.target.value) })}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-xs text-muted-foreground">Pass mark (%) *</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      className="field mt-1"
                      value={values.passMark}
                      onChange={(e) => patch({ passMark: Number(e.target.value) })}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-xs text-muted-foreground">Max attempts *</span>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      className="field mt-1"
                      value={values.maxAttempts}
                      onChange={(e) => patch({ maxAttempts: Number(e.target.value) })}
                    />
                  </label>
                </div>
              </section>

              <section className="surface-paper space-y-4 p-5">
                <p className="text-hairline text-muted-foreground">Availability & sharing</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={values.active}
                      onChange={(e) => patch({ active: e.target.checked })}
                    />
                    Publish on save
                  </label>
                  <label className="block text-sm">
                    <span className="text-xs text-muted-foreground">Opens at</span>
                    <input
                      type="datetime-local"
                      className="field mt-1"
                      value={values.startsAt}
                      onChange={(e) => patch({ startsAt: e.target.value })}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-xs text-muted-foreground">Closes at</span>
                    <input
                      type="datetime-local"
                      className="field mt-1"
                      value={values.endsAt}
                      onChange={(e) => patch({ endsAt: e.target.value })}
                    />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block text-sm">
                    <span className="text-xs text-muted-foreground">Who can take it *</span>
                    <select
                      className="field mt-1"
                      value={values.access}
                      onChange={(e) =>
                        patch({
                          access: e.target.value as ExamEditorValues["access"],
                        })
                      }
                    >
                      <option value="public">Anyone with the share link (no login)</option>
                      <option value="private">Invited emails only</option>
                      <option value="organization">One organization</option>
                      <option value="group">One team / group</option>
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="text-xs text-muted-foreground">
                      Organization{values.access === "organization" ? " *" : ""}
                    </span>
                    <select
                      className="field mt-1"
                      value={values.organization}
                      onChange={(e) => patch({ organization: e.target.value })}
                      disabled={values.access !== "organization"}
                    >
                      <option value="">Select organisation</option>
                      {(orgCatalog?.organizations ?? []).map((org) => (
                        <option key={org.id} value={org.name}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="text-xs text-muted-foreground">
                      Team / Group{values.access === "group" ? " *" : ""}
                    </span>
                    <input
                      className="field mt-1"
                      value={values.teamGroup}
                      onChange={(e) => patch({ teamGroup: e.target.value })}
                      disabled={values.access !== "group"}
                    />
                  </label>
                </div>
                <label className="block text-sm">
                  <span className="text-xs text-muted-foreground">Invite by email (optional)</span>
                  <textarea
                    className="field mt-1 min-h-20"
                    value={values.invitations}
                    onChange={(e) => patch({ invitations: e.target.value })}
                    placeholder="ada@example.com, grace@example.com"
                  />
                </label>
              </section>

              <button
                type="button"
                onClick={() => goToTab("questions")}
                className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Continue to questions
              </button>
            </div>
          ) : null}

          {tab === "questions" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-hairline text-muted-foreground">
                  Questions ({values.questions.length}) · tags are subtopics
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => downloadQuestionCsvTemplate()}
                    className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                  >
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
                  <button
                    type="button"
                    onClick={() => patch({ questions: [...values.questions, blankQuestion()] })}
                    className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add question
                  </button>
                </div>
              </div>

              {values.questions.map((question, index) => (
                <div key={index} className="surface-paper space-y-3 p-5">
                  <div className="flex items-start gap-3">
                    <span className="mt-2 text-xs text-muted-foreground">{index + 1}</span>
                    <label className="block flex-1 text-sm">
                      <span className="text-xs text-muted-foreground">Question</span>
                      <textarea
                        className="field mt-1 min-h-24"
                        value={question.prompt}
                        onChange={(e) => patchQuestion(index, { prompt: e.target.value })}
                        required
                        minLength={4}
                        maxLength={4000}
                      />
                      <span className="mt-1 block text-[11px] tabular-nums text-muted-foreground">
                        {question.prompt.trim().length}/4000
                      </span>
                    </label>
                    {values.questions.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          patch({
                            questions: values.questions.filter((_, i) => i !== index),
                          })
                        }
                        className="mt-6 rounded-md p-2 text-muted-foreground hover:bg-secondary"
                        aria-label="Remove question"
                      >
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
                          maxLength={1000}
                        />
                      </label>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Subtopic tag</p>
                    <div className="flex flex-wrap gap-2">
                      {knownTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setQuestionTag(index, tag)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                            question.subtopic === tag
                              ? "border-accent bg-accent/10 text-foreground"
                              : "border-input text-muted-foreground hover:bg-secondary",
                          )}
                        >
                          {tag}
                        </button>
                      ))}
                      {question.subtopic ? (
                        <button
                          type="button"
                          onClick={() => patchQuestion(index, { subtopic: "" })}
                          className="inline-flex items-center gap-1 rounded-full border border-input px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-secondary"
                        >
                          Clear <X className="h-3 w-3" />
                        </button>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <input
                        className="field min-w-[10rem] flex-1"
                        placeholder="Type a tag and press Enter…"
                        value={tagDraftByIndex[index] ?? ""}
                        onChange={(e) =>
                          setTagDraftByIndex((current) => ({
                            ...current,
                            [index]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const draft = (tagDraftByIndex[index] ?? "").trim();
                            if (draft) setQuestionTag(index, draft);
                          }
                        }}
                      />
                    </div>
                    {question.subtopic ? (
                      <p className="text-xs text-muted-foreground">
                        Tag:{" "}
                        <span className="font-medium text-foreground">{question.subtopic}</span>
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No tag yet (defaults to “general”).
                      </p>
                    )}
                  </div>

                  <label className="block text-sm">
                    <span className="text-xs text-muted-foreground">Explanation</span>
                    <textarea
                      className="field mt-1 min-h-20"
                      value={question.explanation}
                      onChange={(e) => patchQuestion(index, { explanation: e.target.value })}
                      maxLength={4000}
                    />
                    <span className="mt-1 block text-[11px] tabular-nums text-muted-foreground">
                      {question.explanation.trim().length}/4000
                    </span>
                  </label>
                </div>
              ))}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => goToTab("details")}
                  className="rounded-md border border-input px-4 py-3 text-sm font-medium hover:bg-secondary"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => goToTab("preview")}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Eye className="h-4 w-4" /> Preview
                </button>
              </div>
            </div>
          ) : null}

          {tab === "preview" ? (
            <div className="space-y-6">
              <section className="surface-paper space-y-2 p-5">
                <p className="text-hairline text-muted-foreground">
                  Category · {values.topic || "—"}
                </p>
                <h2 className="font-display text-2xl">{values.title || "Untitled assessment"}</h2>
                <p className="text-sm text-muted-foreground">
                  {MODE_LABELS[values.mode]} · {values.questions.length} questions ·{" "}
                  {values.duration} min · pass {values.passMark}% ·{" "}
                  {values.active ? "Will publish" : "Saved as draft"}
                  {values.startsAt ? ` · opens ${new Date(values.startsAt).toLocaleString()}` : ""}
                  {values.endsAt ? ` · closes ${new Date(values.endsAt).toLocaleString()}` : ""}
                </p>
                {values.description ? (
                  <p className="pt-2 text-sm text-muted-foreground">{values.description}</p>
                ) : null}
              </section>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {previewTags.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setPreviewTag(value);
                        setPreviewPage(0);
                      }}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium",
                        previewTag === value
                          ? "border-accent bg-accent/10 text-foreground"
                          : "border-input text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      {value === "all" ? "All tags" : value}
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
                        Q{absolute}
                        {question.subtopic ? ` · ${question.subtopic}` : ""}
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
                                <span className="mr-2 font-semibold">
                                  {String.fromCharCode(65 + optionIndex)}.
                                </span>
                                {option}
                                {correct ? (
                                  <span className="ml-2 text-xs text-success">Correct</span>
                                ) : null}
                              </li>
                            );
                          })}
                      </ul>
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
                <button
                  type="button"
                  onClick={() => goToTab("questions")}
                  className="rounded-md border border-input px-4 py-3 text-sm font-medium hover:bg-secondary"
                >
                  Back to questions
                </button>
                <button
                  type="button"
                  onClick={() => goToTab("submit")}
                  className="flex-1 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Continue to submit
                </button>
              </div>
            </div>
          ) : null}

          {tab === "submit" ? (
            <section className="surface-paper space-y-5 p-5">
              <div>
                <p className="text-hairline text-muted-foreground">
                  Ready to {mode === "edit" ? "update" : "create"}
                </p>
                <h2 className="mt-1 font-display text-2xl">{values.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Category <span className="font-medium text-foreground">{values.topic}</span> ·{" "}
                  {values.questions.length} questions · {knownTags.length} tag(s) ·{" "}
                  {values.active ? "Publish immediately" : "Save unpublished"}
                </p>
              </div>

              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={values.active}
                  onChange={(e) => patch({ active: e.target.checked })}
                />
                {values.active ? "Published" : "Unpublished draft"}
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => goToTab("preview")}
                  className="rounded-md border border-input px-4 py-3 text-sm font-medium hover:bg-secondary"
                >
                  Back to preview
                </button>
                <button
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() => {
                    if (!validateDetails() || !validateQuestions()) return;
                    mutation.mutate();
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  {mutation.isPending
                    ? "Saving…"
                    : (submitLabel ??
                      (mode === "edit"
                        ? values.active
                          ? "Update & publish"
                          : "Update assessment"
                        : values.active
                          ? "Publish assessment"
                          : "Save draft"))}
                </button>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section className="surface-paper space-y-3 p-4">
            <p className="text-hairline text-muted-foreground">Live checklist</p>
            <ul className="space-y-2 text-sm">
              {(
                [
                  ["details", "Course details", detailsReady],
                  [
                    "questions",
                    `${validQuestionCount}/${values.questions.length} questions ready`,
                    questionsReady,
                  ],
                  ["preview", "Preview reviewed", stepComplete.preview],
                  [
                    "submit",
                    values.active ? "Ready to publish" : "Ready to save draft",
                    stepComplete.submit,
                  ],
                ] as const
              ).map(([id, label, done]) => (
                <li key={id} className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                      done
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="h-3 w-3" /> : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => goToTab(id)}
                    className={cn(
                      "text-left hover:underline",
                      done ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="surface-paper space-y-2 p-4 text-sm">
            <p className="text-hairline text-muted-foreground">Snapshot</p>
            <p className="font-medium">{values.title.trim() || "Untitled assessment"}</p>
            <p className="text-xs text-muted-foreground">
              {values.topic.trim() || "No category"} · {MODE_LABELS[values.mode]}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-secondary px-2.5 py-2">
                <dt className="text-muted-foreground">Duration</dt>
                <dd className="font-semibold tabular-nums">{values.duration} min</dd>
              </div>
              <div className="rounded-md bg-secondary px-2.5 py-2">
                <dt className="text-muted-foreground">Pass mark</dt>
                <dd className="font-semibold tabular-nums">{values.passMark}%</dd>
              </div>
              <div className="rounded-md bg-secondary px-2.5 py-2">
                <dt className="text-muted-foreground">Attempts</dt>
                <dd className="font-semibold tabular-nums">{values.maxAttempts}</dd>
              </div>
              <div className="rounded-md bg-secondary px-2.5 py-2">
                <dt className="text-muted-foreground">Invites</dt>
                <dd className="font-semibold tabular-nums">{inviteCount}</dd>
              </div>
            </dl>
            <p className="pt-1 text-xs text-muted-foreground">
              Access:{" "}
              <span className="font-medium text-foreground">
                {values.access === "organization"
                  ? values.organization || "organisation"
                  : values.access === "group"
                    ? values.teamGroup || "group"
                    : values.access}
              </span>
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
