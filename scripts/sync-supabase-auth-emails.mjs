/**
 * Auth emails via Resend API only (Supabase Send Email Hook).
 * Disables Supabase SMTP / built-in mailer — Supabase only calls our hook.
 *
 * Requires in .env:
 *   SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_ID
 *   RESEND_API_KEY, RESEND_FROM_EMAIL (verified domain)
 *   APP_URL (https public URL of the app)
 *   SEND_EMAIL_HOOK_SECRET (v1,whsec_... — generated if missing)
 *
 * Usage: npm run db:sync-auth-emails
 */
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile() {
  const env = {};
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
    env[line.slice(0, i).trim()] = value;
  }
  return env;
}

function parseFrom(raw) {
  const value = (raw || "").trim();
  if (!value) return null;
  const angled = value.match(/^(.*)<([^>]+)>$/);
  if (angled) {
    return {
      senderName: angled[1].trim().replace(/^"|"$/g, "") || "Assessa",
      adminEmail: angled[2].trim().toLowerCase(),
    };
  }
  if (!value.includes("@")) return null;
  return { senderName: "Assessa", adminEmail: value.toLowerCase() };
}

function ensureHookSecret(fileEnv) {
  let secret = (fileEnv.SEND_EMAIL_HOOK_SECRET || process.env.SEND_EMAIL_HOOK_SECRET || "").trim();
  if (secret) return secret;

  secret = `v1,whsec_${randomBytes(32).toString("base64")}`;
  const envPath = resolve(".env");
  const existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const line = `\n# Supabase Auth Send Email Hook (Resend API)\nSEND_EMAIL_HOOK_SECRET=${secret}\n`;
  writeFileSync(
    envPath,
    existing.endsWith("\n") || !existing ? `${existing}${line}` : `${existing}\n${line}`,
  );
  console.log("Generated SEND_EMAIL_HOOK_SECRET and appended to .env");
  return secret;
}

const fileEnv = loadEnvFile();
const env = { ...fileEnv, ...process.env };
const token = env.SUPABASE_ACCESS_TOKEN;
const projectRef = (env.SUPABASE_PROJECT_ID || "").trim();
const resendKey = (env.RESEND_API_KEY || "").trim();
const from = parseFrom(env.RESEND_FROM_EMAIL);
const appUrl = (env.APP_URL || "").replace(/\/$/, "");
const hookSecret = ensureHookSecret(fileEnv);

if (!token) {
  console.error("Missing SUPABASE_ACCESS_TOKEN");
  process.exit(1);
}
if (!projectRef) {
  console.error("Missing SUPABASE_PROJECT_ID");
  process.exit(1);
}
if (!resendKey) {
  console.error("Missing RESEND_API_KEY — required for Resend Auth delivery");
  process.exit(1);
}
if (!from?.adminEmail) {
  console.error(
    "Missing or invalid RESEND_FROM_EMAIL (verified domain, e.g. Assessa <hello@yourdomain.com>)",
  );
  process.exit(1);
}
if (!appUrl.startsWith("https://") || /localhost|127\.0\.0\.1/.test(appUrl)) {
  console.error(
    "APP_URL must be a public https URL for the Send Email Hook (e.g. https://assessa.sstcloud.com.au)",
  );
  process.exit(1);
}

function loadTemplate(name) {
  return readFileSync(resolve("supabase/templates", name), "utf8");
}

const hookUri = `${appUrl}/api/auth/send-email`;

const payload = {
  external_email_enabled: true,
  mailer_autoconfirm: false,
  mailer_secure_email_change_enabled: true,

  // Templates kept for Dashboard preview; delivery is via our Resend hook.
  mailer_subjects_confirmation: "Confirm your Assessa account",
  mailer_templates_confirmation_content: loadTemplate("confirmation.html"),
  mailer_subjects_recovery: "Reset your Assessa password",
  mailer_templates_recovery_content: loadTemplate("recovery.html"),
  mailer_subjects_magic_link: "Your Assessa sign-in link",
  mailer_templates_magic_link_content: loadTemplate("magic_link.html"),
  mailer_subjects_invite: "You're invited to Assessa",
  mailer_subjects_email_change: "Confirm your new Assessa email",

  // Resend-only: disable SMTP / built-in — Auth calls our hook instead
  smtp_host: null,
  smtp_port: null,
  smtp_user: null,
  smtp_pass: null,
  smtp_admin_email: null,
  smtp_sender_name: null,
  hook_send_email_enabled: true,
  hook_send_email_uri: hookUri,
  hook_send_email_secrets: hookSecret,

  rate_limit_email_sent: Number(env.SUPABASE_RATE_LIMIT_EMAIL_SENT || 100),
};

const url = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;
const res = await fetch(url, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

const text = await res.text();
if (!res.ok) {
  console.error(`Failed (${res.status}):`, text.slice(0, 800));
  process.exit(1);
}

console.log("Auth email delivery → Resend API (Send Email Hook)");
console.log("- Hook URI:", hookUri);
console.log("- From (Resend):", `${from.senderName} <${from.adminEmail}>`);
console.log("- SMTP / built-in Supabase mailer: disabled");
console.log("- Rate limit (Auth triggers/hour):", payload.rate_limit_email_sent);
console.log(
  "Deploy the app with RESEND_API_KEY, RESEND_FROM_EMAIL, SEND_EMAIL_HOOK_SECRET, then test signup.",
);
