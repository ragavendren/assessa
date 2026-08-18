#!/usr/bin/env node
/**
 * Idempotent Team Fun Day course + visual icebreaker pool.
 *
 * Usage:
 *   node scripts/seed-fun-event.mjs
 *   (also invoked from db-seed.mjs)
 */
import { createClient } from "@supabase/supabase-js";
import {
  assertProjectUrlConsistency,
  loadEnv,
  requireEnv,
  resolveSupabaseProjectId,
  resolveSupabaseUrl,
} from "./lib/env.mjs";

const COURSE_NAME = "Team Fun Day";
const POOL_NAME = "Visual Icebreakers";
const BLUEPRINT_NAME = "Team Fun Day mix";
const SERIES_NAME = "Team Fun Day 2026";

const QUESTIONS = [
  {
    prompt: "This huddle happens every weekday morning. What is it?",
    image_url: "/fun-event/standup.svg",
    options: ["Stand-up", "Sprint review", "All-hands", "Lunch and learn"],
    correct_indexes: [0],
    multi_select: false,
    topic: "Rituals",
    subtopic: "Standup",
    difficulty: "easy",
    explanation: "A short daily stand-up keeps blockers visible without a long meeting.",
  },
  {
    prompt: "We break this out after a successful release. What is it celebrating?",
    image_url: "/fun-event/ship.svg",
    options: ["A failed deploy", "A production ship", "A cancelled sprint", "A quiet Friday"],
    correct_indexes: [1],
    multi_select: false,
    topic: "Rituals",
    subtopic: "Shipping",
    difficulty: "medium",
    explanation: "Call out the ship so the team shares the win, not just the ticket close.",
  },
  {
    prompt: "What is the unofficial fuel of the morning huddle?",
    image_url: "/fun-event/coffee.svg",
    options: ["Kombucha only", "Coffee (or tea)", "Energy drinks mandated", "No drinks allowed"],
    correct_indexes: [1],
    multi_select: false,
    topic: "Snacks",
    subtopic: "Coffee",
    difficulty: "easy",
    explanation: "Bring whatever keeps you kind before 10am — coffee and tea both count.",
  },
  {
    prompt: "Friday lunch tradition looks like this. What are we having?",
    image_url: "/fun-event/pizza.svg",
    options: ["Tasting menu", "Pizza", "Meal-prep only", "Skip lunch"],
    correct_indexes: [1],
    multi_select: false,
    topic: "Snacks",
    subtopic: "Friday",
    difficulty: "easy",
    explanation: "Friday pizza is optional, but showing up for the table is the point.",
  },
  {
    prompt: "Where do half-baked ideas go first?",
    image_url: "/fun-event/ideas.svg",
    options: [
      "Straight to production",
      "The sticky-note parking lot",
      "A private DM to the CEO",
      "They are deleted",
    ],
    correct_indexes: [1],
    multi_select: false,
    topic: "Collaboration",
    subtopic: "Ideas",
    difficulty: "medium",
    explanation: "Park it on the wall, then refine. Shipping starts with a visible idea.",
  },
  {
    prompt: "The best default for deep work is…",
    image_url: "/fun-event/deep-work.svg",
    options: [
      "Headphones on, calendar blocked",
      "Slack on every screen",
      "Back-to-back meetings",
      "Open office karaoke",
    ],
    correct_indexes: [0],
    multi_select: false,
    topic: "Collaboration",
    subtopic: "Focus",
    difficulty: "medium",
    explanation: "Protect focus time so stand-ups stay short and delivery stays sane.",
  },
  {
    prompt: "Which card does not belong with our team values?",
    image_url: "/fun-event/values.svg",
    options: ["Kind", "Ship", "Learn", "Ego"],
    correct_indexes: [3],
    multi_select: false,
    topic: "Culture",
    subtopic: "Values",
    difficulty: "easy",
    explanation: "Kind, ship, and learn stay. Ego does not make the keep pile.",
  },
  {
    prompt: "When a teammate ships, we should (select all that apply):",
    image_url: "/fun-event/celebrate.svg",
    options: [
      "High-five in the channel",
      "Ignore it so they stay humble",
      "Share one thing we learned",
      "Hide the work from others",
    ],
    correct_indexes: [0, 2],
    multi_select: true,
    topic: "Culture",
    subtopic: "Wins",
    difficulty: "medium",
    explanation: "Celebrate in public and capture the learning. Silence helps nobody.",
  },
];

export async function seedFunEvent(admin) {
  const { data: courseRow, error: courseLookupError } = await admin
    .from("courses")
    .select("id")
    .eq("name", COURSE_NAME)
    .maybeSingle();
  if (courseLookupError) throw courseLookupError;

  let courseId = courseRow?.id ?? null;
  if (!courseId) {
    const { data, error } = await admin
      .from("courses")
      .insert({ name: COURSE_NAME, status: "active" })
      .select("id")
      .single();
    if (error) throw error;
    courseId = data.id;
  } else {
    const { error } = await admin
      .from("courses")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", courseId);
    if (error) throw error;
  }

  const { data: poolRow, error: poolLookupError } = await admin
    .from("question_pools")
    .select("id")
    .eq("course_id", courseId)
    .eq("name", POOL_NAME)
    .maybeSingle();
  if (poolLookupError) throw poolLookupError;

  let poolId = poolRow?.id ?? null;
  if (!poolId) {
    const { data, error } = await admin
      .from("question_pools")
      .insert({ course_id: courseId, name: POOL_NAME, status: "active" })
      .select("id")
      .single();
    if (error) throw error;
    poolId = data.id;
  } else {
    const { error } = await admin
      .from("question_pools")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", poolId);
    if (error) throw error;
  }

  const { error: clearError } = await admin.from("pool_questions").delete().eq("pool_id", poolId);
  if (clearError) throw clearError;

  const rows = QUESTIONS.map((q) => ({
    pool_id: poolId,
    prompt: q.prompt,
    image_url: q.image_url,
    options: q.options,
    correct_index: q.correct_indexes[0] ?? 0,
    correct_indexes: q.correct_indexes,
    multi_select: q.multi_select,
    explanation: q.explanation,
    topic: q.topic,
    subtopic: q.subtopic,
    difficulty: q.difficulty,
    skill: "Team culture",
    tags: ["fun-day", q.topic.toLowerCase()],
    marks: 1,
    status: "active",
  }));
  const { error: questionsError } = await admin.from("pool_questions").insert(rows);
  if (questionsError) throw questionsError;

  const { data: blueprintRow, error: blueprintLookupError } = await admin
    .from("course_blueprints")
    .select("id")
    .eq("course_id", courseId)
    .eq("name", BLUEPRINT_NAME)
    .eq("version", 1)
    .maybeSingle();
  if (blueprintLookupError) throw blueprintLookupError;

  let blueprintId = blueprintRow?.id ?? null;
  if (!blueprintId) {
    const { data, error } = await admin
      .from("course_blueprints")
      .insert({
        course_id: courseId,
        name: BLUEPRINT_NAME,
        version: 1,
        status: "active",
        default_total_questions: 8,
      })
      .select("id")
      .single();
    if (error) throw error;
    blueprintId = data.id;
  } else {
    const { error } = await admin
      .from("course_blueprints")
      .update({
        status: "active",
        default_total_questions: 8,
        updated_at: new Date().toISOString(),
      })
      .eq("id", blueprintId);
    if (error) throw error;
  }

  const { error: rulesClearError } = await admin
    .from("blueprint_rules")
    .delete()
    .eq("blueprint_id", blueprintId);
  if (rulesClearError) throw rulesClearError;

  const { error: rulesError } = await admin.from("blueprint_rules").insert(
    ["Rituals", "Snacks", "Collaboration", "Culture"].map((topic) => ({
      blueprint_id: blueprintId,
      topic,
      subtopic: null,
      weightage: 25,
      min_questions: 1,
      max_questions: 3,
      easy_percentage: 40,
      medium_percentage: 60,
      hard_percentage: 0,
    })),
  );
  if (rulesError) throw rulesError;

  const { data: seriesRow, error: seriesLookupError } = await admin
    .from("assessment_series")
    .select("id")
    .eq("course_id", courseId)
    .eq("name", SERIES_NAME)
    .maybeSingle();
  if (seriesLookupError) throw seriesLookupError;

  if (!seriesRow) {
    const { error } = await admin.from("assessment_series").insert({
      course_id: courseId,
      blueprint_id: blueprintId,
      question_pool_id: poolId,
      name: SERIES_NAME,
      reuse_policy: "allow_reuse",
      reuse_last_n: 5,
      status: "active",
    });
    if (error) throw error;
  } else {
    const { error } = await admin
      .from("assessment_series")
      .update({
        blueprint_id: blueprintId,
        question_pool_id: poolId,
        reuse_policy: "allow_reuse",
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", seriesRow.id);
    if (error) throw error;
  }

  return { courseId, poolId, blueprintId, questions: QUESTIONS.length };
}

const isDirectRun = process.argv[1]?.replace(/\\/g, "/").endsWith("seed-fun-event.mjs");
if (isDirectRun) {
  loadEnv();
  const projectId = resolveSupabaseProjectId();
  const supabaseUrl = resolveSupabaseUrl(projectId);
  assertProjectUrlConsistency(projectId, supabaseUrl);
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const result = await seedFunEvent(admin);
  console.log(
    `[seed-fun-event] course="${COURSE_NAME}" pool="${POOL_NAME}" questions=${result.questions}`,
  );
}
