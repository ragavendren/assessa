/**
 * Inspect Auth email delivery mode (Send Email Hook vs SMTP).
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
const res = await fetch(url, {
  headers: { Authorization: `Bearer ${token}` },
});
const cfg = await res.json();
if (!res.ok) {
  console.error("GET failed", res.status, cfg);
  process.exit(1);
}

const summary = {
  delivery: cfg.hook_send_email_enabled
    ? "Resend API via Send Email Hook"
    : cfg.smtp_host
      ? `SMTP (${cfg.smtp_host})`
      : "Supabase built-in mailer",
  hook_send_email_enabled: cfg.hook_send_email_enabled,
  hook_send_email_uri: cfg.hook_send_email_uri || null,
  smtp_host: cfg.smtp_host,
  smtp_admin_email: cfg.smtp_admin_email,
  rate_limit_email_sent: cfg.rate_limit_email_sent,
};

console.log(JSON.stringify(summary, null, 2));

if (!cfg.hook_send_email_enabled) {
  console.error("\nAuth is NOT on Resend API hook. Run: npm run db:sync-auth-emails");
  process.exit(2);
}
console.log("\nOK — Auth emails are delivered by Resend API (not Supabase mailer).");
