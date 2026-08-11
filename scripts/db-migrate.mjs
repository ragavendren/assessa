#!/usr/bin/env node
/**
 * Apply supabase/migrations to the remote project on demand (no `supabase login` required).
 *
 * Usage:
 *   npm run db:migrate
 *
 * Required env:
 *   SUPABASE_PROJECT_ID
 *   SUPABASE_DB_PASSWORD
 *     or DATABASE_URL / SUPABASE_DB_URL (paste Session pooler URI from Dashboard → Connect)
 *
 * Optional:
 *   SUPABASE_DB_REGION  — e.g. ap-south-1 (auto-detected if omitted)
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";
import {
  assertProjectUrlConsistency,
  loadEnv,
  resolveSupabaseProjectId,
  resolveSupabaseUrl,
} from "./lib/env.mjs";

loadEnv();

const projectId = resolveSupabaseProjectId();
const supabaseUrl = resolveSupabaseUrl(projectId);
assertProjectUrlConsistency(projectId, supabaseUrl);
syncConfigToml(projectId);

const candidates = buildDbUrlCandidates(projectId);
if (candidates.length === 0) {
  console.error(`
[db:migrate] Missing database credentials.

Set in .env:

  SUPABASE_DB_PASSWORD=your-database-password
  SUPABASE_DB_REGION=ap-south-1

  # Source: Dashboard → Project Settings → Database
  # Region: Dashboard → Project Settings → General → Region
  #   (or Connect → Session pooler host, e.g. aws-0-ap-south-1.pooler.supabase.com)

OR paste the Session pooler URI from Dashboard → Connect:

  DATABASE_URL=postgresql://postgres.${projectId}:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres

Direct db.*.supabase.co hosts are IPv6-only and often time out on local networks.
`);
  process.exit(1);
}

console.log(`[db:migrate] project=${projectId}`);
console.log(`[db:migrate] url=${supabaseUrl}`);

const { sql, usedUrl } = await connectWithFallback(candidates);
console.log(`[db:migrate] connected via ${maskUrl(usedUrl)}`);
console.log(`[db:migrate] applying files from supabase/migrations`);

const migrationsDir = resolve(process.cwd(), "supabase/migrations");
const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort((a, b) => a.localeCompare(b));

if (files.length === 0) {
  console.log("[db:migrate] no migration files found.");
  await sql.end({ timeout: 5 });
  process.exit(0);
}

try {
  await sql.unsafe(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      name text,
      statements text[],
      applied_at timestamptz not null default now()
    );
  `);

  const appliedRows = await sql`
    select version from supabase_migrations.schema_migrations
  `;
  const applied = new Set(appliedRows.map((row) => row.version));

  let ran = 0;
  for (const file of files) {
    const version = file.split("_")[0] ?? file.replace(/\.sql$/, "");
    const name = file.replace(/\.sql$/, "");
    if (applied.has(version)) {
      console.log(`  ✓ skip  ${file}`);
      continue;
    }

    const body = readFileSync(resolve(migrationsDir, file), "utf8");
    console.log(`  → apply ${file}`);

    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`
        insert into supabase_migrations.schema_migrations (version, name, statements)
        values (${version}, ${name}, ${[body]})
      `;
    });
    ran += 1;
  }

  console.log(`[db:migrate] done — applied ${ran}, skipped ${files.length - ran}.`);
} catch (error) {
  console.error("[db:migrate] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}

function buildDbUrlCandidates(ref) {
  const explicit = process.env.DATABASE_URL?.trim() || process.env.SUPABASE_DB_URL?.trim() || "";
  if (explicit) return [explicit];

  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  if (!password) return [];

  const encoded = encodeURIComponent(password);
  const preferred = process.env.SUPABASE_DB_REGION?.trim();
  // Prefer India/Asia first (IST), then common Supabase regions.
  const regions = unique(
    [
      preferred,
      "ap-south-1",
      "ap-southeast-1",
      "ap-northeast-1",
      "eu-west-1",
      "eu-central-1",
      "us-east-1",
      "us-west-1",
    ].filter(Boolean),
  );

  const urls = [];
  for (const region of regions) {
    // Session pooler (IPv4) — required on most local networks.
    urls.push(
      `postgresql://postgres.${ref}:${encoded}@aws-0-${region}.pooler.supabase.com:5432/postgres`,
    );
  }
  // Last resort: direct host (often IPv6-only → ETIMEDOUT).
  urls.push(`postgresql://postgres:${encoded}@db.${ref}.supabase.co:5432/postgres`);
  return urls;
}

async function connectWithFallback(urls) {
  const errors = [];
  for (const url of urls) {
    const client = postgres(url, {
      max: 1,
      ssl: "require",
      connect_timeout: 12,
      // Prefer IPv4 — avoids AAAA/IPv6 timeouts on many office networks.
      connection: { family: 4 },
      onnotice: () => {},
    });
    try {
      await client`select 1`;
      return { sql: client, usedUrl: url };
    } catch (error) {
      errors.push(`${maskUrl(url)} → ${error instanceof Error ? error.message : error}`);
      await client.end({ timeout: 1 }).catch(() => {});
    }
  }

  console.error("[db:migrate] could not connect with any candidate URL:\n");
  for (const line of errors) console.error(`  - ${line}`);
  console.error(`
Fix:
  1. Open Dashboard → Connect → Session pooler
  2. Copy the URI into DATABASE_URL in .env
  3. Or set SUPABASE_DB_PASSWORD + SUPABASE_DB_REGION (e.g. ap-south-1)
`);
  process.exit(1);
}

function maskUrl(url) {
  return url.replace(/\/\/([^:/?]+):([^@/]+)@/, "//$1:***@");
}

function unique(items) {
  return [...new Set(items)];
}

function syncConfigToml(ref) {
  const path = resolve(process.cwd(), "supabase/config.toml");
  if (!existsSync(path)) {
    writeFileSync(path, `# Synced from SUPABASE_PROJECT_ID\nproject_id = "${ref}"\n`, "utf8");
    return;
  }
  const current = readFileSync(path, "utf8");
  const next = current.match(/^\s*project_id\s*=/m)
    ? current.replace(/^\s*project_id\s*=\s*".*"/m, `project_id = "${ref}"`)
    : `project_id = "${ref}"\n${current}`;
  if (next !== current) writeFileSync(path, next, "utf8");
}
