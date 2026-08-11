import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function loadEnv() {
  const env = {};
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
    env[line.slice(0, i).trim()] = value;
  }
  return env;
}

const env = loadEnv();
const keys = [
  "SUPABASE_PROJECT_ID",
  "VITE_SUPABASE_PROJECT_ID",
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "APP_URL",
  "SEND_EMAIL_HOOK_SECRET",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "AI_GATEWAY_API_KEY",
  "AI_GATEWAY_BASE_URL",
  "AI_GATEWAY_MODEL",
];
const targets = ["production", "preview", "development"];

for (const key of keys) {
  const val = env[key];
  if (!val) {
    console.log("skip missing", key);
    continue;
  }
  if (key.includes("URL") && !val.startsWith("https://")) {
    throw new Error(`Refusing to sync invalid URL for ${key}`);
  }

  for (const target of targets) {
    spawnSync("npx", ["vercel", "env", "rm", key, target, "-y"], {
      encoding: "utf8",
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const result = spawnSync("npx", ["vercel", "env", "add", key, target, "--yes"], {
      input: `${val}\n`,
      encoding: "utf8",
      shell: true,
    });

    if (result.status === 0) {
      console.log(`set ${key} ${target} len=${val.length}`);
    } else {
      const detail = `${result.stderr || ""}\n${result.stdout || ""}`
        .split("\n")
        .filter(Boolean)
        .slice(-2)
        .join(" | ");
      console.log(`fail ${key} ${target} ${detail}`);
    }
  }
}
