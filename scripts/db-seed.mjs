#!/usr/bin/env node
/**
 * Seed the remote database with admin + rich demo data for UI visualisation.
 *
 * Usage:
 *   npm run db:seed
 *
 * Env:
 *   SUPABASE_URL / SUPABASE_PROJECT_ID
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SEED_ADMIN_EMAIL
 *   SEED_ADMIN_PASSWORD  (min 12 chars)
 *   SEED_DEMO_PASSWORD   (optional; defaults to SEED_ADMIN_PASSWORD)
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  assertProjectUrlConsistency,
  loadEnv,
  requireEnv,
  resolveSupabaseProjectId,
  resolveSupabaseUrl,
} from "./lib/env.mjs";

loadEnv();

const projectId = resolveSupabaseProjectId();
const supabaseUrl = resolveSupabaseUrl(projectId);
assertProjectUrlConsistency(projectId, supabaseUrl);

const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const email = requireEnv("SEED_ADMIN_EMAIL").toLowerCase();
const password = requireEnv("SEED_ADMIN_PASSWORD");
const demoPassword = (process.env.SEED_DEMO_PASSWORD || password).trim();

if (password.length < 12) {
  console.error("[db:seed] SEED_ADMIN_PASSWORD must be at least 12 characters.");
  process.exit(1);
}
if (demoPassword.length < 12) {
  console.error("[db:seed] SEED_DEMO_PASSWORD must be at least 12 characters.");
  process.exit(1);
}

const keyLooksValid = serviceRoleKey.startsWith("eyJ") || serviceRoleKey.startsWith("sb_secret_");
if (!keyLooksValid) {
  console.error(
    "[db:seed] SUPABASE_SERVICE_ROLE_KEY looks invalid (expected eyJ… JWT or sb_secret_…).",
  );
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function pid() {
  return `AS-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function daysFromNow(days) {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

async function ensureAuthUser({
  email: userEmail,
  password: userPassword,
  fullName,
  metadata = {},
}) {
  const normalised = userEmail.toLowerCase();
  const created = await admin.auth.admin.createUser({
    email: normalised,
    password: userPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName, ...metadata },
  });

  if (created.data?.user?.id) return created.data.user.id;

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", normalised)
    .maybeSingle();
  let userId = profile?.id ?? null;
  if (!userId) {
    const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    userId = listed?.users.find((u) => u.email?.toLowerCase() === normalised)?.id ?? null;
  }
  if (!userId) {
    throw new Error(created.error?.message ?? `Could not create/find ${normalised}`);
  }
  const updated = await admin.auth.admin.updateUserById(userId, {
    password: userPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName, ...metadata },
  });
  if (updated.error) throw new Error(updated.error.message);
  return userId;
}

async function upsertProfile(row) {
  const { error } = await admin.from("profiles").upsert(row, { onConflict: "id" });
  if (error) throw error;
}

async function ensureRole(userId, role) {
  const { error } = await admin
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
  if (error) throw error;
}

async function ensureStreaks(userId, extras = {}) {
  const rows = [
    {
      user_id: userId,
      streak_type: "exam",
      current_count: extras.exam ?? 0,
      longest_count: extras.examLongest ?? extras.exam ?? 0,
    },
    {
      user_id: userId,
      streak_type: "pass",
      current_count: extras.pass ?? 0,
      longest_count: extras.passLongest ?? extras.pass ?? 0,
    },
    {
      user_id: userId,
      streak_type: "high_score",
      current_count: extras.high ?? 0,
      longest_count: extras.highLongest ?? extras.high ?? 0,
    },
  ];
  const { error } = await admin
    .from("user_streaks")
    .upsert(rows, { onConflict: "user_id,streak_type" });
  if (error) throw error;
}

console.log(`[db:seed] project=${projectId}`);
console.log(`[db:seed] url=${supabaseUrl}`);
console.log(`[db:seed] admin=${email}`);

/* ------------------------------------------------------------------ */
/* admin                                                               */
/* ------------------------------------------------------------------ */

const adminId = await ensureAuthUser({
  email,
  password,
  fullName: "Platform Administrator",
});
console.log("[db:seed] admin auth ready");

await upsertProfile({
  id: adminId,
  email,
  full_name: "Platform Administrator",
  organization: "Assessa Labs",
  department: "Platform",
  team_group: "Platform",
  participant_id: pid(),
  display_name: "Admin",
  mobile: "+61 400 000 001",
});
await ensureRole(adminId, "admin");
await ensureStreaks(adminId, { exam: 2, pass: 2, high: 1 });

/* ------------------------------------------------------------------ */
/* catalog + baseline                                                  */
/* ------------------------------------------------------------------ */

const { error: levelsError } = await admin.from("levels").upsert(
  [
    { level: 1, name: "Beginner", min_xp: 0 },
    { level: 2, name: "Explorer", min_xp: 150 },
    { level: 3, name: "Learner", min_xp: 400 },
    { level: 4, name: "Skilled", min_xp: 750 },
    { level: 5, name: "Advanced", min_xp: 1200 },
    { level: 6, name: "Expert", min_xp: 1700 },
    { level: 7, name: "Specialist", min_xp: 2200 },
    { level: 8, name: "Master", min_xp: 2400 },
    { level: 9, name: "Champion", min_xp: 3000 },
    { level: 10, name: "Grand Master", min_xp: 4000 },
  ],
  { onConflict: "level" },
);
if (levelsError) console.warn("[db:seed] levels:", levelsError.message);

const orgs = [
  { name: "Assessa Labs", teams: ["Platform", "Learning", "Delivery"] },
  { name: "Northwind Academy", teams: ["Year 10", "Year 11", "Faculty"] },
  { name: "Contoso Corp", teams: ["Engineering", "People Ops", "Sales"] },
];

const orgIds = {};
for (const org of orgs) {
  const { data: existing } = await admin
    .from("organizations")
    .select("id")
    .eq("name", org.name)
    .maybeSingle();
  let orgId = existing?.id;
  if (!orgId) {
    const { data, error } = await admin
      .from("organizations")
      .insert({ name: org.name, active: true })
      .select("id")
      .single();
    if (error) throw error;
    orgId = data.id;
  }
  orgIds[org.name] = orgId;

  for (const team of org.teams) {
    const { data: dept } = await admin
      .from("departments")
      .select("id")
      .eq("organization_id", orgId)
      .eq("name", team)
      .maybeSingle();
    if (!dept) {
      const { error } = await admin
        .from("departments")
        .insert({ organization_id: orgId, name: team, active: true });
      if (error && !/duplicate|unique/i.test(error.message)) throw error;
    }
  }
}
console.log("[db:seed] organisations + teams/groups ready");

/* ------------------------------------------------------------------ */
/* demo participants                                                   */
/* ------------------------------------------------------------------ */

const DEMO_USERS = [
  {
    email: "demo.ada@assessa.test",
    fullName: "Ada Lovelace",
    organization: "Assessa Labs",
    department: "Learning",
    displayName: "Ada",
    mobile: "+61 400 100 001",
    streaks: { exam: 4, pass: 3, high: 2 },
  },
  {
    email: "demo.grace@assessa.test",
    fullName: "Grace Hopper",
    organization: "Assessa Labs",
    department: "Platform",
    displayName: "Grace",
    mobile: "+61 400 100 002",
    streaks: { exam: 6, pass: 5, high: 3 },
  },
  {
    email: "demo.alan@assessa.test",
    fullName: "Alan Turing",
    organization: "Contoso Corp",
    department: "Engineering",
    displayName: "Alan",
    mobile: "+61 400 100 003",
    streaks: { exam: 3, pass: 2, high: 1 },
  },
  {
    email: "demo.katherine@assessa.test",
    fullName: "Katherine Johnson",
    organization: "Northwind Academy",
    department: "Faculty",
    displayName: "Katherine",
    mobile: "+61 400 100 004",
    streaks: { exam: 5, pass: 4, high: 2 },
  },
  {
    email: "demo.linus@assessa.test",
    fullName: "Linus Torvalds",
    organization: "Contoso Corp",
    department: "Engineering",
    displayName: "Linus",
    mobile: "+61 400 100 005",
    streaks: { exam: 2, pass: 1, high: 1 },
  },
];

const demoIds = {};
for (const user of DEMO_USERS) {
  const id = await ensureAuthUser({
    email: user.email,
    password: demoPassword,
    fullName: user.fullName,
  });
  demoIds[user.email] = id;
  await upsertProfile({
    id,
    email: user.email,
    full_name: user.fullName,
    organization: user.organization,
    department: user.department,
    team_group: user.department,
    display_name: user.displayName,
    mobile: user.mobile,
    participant_id: pid(),
    leaderboard_opt_out: false,
  });
  await ensureRole(id, "participant");
  await ensureStreaks(id, user.streaks);
}
console.log(`[db:seed] ${DEMO_USERS.length} demo participants ready`);

/* ------------------------------------------------------------------ */
/* exams covering modes + access types                                 */
/* ------------------------------------------------------------------ */

const DEMO_EXAMS = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    title: "JavaScript Fundamentals",
    description: "Core language concepts: types, scope, functions and arrays.",
    topic: "JavaScript",
    mode: "assessment",
    access: "public",
    duration_minutes: 15,
    pass_mark: 60,
    max_attempts: 3,
    starts_at: daysFromNow(-3),
    ends_at: daysFromNow(30),
    enable_leaderboard: true,
    enable_xp: true,
    enable_badges: true,
    show_rank: true,
    leaderboard_name_display: "first_initial",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    title: "Advanced JavaScript & Async",
    description: "Closures, promises, event loop and async patterns.",
    topic: "JavaScript",
    mode: "competitive",
    access: "public",
    duration_minutes: 20,
    pass_mark: 70,
    max_attempts: 1,
    starts_at: daysFromNow(2),
    ends_at: daysFromNow(40),
    enable_leaderboard: true,
    enable_xp: true,
    enable_badges: true,
    show_rank: true,
    leaderboard_name_display: "display_name",
    extra_fields: [{ key: "employee_id", label: "Employee ID", required: true }],
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    title: "React Fundamentals",
    description: "Components, state, props and hooks.",
    topic: "React",
    mode: "assessment",
    access: "public",
    duration_minutes: 20,
    pass_mark: 60,
    max_attempts: 2,
    starts_at: daysFromNow(-2),
    ends_at: daysFromNow(45),
    enable_leaderboard: true,
    enable_xp: true,
    enable_badges: true,
    show_rank: true,
    leaderboard_name_display: "full_name",
  },
  {
    id: "44444444-4444-4444-4444-444444444444",
    title: "TypeScript Practice Lab",
    description: "Practice types, generics and narrowing with instant feedback.",
    topic: "TypeScript",
    mode: "practice",
    access: "public",
    duration_minutes: 20,
    pass_mark: 60,
    max_attempts: 99,
    starts_at: daysFromNow(-10),
    ends_at: null,
    enable_leaderboard: false,
    enable_xp: true,
    enable_badges: true,
    show_rank: false,
    leaderboard_name_display: "anonymous",
  },
  {
    id: "55555555-5555-5555-5555-555555555551",
    title: "[Demo] Assessa Labs Internal Safety",
    description: "Organisation-scoped assessment for Assessa Labs staff.",
    topic: "Workplace",
    mode: "certification",
    access: "organization",
    organization: "Assessa Labs",
    duration_minutes: 25,
    pass_mark: 80,
    max_attempts: 2,
    starts_at: daysFromNow(-1),
    ends_at: daysFromNow(60),
    enable_leaderboard: true,
    enable_xp: true,
    enable_badges: true,
    show_rank: true,
    leaderboard_name_display: "first_initial",
  },
  {
    id: "55555555-5555-5555-5555-555555555552",
    title: "[Demo] Engineering Squad Challenge",
    description: "Team / group scoped challenge for Contoso Engineering.",
    topic: "Engineering",
    mode: "competitive",
    access: "group",
    team_group: "Engineering",
    duration_minutes: 18,
    pass_mark: 65,
    max_attempts: 2,
    starts_at: daysFromNow(-1),
    ends_at: daysFromNow(20),
    enable_leaderboard: true,
    enable_xp: true,
    enable_badges: true,
    show_rank: true,
    leaderboard_name_display: "display_name",
  },
  {
    id: "55555555-5555-5555-5555-555555555553",
    title: "[Demo] Private Invite Only Quiz",
    description: "Invite-only assessment — visualise private access + invitations.",
    topic: "Security",
    mode: "assessment",
    access: "private",
    duration_minutes: 12,
    pass_mark: 70,
    max_attempts: 2,
    starts_at: daysFromNow(-1),
    ends_at: daysFromNow(14),
    enable_leaderboard: true,
    enable_xp: true,
    enable_badges: false,
    show_rank: true,
    leaderboard_name_display: "anonymous",
  },
];

for (const exam of DEMO_EXAMS) {
  const { error } = await admin.from("exams").upsert(
    {
      ...exam,
      active: true,
      created_by: adminId,
      question_count: 5,
      extra_fields: exam.extra_fields ?? [],
      organization: exam.organization ?? null,
      team_group: exam.team_group ?? null,
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}
console.log(`[db:seed] ${DEMO_EXAMS.length} exams upserted`);

const QUESTION_BANK = {
  "11111111-1111-1111-1111-111111111111": [
    [
      "Which value is NOT a JavaScript primitive?",
      ["string", "symbol", "object", "bigint"],
      2,
      "Objects are reference types.",
      "Fundamentals",
    ],
    [
      "What does typeof null return?",
      ['"null"', '"object"', '"undefined"', '"boolean"'],
      1,
      'typeof null is "object".',
      "Fundamentals",
    ],
    [
      "Which method adds an item to the end of an array?",
      ["shift()", "unshift()", "push()", "splice()"],
      2,
      "push() appends.",
      "Arrays",
    ],
    [
      "Which declaration is block scoped?",
      ["var", "let", "function", "this"],
      1,
      "let/const are block scoped.",
      "Functions",
    ],
    [
      "Result of [1,2,3].map(n => n * 2).join('-')?",
      ["2-4-6", "1-2-3", "246", "2,4,6"],
      0,
      "map then join.",
      "Arrays",
    ],
  ],
  "22222222-2222-2222-2222-222222222222": [
    [
      "What does an async function always return?",
      ["A value", "A Promise", "undefined", "A generator"],
      1,
      "Always a Promise.",
      "Async",
    ],
    [
      "Which runs first: setTimeout(fn,0) or Promise.then?",
      ["setTimeout", "Promise then", "Together", "Undefined"],
      1,
      "Microtasks first.",
      "Async",
    ],
    [
      "A closure lets a function access…",
      ["Only globals", "Outer scope variables", "Only arguments", "The DOM"],
      1,
      "Lexical scope.",
      "Functions",
    ],
    [
      "Promise.all rejects when…",
      ["All reject", "Any rejects", "Never", "First resolves"],
      1,
      "First rejection wins.",
      "Async",
    ],
    [
      "Correct parallel await?",
      [
        "await a(); await b();",
        "await Promise.all([a(), b()])",
        "Promise.all(await a())",
        "await [a,b]",
      ],
      1,
      "Promise.all concurrent.",
      "Async",
    ],
  ],
  "33333333-3333-3333-3333-333333333333": [
    [
      "Which hook stores local component state?",
      ["useEffect", "useState", "useMemo", "useRef"],
      1,
      "useState.",
      "Hooks",
    ],
    [
      "useEffect dependency array controls…",
      ["Render order", "When effect re-runs", "Component name", "Prop types"],
      1,
      "Re-run on dep change.",
      "Hooks",
    ],
    [
      "Props in React are…",
      ["Mutable", "Read-only", "Global", "Async"],
      1,
      "Read-only.",
      "Components",
    ],
    [
      "Keys help React…",
      ["Style CSS", "Identify list items", "Call APIs", "Set state"],
      1,
      "Stable identity.",
      "Lists",
    ],
    [
      "Default export imports as…",
      ["{ Component }", "Component", "* as Component", "require"],
      1,
      "Default import.",
      "Modules",
    ],
  ],
  "44444444-4444-4444-4444-444444444444": [
    [
      "TypeScript adds…",
      ["Runtime speed", "Static types", "A new VM", "CSS"],
      1,
      "Static typing.",
      "Basics",
    ],
    ["Which is a valid type?", ["number", "Numberish", "int32", "real"], 0, "number.", "Basics"],
    [
      "interface vs type — both can…",
      ["Only describe objects", "Describe shapes", "Run at runtime", "Replace JS"],
      1,
      "Describe shapes.",
      "Types",
    ],
    [
      "Narrowing happens when…",
      ["You ignore types", "Control-flow checks types", "You use any", "Build fails"],
      1,
      "Control-flow analysis.",
      "Narrowing",
    ],
    [
      "Generics let you…",
      ["Delete types", "Parameterise types", "Skip compile", "Ship CSS"],
      1,
      "Reusable typed APIs.",
      "Generics",
    ],
  ],
  "55555555-5555-5555-5555-555555555551": [
    [
      "Phishing emails often…",
      ["Use official domains only", "Create urgency", "Never include links", "Are always obvious"],
      1,
      "Urgency is common.",
      "Security",
    ],
    [
      "Best password practice?",
      ["Reuse everywhere", "Unique + manager", "Share in chat", "Write on desk"],
      1,
      "Unique passwords.",
      "Security",
    ],
    [
      "MFA stands for…",
      ["Multi-factor auth", "Mail for admins", "Managed file access", "Mainframe"],
      0,
      "Multi-factor authentication.",
      "Security",
    ],
    [
      "Report incidents…",
      ["Never", "Immediately", "Next quarter", "Only if stolen"],
      1,
      "Report ASAP.",
      "Process",
    ],
    [
      "Sensitive data should be…",
      ["In public Slack", "Encrypted / need-to-know", "Emailed freely", "On USB only"],
      1,
      "Least privilege.",
      "Data",
    ],
  ],
  "55555555-5555-5555-5555-555555555552": [
    [
      "Trunk-based development prefers…",
      ["Long-lived branches", "Short-lived branches", "No reviews", "Weekly merges only"],
      1,
      "Short-lived branches.",
      "DevOps",
    ],
    [
      "A good PR is…",
      ["Huge & rare", "Small & focused", "Without tests", "Force-pushed always"],
      1,
      "Small focused PRs.",
      "Collaboration",
    ],
    [
      "Observability includes…",
      ["Only logs", "Logs, metrics, traces", "Only uptime", "Only alerts"],
      1,
      "Three pillars.",
      "Ops",
    ],
    [
      "Incident severity is based on…",
      ["Who shouted loudest", "Impact + urgency", "Ticket age", "Assignee level"],
      1,
      "Impact and urgency.",
      "Ops",
    ],
    [
      "Definition of Done includes…",
      ["Code only", "Reviewed + tested + shipped criteria", "Design only", "Ticket created"],
      1,
      "Agreed completion criteria.",
      "Delivery",
    ],
  ],
  "55555555-5555-5555-5555-555555555553": [
    [
      "Least privilege means…",
      ["Admin for all", "Minimum access needed", "No MFA", "Shared root"],
      1,
      "Minimum necessary access.",
      "Access",
    ],
    [
      "Secrets belong in…",
      ["Git", "Secrets manager / env", "Screenshots", "Slack pins"],
      1,
      "Never commit secrets.",
      "Secrets",
    ],
    [
      "A private assessment is for…",
      ["Anyone with link", "Invited emails only", "Whole internet", "Anonymous bots"],
      1,
      "Invites only.",
      "Access",
    ],
    [
      "Audit logs help you…",
      ["Decorate dashboards", "Trace who did what", "Speed CSS", "Skip MFA"],
      1,
      "Accountability.",
      "Audit",
    ],
    [
      "Rotate credentials when…",
      ["Never", "Compromise or schedule", "Only annually forever", "After demos only"],
      1,
      "On schedule / incident.",
      "Secrets",
    ],
  ],
};

for (const [examId, questions] of Object.entries(QUESTION_BANK)) {
  await admin.from("questions").delete().eq("exam_id", examId);
  const rows = questions.map(([prompt, options, correct_index, explanation, subtopic]) => ({
    exam_id: examId,
    prompt,
    options,
    correct_index,
    correct_indexes: [correct_index],
    explanation,
    subtopic,
    points: 1,
  }));
  const { error } = await admin.from("questions").insert(rows);
  if (error) throw error;
  await admin.from("exams").update({ question_count: rows.length }).eq("id", examId);
}
console.log("[db:seed] questions refreshed");

/* ------------------------------------------------------------------ */
/* invitations                                                         */
/* ------------------------------------------------------------------ */

const inviteExam = "55555555-5555-5555-5555-555555555553";
await admin.from("exam_invitations").delete().eq("exam_id", inviteExam);
const { error: inviteError } = await admin
  .from("exam_invitations")
  .insert(DEMO_USERS.slice(0, 3).map((u) => ({ exam_id: inviteExam, email: u.email })));
if (inviteError) throw inviteError;

/* ------------------------------------------------------------------ */
/* attempts + mastery + xp + badges + notifications                    */
/* ------------------------------------------------------------------ */

const { data: allQuestions } = await admin
  .from("questions")
  .select("id, exam_id, correct_index, correct_indexes");
const questionsByExam = new Map();
for (const q of allQuestions ?? []) {
  const list = questionsByExam.get(q.exam_id) ?? [];
  list.push(q);
  questionsByExam.set(q.exam_id, list);
}

// Clear prior demo attempts for these users on demo exams (idempotent-ish)
const demoUserIds = Object.values(demoIds);
const demoExamIds = DEMO_EXAMS.map((e) => e.id);
await admin.from("exam_attempts").delete().in("user_id", demoUserIds).in("exam_id", demoExamIds);

const scorePlans = [
  // exam JS fundamentals — spread scores for podium
  {
    examId: "11111111-1111-1111-1111-111111111111",
    users: [
      ["demo.grace@assessa.test", 100],
      ["demo.ada@assessa.test", 80],
      ["demo.katherine@assessa.test", 80],
      ["demo.alan@assessa.test", 60],
      ["demo.linus@assessa.test", 40],
    ],
  },
  {
    examId: "33333333-3333-3333-3333-333333333333",
    users: [
      ["demo.ada@assessa.test", 100],
      ["demo.grace@assessa.test", 80],
      ["demo.alan@assessa.test", 60],
      ["demo.katherine@assessa.test", 40],
    ],
  },
  {
    examId: "55555555-5555-5555-5555-555555555551",
    users: [
      ["demo.ada@assessa.test", 100],
      ["demo.grace@assessa.test", 80],
    ],
  },
  {
    examId: "55555555-5555-5555-5555-555555555552",
    users: [
      ["demo.alan@assessa.test", 100],
      ["demo.linus@assessa.test", 60],
    ],
  },
  {
    examId: "55555555-5555-5555-5555-555555555553",
    users: [
      ["demo.ada@assessa.test", 80],
      ["demo.grace@assessa.test", 60],
    ],
  },
];

const attemptRows = [];
for (const plan of scorePlans) {
  const qs = questionsByExam.get(plan.examId) ?? [];
  if (qs.length === 0) continue;
  for (const [userEmail, score] of plan.users) {
    const userId = demoIds[userEmail];
    if (!userId) continue;
    const correctNeeded = Math.round((score / 100) * qs.length);
    const answers = {};
    qs.forEach((q, index) => {
      const correct = q.correct_indexes?.[0] ?? q.correct_index ?? 0;
      answers[q.id] = index < correctNeeded ? [correct] : [(correct + 1) % 4];
    });
    const started = new Date(Date.now() - Math.random() * 5 * 86_400_000);
    const duration = 300 + Math.floor(Math.random() * 600);
    attemptRows.push({
      exam_id: plan.examId,
      user_id: userId,
      status: "submitted",
      question_ids: qs.map((q) => q.id),
      answers,
      score,
      passed: score >= (DEMO_EXAMS.find((e) => e.id === plan.examId)?.pass_mark ?? 60),
      correct_count: correctNeeded,
      duration_seconds: duration,
      started_at: started.toISOString(),
      submitted_at: new Date(started.getTime() + duration * 1000).toISOString(),
      extra_fields: {},
    });
  }
}

// One in-progress attempt for Ada on TypeScript practice
{
  const examId = "44444444-4444-4444-4444-444444444444";
  const qs = questionsByExam.get(examId) ?? [];
  if (qs.length && demoIds["demo.ada@assessa.test"]) {
    attemptRows.push({
      exam_id: examId,
      user_id: demoIds["demo.ada@assessa.test"],
      status: "in_progress",
      question_ids: qs.map((q) => q.id),
      answers: {},
      score: null,
      passed: null,
      correct_count: null,
      duration_seconds: null,
      started_at: new Date().toISOString(),
      submitted_at: null,
      extra_fields: {},
    });
  }
}

const { error: attemptError } = await admin.from("exam_attempts").insert(attemptRows);
if (attemptError) throw attemptError;
console.log(`[db:seed] ${attemptRows.length} attempts seeded`);

// Topic mastery
await admin.from("topic_mastery").delete().in("user_id", demoUserIds);
const masteryRows = [
  {
    user_id: demoIds["demo.ada@assessa.test"],
    topic: "JavaScript",
    subtopic: "Arrays",
    mastery: 86,
    total_count: 8,
    correct_count: 7,
  },
  {
    user_id: demoIds["demo.ada@assessa.test"],
    topic: "React",
    subtopic: "Hooks",
    mastery: 92,
    total_count: 10,
    correct_count: 9,
  },
  {
    user_id: demoIds["demo.grace@assessa.test"],
    topic: "JavaScript",
    subtopic: "Async",
    mastery: 95,
    total_count: 12,
    correct_count: 11,
  },
  {
    user_id: demoIds["demo.alan@assessa.test"],
    topic: "Engineering",
    subtopic: "DevOps",
    mastery: 70,
    total_count: 6,
    correct_count: 4,
  },
  {
    user_id: demoIds["demo.katherine@assessa.test"],
    topic: "JavaScript",
    subtopic: "Fundamentals",
    mastery: 78,
    total_count: 9,
    correct_count: 7,
  },
];
const { error: masteryError } = await admin.from("topic_mastery").insert(masteryRows);
if (masteryError) throw masteryError;

// XP ledger
await admin.from("xp_transactions").delete().in("user_id", demoUserIds);
const xpRows = [];
for (const [emailKey, points] of [
  ["demo.ada@assessa.test", 420],
  ["demo.grace@assessa.test", 680],
  ["demo.alan@assessa.test", 260],
  ["demo.katherine@assessa.test", 510],
  ["demo.linus@assessa.test", 180],
]) {
  xpRows.push({
    user_id: demoIds[emailKey],
    source: "seed:baseline",
    points,
    reference_id: null,
  });
}
const { error: xpError } = await admin.from("xp_transactions").insert(xpRows);
if (xpError) throw xpError;

// Award a few badges
const { data: badges } = await admin.from("badges").select("id, code").eq("active", true);
const badgeByCode = new Map((badges ?? []).map((b) => [b.code, b.id]));
await admin.from("user_badges").delete().in("user_id", demoUserIds);
const badgeAwards = [
  ["demo.ada@assessa.test", "first_success"],
  ["demo.ada@assessa.test", "half_century"],
  ["demo.ada@assessa.test", "bronze_score"],
  ["demo.ada@assessa.test", "quiz_duo"],
  ["demo.grace@assessa.test", "first_success"],
  ["demo.grace@assessa.test", "perfect_score"],
  ["demo.grace@assessa.test", "accuracy_master"],
  ["demo.grace@assessa.test", "near_perfect"],
  ["demo.grace@assessa.test", "silver_score"],
  ["demo.katherine@assessa.test", "first_success"],
  ["demo.katherine@assessa.test", "bronze_score"],
  ["demo.alan@assessa.test", "first_success"],
  ["demo.alan@assessa.test", "unit_test_pass"],
  ["demo.linus@assessa.test", "hello_world"],
  ["demo.linus@assessa.test", "quiz_duo"],
].flatMap(([userEmail, code]) => {
  const badgeId = badgeByCode.get(code);
  const userId = demoIds[userEmail];
  return badgeId && userId ? [{ user_id: userId, badge_id: badgeId }] : [];
});
if (badgeAwards.length) {
  const { error } = await admin.from("user_badges").insert(badgeAwards);
  if (error) throw error;
}

// Notifications
await admin.from("notifications").delete().in("user_id", demoUserIds);
const notifRows = demoUserIds.flatMap((userId, index) => [
  {
    user_id: userId,
    kind: "result",
    title: "Result available — sample assessment",
    body: "Your seeded result is ready to review.",
    icon: "✅",
    read: index % 2 === 0,
  },
  {
    user_id: userId,
    kind: "badge",
    title: "Badge earned — First Success",
    body: "You unlocked a starter badge in the demo dataset.",
    icon: "🏆",
    read: false,
  },
  {
    user_id: userId,
    kind: "invitation",
    title: "You have been invited to a private quiz",
    body: "Open My Exams when you are ready.",
    icon: "✉️",
    read: false,
  },
]);
const { error: notifError } = await admin.from("notifications").insert(notifRows);
if (notifError) throw notifError;

console.log("[db:seed] mastery, XP, badges, notifications ready");
console.log("[db:seed] done");
console.log("");
console.log("Demo sign-in accounts (password = SEED_DEMO_PASSWORD or SEED_ADMIN_PASSWORD):");
for (const user of DEMO_USERS) console.log(`  - ${user.email}`);
console.log(`Admin: ${email}`);
