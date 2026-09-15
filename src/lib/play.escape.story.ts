/**
 * Escape Room story import (TXT / CSV) and Cyber Attack template.
 * Stages can use pool topics, embedded questions, or none (story beat / finale).
 */
import type { RewardCode } from "@/lib/play.math";

export type EscapeQuestionSource = "pool" | "upload" | "manual" | "none";

export type EscapeStoryQuestion = {
  prompt: string;
  options: string[];
  correctIndexes: number[];
  multiSelect?: boolean;
  explanation?: string;
  topic?: string;
  subtopic?: string;
  difficulty?: "easy" | "medium" | "hard";
};

export type EscapeStoryScene = {
  stageKey: string;
  title: string;
  body: string;
  topic: string;
  questionCount: number;
  questionSource: EscapeQuestionSource;
  rewardCode: RewardCode | null;
  rewardLabel: string;
  questions: EscapeStoryQuestion[];
};

export type EscapeStoryDraft = {
  name: string;
  intro: string;
  scenes: EscapeStoryScene[];
};

const REWARD_CODES: RewardCode[] = [
  "xp_50",
  "xp_100",
  "badge",
  "avatar",
  "double_xp",
  "extra_life",
  "mock_voucher",
];

const SOURCE_SET = new Set<EscapeQuestionSource>(["pool", "upload", "manual", "none"]);

export const ESCAPE_STORY_TEMPLATE_INSTRUCTIONS = `Escape story formats

TXT (recommended)
# Scenario title
Intro: One or more lines of briefing copy…

## 1. Stage title
Body: Story for this stage…
Topic: Networking
Questions: 4
Source: pool
Reward: xp_50|+50 XP — foothold secured

## 9. SYSTEM RESTORED
Body: Services are healthy. Document the RCA.
Questions: 0
Source: none
Reward: badge|Incident Commander

CSV columns
sort_order,stage_key,title,body,topic,question_count,question_source,reward_code,reward_label

question_source: pool | upload | manual | none
reward_code: xp_50 | xp_100 | badge | avatar | double_xp | extra_life | mock_voucher (optional)
Embedded questions for upload/manual stages are edited in the admin UI (or attach a pool CSV per stage after import).
`;

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

function parseReward(raw: string | undefined): { code: RewardCode | null; label: string } {
  if (!raw?.trim()) return { code: null, label: "" };
  const [codePart, ...rest] = raw.split("|");
  const code = (codePart ?? "").trim() as RewardCode;
  const label = rest.join("|").trim();
  if (!REWARD_CODES.includes(code)) return { code: null, label: raw.trim() };
  return { code, label };
}

function parseSource(raw: string | undefined, questionCount: number): EscapeQuestionSource {
  const v = (raw ?? "").trim().toLowerCase() as EscapeQuestionSource;
  if (SOURCE_SET.has(v)) return v;
  return questionCount <= 0 ? "none" : "pool";
}

function emptyScene(partial?: Partial<EscapeStoryScene>): EscapeStoryScene {
  return {
    stageKey: "",
    title: "",
    body: "",
    topic: "general",
    questionCount: 4,
    questionSource: "pool",
    rewardCode: null,
    rewardLabel: "",
    questions: [],
    ...partial,
  };
}

/** Canonical Cyber Attack arc — maps cleanly to AWS pool topics. */
export function cyberAttackStory(): EscapeStoryDraft {
  const stages: Array<{
    key: string;
    title: string;
    body: string;
    topic: string;
    questions: number;
    source: EscapeQuestionSource;
    reward: string;
  }> = [
    {
      key: "reconnaissance",
      title: "Reconnaissance",
      body: "Unusual scans hit the perimeter. Map the attacker’s footprint before they pivot deeper.",
      topic: "Reconnaissance",
      questions: 4,
      source: "pool",
      reward: "xp_50|+50 XP — foothold mapped",
    },
    {
      key: "networking",
      title: "Networking",
      body: "Suspicious traffic crosses VPC boundaries. Isolate compromised routes and lock down security groups.",
      topic: "Networking",
      questions: 4,
      source: "pool",
      reward: "xp_50|+50 XP — network contained",
    },
    {
      key: "compute",
      title: "Compute",
      body: "Workloads show anomalous CPU and process activity. Identify compromised instances and harden launch templates.",
      topic: "Compute",
      questions: 4,
      source: "pool",
      reward: "xp_50|+50 XP — compute secured",
    },
    {
      key: "storage",
      title: "Storage",
      body: "Bucket policies look wrong. Find exposed objects, rotate access, and restore from known-good backups.",
      topic: "Storage",
      questions: 4,
      source: "pool",
      reward: "xp_50|+50 XP — data sealed",
    },
    {
      key: "database",
      title: "Database",
      body: "Query spikes and privilege changes hit the data tier. Audit roles, snapshots, and encryption.",
      topic: "Database",
      questions: 4,
      source: "pool",
      reward: "xp_100|+100 XP — data tier restored",
    },
    {
      key: "security",
      title: "Security",
      body: "IAM keys and policies were abused. Rotate credentials, tighten least privilege, and close the blast radius.",
      topic: "Security",
      questions: 4,
      source: "pool",
      reward: "extra_life|Extra life — incident buffer",
    },
    {
      key: "monitoring",
      title: "Monitoring",
      body: "Alerts were muted or ignored. Rebuild detections so the next intrusion cannot hide.",
      topic: "Monitoring",
      questions: 4,
      source: "pool",
      reward: "xp_50|+50 XP — visibility restored",
    },
    {
      key: "devops",
      title: "DevOps",
      body: "Pipelines may have been poisoned. Verify CI/CD, redeploy clean artifacts, and gate future releases.",
      topic: "DevOps",
      questions: 4,
      source: "pool",
      reward: "double_xp|Double XP (24h) — recovery sprint",
    },
    {
      key: "system_restored",
      title: "SYSTEM RESTORED",
      body: "Critical systems are back online. Document the RCA, confirm runbooks, and stand down the war room.",
      topic: "general",
      questions: 0,
      source: "none",
      reward: "badge|Incident Commander",
    },
  ];

  return {
    name: "Cyber Attack",
    intro:
      "CRITICAL ALERT — Your organization's cloud environment has been compromised. An attacker has locked critical systems. Your team has 45 minutes to identify the attack, secure the infrastructure, and restore the application.",
    scenes: stages.map((s) => {
      const reward = parseReward(s.reward);
      return emptyScene({
        stageKey: s.key,
        title: s.title,
        body: s.body,
        topic: s.topic,
        questionCount: s.questions,
        questionSource: s.source,
        rewardCode: reward.code,
        rewardLabel: reward.label,
      });
    }),
  };
}

function cyberAttackTxt(): string {
  const story = cyberAttackStory();
  const lines = [`# ${story.name}`, `Intro: ${story.intro}`, ""];
  story.scenes.forEach((scene, i) => {
    lines.push(`## ${i + 1}. ${scene.title}`);
    lines.push(`Body: ${scene.body}`);
    lines.push(`Topic: ${scene.topic}`);
    lines.push(`Questions: ${scene.questionCount}`);
    lines.push(`Source: ${scene.questionSource}`);
    if (scene.rewardCode) {
      lines.push(`Reward: ${scene.rewardCode}|${scene.rewardLabel}`);
    }
    lines.push("");
  });
  return lines.join("\n").trim() + "\n";
}

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function cyberAttackCsv(): string {
  const story = cyberAttackStory();
  const header =
    "sort_order,stage_key,title,body,topic,question_count,question_source,reward_code,reward_label";
  const rows = story.scenes.map((scene, i) =>
    [
      String(i + 1),
      scene.stageKey,
      scene.title,
      scene.body,
      scene.topic,
      String(scene.questionCount),
      scene.questionSource,
      scene.rewardCode ?? "",
      scene.rewardLabel,
    ]
      .map(csvEscape)
      .join(","),
  );
  return [header, ...rows].join("\n") + "\n";
}

export function downloadEscapeStoryTemplate(format: "txt" | "csv") {
  const body = format === "csv" ? cyberAttackCsv() : cyberAttackTxt();
  const mime = format === "csv" ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8";
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `escape-cyber-attack.${format}`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function parseEscapeStoryCsv(raw: string): EscapeStoryDraft {
  const lines = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error("CSV needs a header row and at least one stage.");
  const header = parseCsvLine(lines[0]!).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const scenes: EscapeStoryScene[] = [];
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const title = (cols[idx("title")] ?? "").trim();
    if (!title) continue;
    const questionCount = Math.max(0, Number(cols[idx("question_count")] ?? 4) || 0);
    const reward = parseReward(
      [cols[idx("reward_code")] ?? "", cols[idx("reward_label")] ?? ""].filter(Boolean).join("|") ||
        undefined,
    );
    const topic = (cols[idx("topic")] ?? "general").trim() || "general";
    const stageKey =
      (cols[idx("stage_key")] ?? "").trim() || slugify(title) || `stage_${scenes.length + 1}`;
    scenes.push(
      emptyScene({
        stageKey,
        title,
        body: (cols[idx("body")] ?? "").trim(),
        topic,
        questionCount,
        questionSource: parseSource(cols[idx("question_source")], questionCount),
        rewardCode: reward.code,
        rewardLabel: reward.label,
      }),
    );
  }
  if (!scenes.length) throw new Error("No stages found in CSV.");
  return {
    name: "Imported escape story",
    intro: "",
    scenes,
  };
}

export function parseEscapeStoryTxt(raw: string): EscapeStoryDraft {
  const text = raw
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!text) throw new Error("Story text is empty.");

  let name = "Imported escape story";
  let intro = "";
  const scenes: EscapeStoryScene[] = [];

  const titleMatch = text.match(/^#\s+(.+)$/m);
  if (titleMatch?.[1]) name = titleMatch[1].trim();

  const introMatch = text.match(/^Intro:\s*(.+)$/im);
  if (introMatch?.[1]) intro = introMatch[1].trim();

  const chunks = text.split(/^##\s+/m).slice(1);
  for (const chunk of chunks) {
    const lines = chunk.split("\n");
    const heading = (lines[0] ?? "").replace(/^\d+[.)]\s*/, "").trim();
    if (!heading) continue;

    let body = "";
    let topic = "general";
    let questionCount = 4;
    let sourceRaw = "";
    let rewardRaw = "";

    for (const line of lines.slice(1)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const bodyM = trimmed.match(/^Body:\s*(.*)$/i);
      if (bodyM) {
        body = bodyM[1] ?? "";
        continue;
      }
      const topicM = trimmed.match(/^Topic:\s*(.+)$/i);
      if (topicM) {
        topic = topicM[1]!.trim();
        continue;
      }
      const qM = trimmed.match(/^Questions?:\s*(\d+)/i);
      if (qM) {
        questionCount = Math.max(0, Number(qM[1]) || 0);
        continue;
      }
      const sM = trimmed.match(/^Source:\s*(.+)$/i);
      if (sM) {
        sourceRaw = sM[1]!.trim();
        continue;
      }
      const rM = trimmed.match(/^Reward:\s*(.+)$/i);
      if (rM) {
        rewardRaw = rM[1]!.trim();
        continue;
      }
      if (!body && !/^(Topic|Questions?|Source|Reward):/i.test(trimmed)) {
        body = body ? `${body}\n${trimmed}` : trimmed;
      }
    }

    const reward = parseReward(rewardRaw);
    scenes.push(
      emptyScene({
        stageKey: slugify(heading) || `stage_${scenes.length + 1}`,
        title: heading,
        body,
        topic,
        questionCount,
        questionSource: parseSource(sourceRaw, questionCount),
        rewardCode: reward.code,
        rewardLabel: reward.label,
      }),
    );
  }

  if (!scenes.length) {
    // Fallback: treat whole file as Cyber Attack if it looks like an alert brief
    if (/cyber|compromised|system restored/i.test(text)) {
      return cyberAttackStory();
    }
    throw new Error("No ## stages found. Use the Cyber Attack TXT template.");
  }

  return { name, intro, scenes };
}

export function parseEscapeStoryImport(raw: string): EscapeStoryDraft {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Paste or upload a story file first.");
  const first = trimmed.split(/\r?\n/)[0] ?? "";
  if (/sort_order\s*,\s*stage_key/i.test(first) || /^sort_order,/i.test(first)) {
    return parseEscapeStoryCsv(trimmed);
  }
  return parseEscapeStoryTxt(trimmed);
}

export function applyCyberAttackTemplate(): EscapeStoryDraft {
  return cyberAttackStory();
}
