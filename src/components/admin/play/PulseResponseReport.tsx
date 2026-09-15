import { getPulseReportState } from "@/lib/play.pulse.functions";
import type { PulseWallAggregate } from "@/lib/play.pulse";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type ReportAnswer = {
  questionNumber: number;
  slideIndex: number;
  type: string;
  prompt: string;
  answerText: string;
  submittedAt: string | null;
};

type ReportRow = {
  userId: string;
  name: string;
  email: string | null;
  answeredCount: number;
  complete?: boolean;
  answers: ReportAnswer[];
};

type OverviewRow = {
  questionNumber: number;
  slideIndex: number;
  type: string;
  prompt: string;
  responseCount: number;
  wall: PulseWallAggregate;
};

type ReportData = {
  pulse?: { id: string; name: string; status: string; joinCode: string };
  questionCount?: number;
  participantCount?: number;
  completedCount?: number;
  overview?: OverviewRow[];
  reports?: ReportRow[];
};

const CHART_COLORS = [
  "#0f766e",
  "#e11d48",
  "#d97706",
  "#0284c7",
  "#059669",
  "#ea580c",
  "#0891b2",
  "#65a30d",
];

const actionBtn =
  "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-60";

export function PulseResponseReport({ pulseId }: { pulseId: string }) {
  const fetchReport = useServerFn(getPulseReportState);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"overall" | "individual">("overall");
  const [typeFilter, setTypeFilter] = useState<"all" | string>("all");

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["pulse-report", pulseId],
    queryFn: () => fetchReport({ data: { pulseId } }),
    refetchInterval: 8000,
  });

  const report = data as ReportData | undefined;
  const reports = useMemo(() => report?.reports ?? [], [report?.reports]);
  const overview = useMemo(() => report?.overview ?? [], [report?.overview]);
  const questionCount = report?.questionCount ?? 0;
  const participantCount = report?.participantCount ?? reports.length;
  const completedCount = report?.completedCount ?? reports.filter((r) => r.complete).length;
  const completionRate =
    participantCount > 0 ? Math.round((completedCount / participantCount) * 100) : 0;
  const pulseName = report?.pulse?.name ?? "Pulse";

  const filteredOverview = useMemo(() => {
    if (typeFilter === "all") return overview;
    return overview.filter((row) => row.type === typeFilter);
  }, [overview, typeFilter]);

  const typeOptions = useMemo(() => {
    const set = new Set(overview.map((o) => o.type));
    return ["all", ...[...set].sort()];
  }, [overview]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.email ?? "").toLowerCase().includes(q),
    );
  }, [reports, query]);

  const selected = filtered.find((r) => r.userId === selectedUserId) ?? filtered[0] ?? null;

  function download(format: "csv" | "json") {
    if (!report) return;
    try {
      if (format === "json") {
        downloadBlob(
          JSON.stringify(buildJsonReport(report), null, 2),
          `${slugify(pulseName)}-report.json`,
          "application/json;charset=utf-8",
        );
      } else {
        downloadBlob(
          buildCsvReport(report),
          `${slugify(pulseName)}-report.csv`,
          "text/csv;charset=utf-8",
        );
      }
      toast.success(`Downloaded ${format.toUpperCase()} report`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    }
  }

  if (isPending && !data) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Loading response report…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Could not load report."}
        </p>
        <button
          type="button"
          className="mt-2 text-xs text-accent underline"
          onClick={() => void refetch()}
        >
          Retry
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="min-w-0">
          <h2 className="font-display text-xl">Response report</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {pulseName}
            {report?.pulse?.joinCode ? ` · code ${report.pulse.joinCode}` : ""} · sections excluded
            from question counts
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={actionBtn} onClick={() => void refetch()}>
            Refresh
          </button>
          <button type="button" className={actionBtn} onClick={() => download("csv")}>
            Download CSV
          </button>
          <button type="button" className={actionBtn} onClick={() => download("json")}>
            Download JSON
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Participants" value={participantCount} hint="Joined the pulse" />
        <StatCard
          label="Completed"
          value={completedCount}
          hint={`${completionRate}% completion rate`}
        />
        <StatCard label="Questions" value={questionCount} hint="Answerable items only" />
        <StatCard
          label="Avg answered"
          value={
            participantCount
              ? Math.round(
                  (reports.reduce((s, r) => s + r.answeredCount, 0) / participantCount) * 10,
                ) / 10
              : 0
          }
          hint={`of ${questionCount} questions`}
        />
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-secondary/30 p-1">
        {(
          [
            ["overall", "Overall responses"],
            ["individual", "Individual responses"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={cn(
              "rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              tab === id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overall" ? (
        <section
          className="rounded-2xl border border-border bg-card p-4 sm:p-5"
          aria-label="Overall responses"
        >
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
            <div>
              <h3 className="text-sm font-semibold">Question breakdown</h3>
              <p className="text-xs text-muted-foreground">
                Counts, bar, and pie for each question · {filteredOverview.length} shown
              </p>
            </div>
            <label className="text-xs">
              Type
              <select
                className="field ml-2 h-8 w-auto min-w-[8rem] text-xs"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                {typeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t === "all" ? "All types" : t}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filteredOverview.length === 0 ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              No questions to chart yet.
            </p>
          ) : (
            <ul className="mt-5 grid gap-4 xl:grid-cols-2">
              {filteredOverview.map((row) => (
                <li
                  key={row.slideIndex}
                  className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-secondary/20 via-card to-background"
                >
                  <div className="border-b border-border/70 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-teal-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        Q{row.questionNumber}
                      </span>
                      <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {row.type}
                      </span>
                      <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                        {row.responseCount} response{row.responseCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium leading-snug">{row.prompt}</p>
                  </div>
                  <div className="flex-1 px-4 py-3">
                    <QuestionCharts wall={row.wall} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section
          className="rounded-2xl border border-border bg-card p-4 sm:p-5"
          aria-label="Individual responses"
        >
          <div className="border-b border-border pb-4">
            <h3 className="text-sm font-semibold">Per participant</h3>
            <p className="text-xs text-muted-foreground">
              Select a person to review their answers · {questionCount} questions
            </p>
          </div>

          {reports.length === 0 ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">No participants yet.</p>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(14rem,18rem)_1fr]">
              <aside className="space-y-2 rounded-xl border border-border bg-secondary/15 p-3">
                <label className="block text-xs">
                  Search
                  <input
                    className="field mt-1 h-8 w-full text-sm"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Name or email"
                  />
                </label>
                <ul className="max-h-[28rem] space-y-1 overflow-y-auto">
                  {filtered.map((row) => (
                    <li key={row.userId}>
                      <button
                        type="button"
                        className={cn(
                          "w-full rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-secondary",
                          selected?.userId === row.userId &&
                            "bg-teal-500/15 font-medium ring-1 ring-teal-600/30",
                        )}
                        onClick={() => setSelectedUserId(row.userId)}
                      >
                        <span className="block truncate">{row.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {row.answeredCount}/{questionCount}
                          {row.complete ? " · complete" : " · in progress"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </aside>

              <div className="min-w-0 rounded-xl border border-border bg-secondary/10 p-3 sm:p-4">
                {selected ? (
                  <div className="space-y-3">
                    <div className="border-b border-border pb-3">
                      <p className="text-base font-semibold">{selected.name}</p>
                      {selected.email ? (
                        <p className="text-xs text-muted-foreground">{selected.email}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selected.answeredCount}/{questionCount} answered
                        {selected.complete ? " · survey complete" : ""}
                      </p>
                    </div>
                    <ol className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
                      {selected.answers.map((answer) => (
                        <li
                          key={answer.slideIndex}
                          className="rounded-xl border border-border bg-card px-3 py-2.5"
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Q{answer.questionNumber} · {answer.type}
                          </p>
                          <p className="mt-1 text-sm font-medium">{answer.prompt}</p>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">
                            {answer.answerText}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Select a participant.</p>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-3xl tabular-nums leading-none">{value}</p>
      {hint ? <p className="mt-1.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function QuestionCharts({ wall }: { wall: PulseWallAggregate }) {
  if (wall.kind === "section") return null;

  if (wall.kind === "text") {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">{wall.total} open responses</p>
        {wall.items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            No text answers yet
          </p>
        ) : (
          <ul className="max-h-48 space-y-1.5 overflow-y-auto">
            {wall.items.slice(0, 12).map((item, i) => (
              <li
                key={`${item.userId}-${i}`}
                className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs leading-snug"
              >
                {item.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (wall.kind === "matrix") {
    const max = Math.max(wall.max, 1);
    return (
      <ul className="space-y-2.5">
        {wall.rows.map((row, i) => (
          <li key={`${row.label}-${i}`}>
            <div className="mb-1 flex justify-between gap-2 text-xs">
              <span className="font-medium">{row.label}</span>
              <span className="tabular-nums text-muted-foreground">
                avg {row.average} · n={row.count}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.round((row.average / max) * 100)}%`,
                  backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  const slices =
    wall.kind === "rating"
      ? wall.histogram.map((h) => ({
          label: String(h.rating),
          count: h.count,
          percent: wall.total ? Math.round((h.count / wall.total) * 100) : 0,
        }))
      : wall.options.map((o) => ({
          label: o.label,
          count: o.count,
          percent: o.percent,
        }));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Distribution
        </p>
        <ul className="space-y-2">
          {slices.map((s, i) => (
            <li key={`${s.label}-${i}`}>
              <div className="mb-0.5 flex justify-between gap-2 text-xs">
                <span className="truncate font-medium">{s.label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {s.percent}% ({s.count})
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{
                    width: `${wall.total === 0 ? 0 : Math.max(s.percent, s.count > 0 ? 6 : 0)}%`,
                    backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
        {wall.kind === "rating" ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Average <span className="font-semibold text-foreground">{wall.average}</span> · scale 1–
            {wall.max}
          </p>
        ) : null}
      </div>
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Share
        </p>
        <PieChart slices={slices} />
      </div>
    </div>
  );
}

function PieChart({
  slices,
}: {
  slices: Array<{ label: string; count: number; percent: number }>;
}) {
  const total = slices.reduce((s, x) => s + x.count, 0);
  if (total === 0) {
    return (
      <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
        No responses yet
      </div>
    );
  }

  const r = 54;
  const cx = 64;
  const cy = 64;
  let angle = 0;
  const arcs: Array<{ d: string; color: string; label: string }> = [];

  for (let i = 0; i < slices.length; i++) {
    const slice = slices[i]!;
    if (slice.count <= 0) continue;
    const sweep = (slice.count / total) * 360;
    const start = angle;
    const end = angle + sweep;
    arcs.push({
      d: describeArc(cx, cy, r, start, end),
      color: CHART_COLORS[i % CHART_COLORS.length]!,
      label: `${slice.label} ${slice.percent}%`,
    });
    angle = end;
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <svg viewBox="0 0 128 128" className="h-32 w-32 shrink-0" role="img" aria-label="Pie chart">
        {arcs.length === 1 ? (
          <circle cx={cx} cy={cy} r={r} fill={arcs[0]!.color} />
        ) : (
          arcs.map((a) => <path key={a.label} d={a.d} fill={a.color} />)
        )}
        <circle cx={cx} cy={cy} r={28} className="fill-card" />
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          className="fill-foreground text-[11px] font-semibold"
        >
          {total}
        </text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-1 text-[11px]">
        {slices
          .filter((s) => s.count > 0)
          .map((s, i) => (
            <li key={`${s.label}-${i}`} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              <span className="truncate">{s.label}</span>
              <span className="ml-auto tabular-nums text-muted-foreground">{s.percent}%</span>
            </li>
          ))}
      </ul>
    </div>
  );
}

function pointOnCircle(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = pointOnCircle(cx, cy, r, endAngle);
  const end = pointOnCircle(cx, cy, r, startAngle);
  const large = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${end.x} ${end.y} A ${r} ${r} 0 ${large} 1 ${start.x} ${start.y} Z`;
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "pulse"
  );
}

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function wallBreakdown(wall: PulseWallAggregate): string {
  if (wall.kind === "mcq" || wall.kind === "multi") {
    return wall.options.map((o) => `${o.label}: ${o.count} (${o.percent}%)`).join(" | ");
  }
  if (wall.kind === "rating") {
    return `avg ${wall.average}; ${wall.histogram.map((h) => `${h.rating}=${h.count}`).join(", ")}`;
  }
  if (wall.kind === "matrix") {
    return wall.rows.map((r) => `${r.label}: avg ${r.average} (n=${r.count})`).join(" | ");
  }
  if (wall.kind === "text") {
    return wall.items
      .slice(0, 20)
      .map((i) => i.text)
      .join(" || ");
  }
  return "";
}

function buildCsvReport(data: ReportData): string {
  const lines: string[] = [];
  const pulse = data.pulse;
  lines.push("Pulse response report");
  lines.push(`Name,${csvEscape(pulse?.name ?? "")}`);
  lines.push(`Code,${csvEscape(pulse?.joinCode ?? "")}`);
  lines.push(`Status,${csvEscape(pulse?.status ?? "")}`);
  lines.push(`Participants,${data.participantCount ?? 0}`);
  lines.push(`Completed,${data.completedCount ?? 0}`);
  lines.push(`Questions,${data.questionCount ?? 0}`);
  lines.push("");
  lines.push("OVERALL");
  lines.push(["question", "type", "prompt", "responses", "breakdown"].join(","));
  for (const row of data.overview ?? []) {
    lines.push(
      [
        String(row.questionNumber),
        row.type,
        csvEscape(row.prompt),
        String(row.responseCount),
        csvEscape(wallBreakdown(row.wall)),
      ].join(","),
    );
  }
  lines.push("");
  lines.push("INDIVIDUAL");
  const questions = data.overview ?? [];
  lines.push(
    [
      "participant",
      "email",
      "answered",
      "complete",
      ...questions.map((q) => `Q${q.questionNumber}`),
    ].join(","),
  );
  for (const person of data.reports ?? []) {
    const bySlide = new Map(person.answers.map((a) => [a.slideIndex, a.answerText]));
    lines.push(
      [
        csvEscape(person.name),
        csvEscape(person.email ?? ""),
        String(person.answeredCount),
        person.complete ? "yes" : "no",
        ...questions.map((q) => csvEscape(bySlide.get(q.slideIndex) ?? "")),
      ].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

function buildJsonReport(data: ReportData) {
  return {
    generatedAt: new Date().toISOString(),
    pulse: data.pulse ?? null,
    summary: {
      participantCount: data.participantCount ?? 0,
      completedCount: data.completedCount ?? 0,
      questionCount: data.questionCount ?? 0,
    },
    overall: (data.overview ?? []).map((row) => ({
      questionNumber: row.questionNumber,
      type: row.type,
      prompt: row.prompt,
      responseCount: row.responseCount,
      breakdown: wallBreakdown(row.wall),
      wall: row.wall,
    })),
    individuals: (data.reports ?? []).map((person) => ({
      name: person.name,
      email: person.email,
      answeredCount: person.answeredCount,
      complete: Boolean(person.complete),
      answers: person.answers.map((a) => ({
        questionNumber: a.questionNumber,
        type: a.type,
        prompt: a.prompt,
        answer: a.answerText,
        submittedAt: a.submittedAt,
      })),
    })),
  };
}

function downloadBlob(body: string, filename: string, type: string) {
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
