import { QuestionGenerationConfiguration } from "@/components/admin/pool/QuestionGenerationConfiguration";
import type { PoolConfigState } from "@/components/admin/pool/QuestionGenerationConfiguration";
import { QuestionSelectionMethod } from "@/components/admin/pool/QuestionSelectionMethod";
import { OrgDepartmentFields } from "@/components/OrgDepartmentFields";
import { DateTimeField, scheduleWindowStatus } from "@/components/ui/date-time-field";
import { EmailChipInput } from "@/components/ui/email-chip-input";
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
  Lightbulb,
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
  sourcePoolQuestionId?: string | null;
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
  questionSelectionMethod: "upload" | "question_pool";
  courseId: string | null;
  questionPoolId: string | null;
  blueprintId: string | null;
  seriesId: string | null;
  reusePolicy: PoolConfigState["reusePolicy"];
  reuseLastN: number;
  poolQuestionCount: number;
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
  question_selection_method?: "upload" | "question_pool";
  course_id?: string | null;
  question_pool_id?: string | null;
  blueprint_id?: string | null;
  series_id?: string | null;
  reuse_policy?: PoolConfigState["reusePolicy"] | null;
  reuse_last_n?: number | null;
  questions: Array<{
    prompt: string;
    options: string[];
    correct_index: number;
    correct_indexes: number[];
    multi_select: boolean;
    subtopic: string;
    explanation: string;
    source_pool_question_id?: string | null;
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
    sourcePoolQuestionId: null,
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
    questionSelectionMethod: "upload",
    courseId: null,
    questionPoolId: null,
    blueprintId: null,
    seriesId: null,
    reusePolicy: "until_pool_exhausted",
    reuseLastN: 5,
    poolQuestionCount: 30,
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
  question_selection_method?: "upload" | "question_pool" | null;
  course_id?: string | null;
  question_pool_id?: string | null;
  blueprint_id?: string | null;
  series_id?: string | null;
  reuse_policy?: PoolConfigState["reusePolicy"] | null;
  reuse_last_n?: number | null;
  questions: Array<{
    prompt: string;
    options: string[];
    correct_indexes: number[];
    multi_select: boolean;
    subtopic: string;
    explanation: string;
    source_pool_question_id?: string | null;
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
    questionSelectionMethod: exam.question_selection_method ?? "upload",
    courseId: exam.course_id ?? null,
    questionPoolId: exam.question_pool_id ?? null,
    blueprintId: exam.blueprint_id ?? null,
    seriesId: exam.series_id ?? null,
    reusePolicy: exam.reuse_policy ?? "until_pool_exhausted",
    reuseLastN: exam.reuse_last_n ?? 5,
    poolQuestionCount: Math.max(1, exam.questions.length || 30),
    questions:
      exam.questions.length > 0
        ? exam.questions.map((q) => ({
            prompt: q.prompt,
            options: q.options.length >= 4 ? q.options : [...q.options, "", "", "", ""].slice(0, 4),
            correctIndexes: q.correct_indexes,
            multiSelect: q.multi_select,
            subtopic: q.subtopic,
            explanation: q.explanation,
            sourcePoolQuestionId: q.source_pool_question_id ?? null,
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
    question_selection_method: values.questionSelectionMethod,
    course_id: values.questionSelectionMethod === "question_pool" ? values.courseId : null,
    question_pool_id:
      values.questionSelectionMethod === "question_pool" ? values.questionPoolId : null,
    blueprint_id: values.questionSelectionMethod === "question_pool" ? values.blueprintId : null,
    series_id: values.questionSelectionMethod === "question_pool" ? values.seriesId : null,
    reuse_policy: values.questionSelectionMethod === "question_pool" ? values.reusePolicy : null,
    reuse_last_n: values.questionSelectionMethod === "question_pool" ? values.reuseLastN : null,
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
        source_pool_question_id: q.sourcePoolQuestionId ?? null,
      };
    }),
  };
}

type ExamEditorProps = {
  mode: "create" | "edit";
  examId?: string | null;
  canRegenerate?: boolean;
  initial?: ExamEditorValues;
  categories?: string[];
  submitLabel?: string;
  onSubmit: (payload: ExamSubmitPayload) => Promise<{ examId: string }>;
  onSuccess?: (examId: string) => void;
};

export function ExamEditor({
  mode,
  examId = null,
  canRegenerate = true,
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
  const [previewPageSize, setPreviewPageSize] = useState(PREVIEW_PAGE_SIZE);
  const [previewSeen, setPreviewSeen] = useState(mode === "edit");
  const [poolDistribution, setPoolDistribution] = useState<Record<string, number> | null>(null);
  const [showInviteField, setShowInviteField] = useState(
    () => Boolean(initial?.invitations?.trim()) || initial?.access === "private",
  );

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

  const previewPages = Math.max(1, Math.ceil(filteredPreview.length / previewPageSize));
  const pageQuestions = filteredPreview.slice(
    previewPage * previewPageSize,
    previewPage * previewPageSize + previewPageSize,
  );
  const previewRangeStart = filteredPreview.length === 0 ? 0 : previewPage * previewPageSize + 1;
  const previewRangeEnd = Math.min((previewPage + 1) * previewPageSize, filteredPreview.length);

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
    if (values.access === "organization" && !values.organization.trim()) {
      toast.error("Select an organisation");
      return false;
    }
    if (values.access === "group") {
      if (!values.organization.trim() || !values.teamGroup.trim()) {
        toast.error("Select organisation and team / group");
        return false;
      }
    }
    if (values.access === "private") {
      const invites = values.invitations
        .split(/[,;\s\n]+/)
        .map((part) => part.trim())
        .filter(Boolean);
      if (invites.length === 0) {
        toast.error("Add at least one invite email for private access");
        return false;
      }
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
    .split(/[,;\s\n]+/)
    .map((part) => part.trim())
    .filter(Boolean).length;

  const availability = useMemo(
    () => scheduleWindowStatus(values.active, values.startsAt, values.endsAt),
    [values.active, values.startsAt, values.endsAt],
  );

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

                <QuestionSelectionMethod
                  value={values.questionSelectionMethod}
                  onChange={(method) => {
                    patch({ questionSelectionMethod: method });
                    if (method === "upload") setPoolDistribution(null);
                  }}
                />

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

              <section className="surface-paper space-y-5 p-5">
                <div>
                  <p className="text-hairline text-muted-foreground">Availability & sharing</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Control when the assessment is open and who can start it.
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-secondary/25 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">Schedule</p>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={values.active}
                        onChange={(e) => patch({ active: e.target.checked })}
                      />
                      Publish on save
                    </label>
                  </div>

                  <div
                    className={cn(
                      "mb-3 rounded-md border px-3 py-2 text-sm",
                      availability.tone === "draft" &&
                        "border-border bg-card text-muted-foreground",
                      availability.tone === "scheduled" &&
                        "border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-200",
                      availability.tone === "open" &&
                        "border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200",
                      availability.tone === "closed" &&
                        "border-destructive/35 bg-destructive/10 text-destructive",
                    )}
                  >
                    <p className="font-medium">{availability.label}</p>
                    <p className="mt-0.5 text-xs opacity-90">{availability.hint}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <DateTimeField
                      label="Opens at"
                      value={values.startsAt}
                      onChange={(startsAt) => patch({ startsAt })}
                      hint="Optional — leave empty to open as soon as published"
                    />
                    <DateTimeField
                      label="Closes at"
                      value={values.endsAt}
                      onChange={(endsAt) => patch({ endsAt })}
                      min={values.startsAt || undefined}
                      hint="Optional — leave empty to stay open while published"
                    />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Published assessments are only takeable between the open and close times.
                    Outside that window participants see “not open yet” or “no longer available”.
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium">Who can take it *</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        {
                          value: "public" as const,
                          title: "Anyone with link",
                          hint: "No login required",
                        },
                        {
                          value: "private" as const,
                          title: "Invited emails",
                          hint: "Only listed addresses",
                        },
                        {
                          value: "organization" as const,
                          title: "One organization",
                          hint: "Members of a selected org",
                        },
                        {
                          value: "group" as const,
                          title: "One team / group",
                          hint: "Pick from organisation catalog",
                        },
                      ] as const
                    ).map((option) => {
                      const selected = values.access === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            patch({
                              access: option.value,
                              organization:
                                option.value === "organization" || option.value === "group"
                                  ? values.organization
                                  : "",
                              teamGroup: option.value === "group" ? values.teamGroup : "",
                            });
                            if (option.value === "private") setShowInviteField(true);
                          }}
                          className={cn(
                            "rounded-lg border px-3 py-3 text-left transition-colors",
                            selected
                              ? "border-primary/40 bg-primary/5"
                              : "border-border bg-card hover:bg-secondary/40",
                          )}
                        >
                          <span className="flex items-center gap-2 text-sm font-medium">
                            <span
                              className={cn(
                                "flex h-4 w-4 items-center justify-center rounded-full border",
                                selected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border",
                              )}
                            >
                              {selected ? <Check className="h-2.5 w-2.5" /> : null}
                            </span>
                            {option.title}
                          </span>
                          <span className="mt-1 block pl-6 text-xs text-muted-foreground">
                            {option.hint}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {values.access === "organization" ? (
                  <label className="block text-sm">
                    <span className="text-xs text-muted-foreground">Organization *</span>
                    <select
                      className="field mt-1"
                      value={values.organization}
                      onChange={(e) => patch({ organization: e.target.value })}
                      required
                    >
                      <option value="">Select organisation</option>
                      {(orgCatalog?.organizations ?? []).map((org) => (
                        <option key={org.id} value={org.name}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {values.access === "group" ? (
                  <OrgDepartmentFields
                    organization={values.organization}
                    department={values.teamGroup}
                    onOrganizationChange={(organization) => patch({ organization })}
                    onDepartmentChange={(teamGroup) => patch({ teamGroup })}
                    required
                  />
                ) : null}

                {values.access === "private" || showInviteField ? (
                  <div className="block text-sm">
                    <span className="mb-1 block text-xs text-muted-foreground">
                      Invite by email{values.access === "private" ? " *" : " (optional)"}
                    </span>
                    <EmailChipInput
                      value={values.invitations}
                      onChange={(invitations) => patch({ invitations })}
                      placeholder="name@company.com — Enter or Space"
                    />
                    <span className="mt-1.5 block text-xs text-muted-foreground">
                      Press Enter, Space, or comma to add. Paste a list to import several at once.
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline"
                    onClick={() => setShowInviteField(true)}
                  >
                    + Add optional email invites
                  </button>
                )}
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
              {values.questionSelectionMethod === "question_pool" ? (
                <section className="surface-paper space-y-4 p-5">
                  <p className="text-hairline text-muted-foreground">
                    Question pool · generate clones into this assessment
                  </p>
                  <QuestionGenerationConfiguration
                    examId={examId}
                    canRegenerate={canRegenerate && !values.active}
                    value={{
                      courseId: values.courseId,
                      poolId: values.questionPoolId,
                      blueprintId: values.blueprintId,
                      seriesId: values.seriesId,
                      questionCount: values.poolQuestionCount,
                      reusePolicy: values.reusePolicy,
                      reuseLastN: values.reuseLastN,
                    }}
                    onChange={(next) =>
                      patch({
                        courseId: next.courseId,
                        questionPoolId: next.poolId,
                        blueprintId: next.blueprintId,
                        seriesId: next.seriesId,
                        reusePolicy: next.reusePolicy,
                        reuseLastN: next.reuseLastN,
                        poolQuestionCount: next.questionCount,
                      })
                    }
                    distributionSummary={poolDistribution}
                    generatedCount={
                      values.questions.some((q) => q.sourcePoolQuestionId)
                        ? values.questions.length
                        : 0
                    }
                    onGenerated={(questions, distribution) => {
                      setPoolDistribution(distribution);
                      patch({
                        questions: questions.map((q) => ({
                          prompt: q.prompt,
                          options:
                            q.options.length >= 4
                              ? q.options
                              : [...q.options, "", "", "", ""].slice(0, 4),
                          correctIndexes: q.correct_indexes,
                          multiSelect: q.multi_select,
                          subtopic: q.subtopic,
                          explanation: q.explanation,
                          sourcePoolQuestionId: q.source_pool_question_id,
                        })),
                      });
                    }}
                  />
                  {values.questions.some((q) => q.prompt.trim().length >= 4) ? (
                    <button
                      type="button"
                      onClick={() => goToTab("preview")}
                      className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Continue to preview ({values.questions.length} questions)
                    </button>
                  ) : null}
                </section>
              ) : (
                <>
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
                </>
              )}
            </div>
          ) : null}

          {tab === "preview" ? (
            <div className="space-y-6">
              <section className="surface-paper space-y-2 p-5 sm:px-6 sm:py-6">
                <p className="text-hairline text-muted-foreground">
                  Category · {values.topic || "—"}
                </p>
                <h2 className="font-display text-2xl tracking-tight">
                  {values.title || "Untitled assessment"}
                </h2>
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
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                  <div className="rounded-lg bg-secondary/50 px-3.5 py-3">
                    <dt className="text-xs text-muted-foreground">Questions</dt>
                    <dd className="mt-1 font-display text-xl tabular-nums">
                      {values.questions.length}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-secondary/50 px-3.5 py-3">
                    <dt className="text-xs text-muted-foreground">Multi-select</dt>
                    <dd className="mt-1 font-display text-xl tabular-nums">
                      {values.questions.filter((q) => q.multiSelect).length}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-secondary/50 px-3.5 py-3">
                    <dt className="text-xs text-muted-foreground">With explanation</dt>
                    <dd className="mt-1 font-display text-xl tabular-nums">
                      {values.questions.filter((q) => q.explanation.trim()).length}
                    </dd>
                  </div>
                </dl>
              </section>

              <section id="exam-preview-review" className="space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-hairline text-muted-foreground">Answer key preview</p>
                    <h2 className="mt-1 font-display text-2xl tracking-tight">How it will look</h2>
                    <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
                      Same card layout as the participant result review — correct answers and
                      explanations are highlighted for authors.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
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
                            "rounded-full border px-2.5 py-1 text-xs font-medium",
                            previewTag === value
                              ? "border-accent bg-accent/10 text-foreground"
                              : "border-input text-muted-foreground hover:bg-secondary",
                          )}
                        >
                          {value === "all" ? "All tags" : value}
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="whitespace-nowrap">Per page</span>
                      <select
                        value={previewPageSize}
                        onChange={(event) => {
                          setPreviewPageSize(Number(event.target.value));
                          setPreviewPage(0);
                        }}
                        className="rounded-md border border-input bg-card px-2.5 py-1.5 text-sm font-medium text-foreground"
                      >
                        {[5, 10, 15, 20].map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="space-y-5">
                  {pageQuestions.map((question, index) => {
                    const absoluteIndex = previewPage * previewPageSize + index;
                    const correctSet = new Set(question.correctIndexes);
                    const options = question.options
                      .map((option, optionIndex) => ({ option, optionIndex }))
                      .filter(({ option }) => option.trim());

                    return (
                      <article
                        key={`${question.prompt}-${absoluteIndex}`}
                        className="overflow-hidden rounded-xl border border-success/35 bg-card"
                      >
                        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-success/20 bg-success/8 px-5 py-4 sm:px-6 sm:py-5">
                          <div className="min-w-0 flex-1 pr-2">
                            <p className="text-xs text-muted-foreground">
                              Question {absoluteIndex + 1}
                              {question.subtopic ? ` · ${question.subtopic}` : ""}
                              {question.multiSelect ? " · select all that apply" : ""}
                            </p>
                            <h3 className="mt-2 text-base font-medium leading-snug sm:text-lg">
                              {question.prompt}
                            </h3>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-success/35 bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
                            <Check className="h-3.5 w-3.5" aria-hidden />
                            Key
                          </span>
                        </header>

                        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.9fr)]">
                          <div className="space-y-2.5 border-border px-5 py-5 sm:px-6 sm:py-6 lg:border-r">
                            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Options
                            </p>
                            {options.map(({ option, optionIndex }) => {
                              const isCorrect = correctSet.has(optionIndex);
                              return (
                                <div
                                  key={optionIndex}
                                  className={cn(
                                    "flex items-start gap-3 rounded-lg border px-3.5 py-3 text-sm leading-relaxed",
                                    isCorrect
                                      ? "border-success/45 bg-success/12 text-foreground"
                                      : "border-border/80 bg-background text-muted-foreground",
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border text-[11px] font-semibold",
                                      question.multiSelect ? "rounded-md" : "rounded-full",
                                      isCorrect
                                        ? "border-success bg-success text-success-foreground"
                                        : "border-border bg-card",
                                    )}
                                  >
                                    {String.fromCharCode(65 + optionIndex)}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className={cn(isCorrect && "font-medium")}>{option}</p>
                                    {isCorrect ? (
                                      <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                                        <Check className="h-3 w-3" aria-hidden />
                                        Correct answer
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <aside
                            className={cn(
                              "flex flex-col border-t border-border px-5 py-5 sm:px-6 sm:py-6 lg:border-t-0",
                              question.explanation.trim() ? "bg-accent/[0.06]" : "bg-secondary/25",
                            )}
                          >
                            <p
                              className={cn(
                                "flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide",
                                question.explanation.trim()
                                  ? "text-accent"
                                  : "text-muted-foreground",
                              )}
                            >
                              <Lightbulb className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              Explanation
                            </p>
                            {question.explanation.trim() ? (
                              <p className="mt-3 flex-1 text-sm leading-relaxed text-foreground/90">
                                {question.explanation}
                              </p>
                            ) : (
                              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                                No explanation yet. Add one on the Questions step so participants
                                see it after scoring.
                              </p>
                            )}
                            <div className="mt-5 space-y-2 border-t border-border/70 pt-4 text-xs text-muted-foreground">
                              <p>
                                <span className="font-medium text-foreground">Correct: </span>
                                {[...correctSet]
                                  .sort((a, b) => a - b)
                                  .map((i) => String.fromCharCode(65 + i))
                                  .join(", ") || "—"}
                              </p>
                            </div>
                          </aside>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3.5 sm:px-5">
                  <p className="text-sm text-muted-foreground">
                    Showing{" "}
                    <span className="font-medium text-foreground">
                      {previewRangeStart}–{previewRangeEnd}
                    </span>{" "}
                    of <span className="font-medium text-foreground">{filteredPreview.length}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewPage((page) => Math.max(0, page - 1));
                        document
                          .getElementById("exam-preview-review")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      disabled={previewPage === 0}
                      className="inline-flex items-center gap-1 rounded-md border border-input px-3.5 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
                    >
                      <ChevronLeft className="h-4 w-4" /> Previous
                    </button>
                    <span className="min-w-[5.5rem] text-center text-sm tabular-nums text-muted-foreground">
                      Page {previewPage + 1} / {previewPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewPage((page) => Math.min(previewPages - 1, page + 1));
                        document
                          .getElementById("exam-preview-review")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      disabled={previewPage >= previewPages - 1}
                      className="inline-flex items-center gap-1 rounded-md border border-input px-3.5 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
                    >
                      Next <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </section>

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
