/**
 * Backfill participant_id for any profiles missing one.
 * Usage: node scripts/backfill-participant-ids.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const env = { ...process.env };
  if (!existsSync(".env")) return env;
  for (const raw of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    const key = line.slice(0, i).trim();
    if (!env[key]) env[key] = value;
  }
  return env;
}

const env = loadEnv();
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: profiles, error } = await admin
  .from("profiles")
  .select("id, participant_id, department, team_group")
  .or("participant_id.is.null,participant_id.eq.");
if (error) {
  console.error(error.message);
  process.exit(1);
}

let updated = 0;
for (const profile of profiles ?? []) {
  if (profile.participant_id?.trim()) continue;
  const participantId = `AS-${randomBytes(4).toString("hex").toUpperCase()}`;
  const team = profile.department || profile.team_group || null;
  const { error: updateError } = await admin
    .from("profiles")
    .update({
      participant_id: participantId,
      ...(team ? { department: team, team_group: team } : {}),
    })
    .eq("id", profile.id);
  if (updateError) {
    console.error(profile.id, updateError.message);
    continue;
  }
  updated += 1;
}

console.log(`Backfilled participant_id for ${updated} profile(s).`);
