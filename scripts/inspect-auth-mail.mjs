/**
 * Inspect Auth SMTP + raise email send rate limit (custom SMTP required).
 * Usage: node scripts/inspect-auth-mail.mjs
 */
import { readFileSync, existsSync } from "node:fs";

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
const token = env.SUPABASE_ACCESS_TOKEN;
const projectRef = (env.SUPABASE_PROJECT_ID || "").trim();
if (!token || !projectRef) {
  console.error("Need SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_ID");
  process.exit(1);
}

const url = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;

async function getConfig() {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  if (!res.ok) {
    console.error("GET failed", res.status, body);
    process.exit(1);
  }
  return body;
}

function summarize(cfg) {
  return {
    smtp_host: cfg.smtp_host,
    smtp_port: cfg.smtp_port,
    smtp_user: cfg.smtp_user,
    smtp_admin_email: cfg.smtp_admin_email,
    smtp_sender_name: cfg.smtp_sender_name,
    smtp_pass_set: Boolean(cfg.smtp_pass),
    hook_send_email_enabled: cfg.hook_send_email_enabled,
    external_email_enabled: cfg.external_email_enabled,
    rate_limit_email_sent: cfg.rate_limit_email_sent,
  };
}

const before = await getConfig();
console.log("before:", JSON.stringify(summarize(before), null, 2));

const usingResend =
  String(before.smtp_host || "").includes("resend") && Boolean(before.smtp_pass);

if (!usingResend) {
  console.error(
    "Custom Resend SMTP is NOT active — Auth is still on Supabase built-in mailer (2 emails/hour).",
  );
  console.error("Run: npm run db:sync-auth-emails");
  process.exit(2);
}

// Custom SMTP unlocks raising this. Default built-in is ~2/hour.
const rateLimit = Number(env.SUPABASE_RATE_LIMIT_EMAIL_SENT || 100);
const patch = await fetch(url, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ rate_limit_email_sent: rateLimit }),
});
const patchText = await patch.text();
if (!patch.ok) {
  console.error("PATCH rate limit failed", patch.status, patchText.slice(0, 500));
  process.exit(1);
}

const after = await getConfig();
console.log("after:", JSON.stringify(summarize(after), null, 2));
console.log(
  `OK — Auth mail via Resend SMTP; Supabase email send rate limit set to ${after.rate_limit_email_sent}/hour`,
);
