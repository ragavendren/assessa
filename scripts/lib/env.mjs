import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Load KEY=VALUE pairs from .env / .env.local into process.env (does not override existing).
 */
export function loadEnv(cwd = process.cwd()) {
  for (const name of [".env.local", ".env"]) {
    const path = resolve(cwd, name);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

/**
 * Supabase project / reference ID source of truth:
 * 1. SUPABASE_PROJECT_ID (Dashboard → Project Settings → General → Reference ID)
 * 2. else parse from SUPABASE_URL host (`https://<ref>.supabase.co`)
 */
export function resolveSupabaseProjectId() {
  const fromEnv = process.env.SUPABASE_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;

  const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  if (url) {
    try {
      const host = new URL(url).hostname; // <ref>.supabase.co
      const ref = host.split(".")[0];
      if (ref && ref !== "supabase") return ref;
    } catch {
      // ignore
    }
  }

  throw new Error(
    "Missing SUPABASE_PROJECT_ID. Set it in .env to your Supabase Reference ID (Project Settings → General).",
  );
}

export function resolveSupabaseUrl(projectId) {
  const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  if (url) return url.replace(/\/$/, "");
  return `https://${projectId}.supabase.co`;
}

export function assertProjectUrlConsistency(projectId, url) {
  try {
    const hostRef = new URL(url).hostname.split(".")[0];
    if (hostRef && hostRef !== projectId) {
      console.warn(
        `[warn] SUPABASE_PROJECT_ID (${projectId}) does not match SUPABASE_URL host (${hostRef}).\n` +
          `       Prefer the Reference ID from the same project as SUPABASE_URL / service role key.`,
      );
    }
  } catch {
    // ignore
  }
}

export function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
