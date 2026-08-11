#!/usr/bin/env node
/**
 * Seed the remote database (admin user + baseline rows if missing).
 *
 * Usage:
 *   npm run db:seed
 *
 * Env:
 *   SUPABASE_URL / SUPABASE_PROJECT_ID
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SEED_ADMIN_EMAIL
 *   SEED_ADMIN_PASSWORD  (min 12 chars)
 */
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

if (password.length < 12) {
  console.error("[db:seed] SEED_ADMIN_PASSWORD must be at least 12 characters.");
  process.exit(1);
}

const keyLooksValid =
  serviceRoleKey.startsWith("eyJ") || serviceRoleKey.startsWith("sb_secret_");
if (!keyLooksValid) {
  console.error(
    "[db:seed] SUPABASE_SERVICE_ROLE_KEY looks invalid (expected eyJ… JWT or sb_secret_…).",
  );
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log(`[db:seed] project=${projectId}`);
console.log(`[db:seed] url=${supabaseUrl}`);
console.log(`[db:seed] admin=${email}`);

let userId = null;

const created = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: "Platform Administrator" },
});

if (created.data?.user?.id) {
  userId = created.data.user.id;
  console.log("[db:seed] created admin auth user");
} else {
  const { data: profile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  userId = profile?.id ?? null;
  if (!userId) {
    const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    userId = listed?.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
  }
  if (!userId) {
    console.error("[db:seed] could not create/find admin:", created.error?.message ?? "unknown error");
    process.exit(1);
  }
  const updated = await admin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
    user_metadata: { full_name: "Platform Administrator" },
  });
  if (updated.error) {
    console.error("[db:seed] failed to update admin:", updated.error.message);
    process.exit(1);
  }
  console.log("[db:seed] updated existing admin auth user");
}

const { error: profileError } = await admin.from("profiles").upsert(
  { id: userId, email, full_name: "Platform Administrator" },
  { onConflict: "id" },
);
if (profileError) {
  console.error("[db:seed] profile upsert failed:", profileError.message);
  process.exit(1);
}

const { error: roleError } = await admin
  .from("user_roles")
  .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
if (roleError) {
  console.error("[db:seed] role upsert failed:", roleError.message);
  process.exit(1);
}

const { error: streakError } = await admin.from("user_streaks").upsert(
  [
    { user_id: userId, streak_type: "exam" },
    { user_id: userId, streak_type: "pass" },
    { user_id: userId, streak_type: "high_score" },
  ],
  { onConflict: "user_id,streak_type" },
);
if (streakError) {
  console.error("[db:seed] streak upsert failed:", streakError.message);
  process.exit(1);
}

// Ensure baseline lookup data exists (idempotent upserts).
const { error: levelsError } = await admin.from("levels").upsert(
  [
    { level: 1, name: "Novice", min_xp: 0 },
    { level: 2, name: "Learner", min_xp: 100 },
    { level: 3, name: "Practitioner", min_xp: 250 },
    { level: 4, name: "Achiever", min_xp: 500 },
    { level: 5, name: "Expert", min_xp: 900 },
    { level: 6, name: "Mentor", min_xp: 1400 },
    { level: 7, name: "Leader", min_xp: 2000 },
    { level: 8, name: "Master", min_xp: 2800 },
  ],
  { onConflict: "level" },
);
if (levelsError) {
  console.warn("[db:seed] levels upsert skipped/failed:", levelsError.message);
}

console.log("[db:seed] done — admin ready (password not printed).");
