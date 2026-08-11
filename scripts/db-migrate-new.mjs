#!/usr/bin/env node
/**
 * Create a new empty migration file under supabase/migrations.
 *
 * Usage:
 *   npm run db:migrate:new -- add_ends_at_index
 */
import { spawnSync } from "node:child_process";
import { loadEnv, resolveSupabaseProjectId } from "./lib/env.mjs";

loadEnv();
const projectId = resolveSupabaseProjectId();
const name = process.argv.slice(2).join("_").trim() || "change";

const result = spawnSync("npx", ["supabase", "migration", "new", name], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, SUPABASE_PROJECT_ID: projectId },
});

process.exit(result.status ?? 1);
