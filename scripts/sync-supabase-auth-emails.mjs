/**
 * Configure Assessa Auth emails via Resend SMTP + Assessa HTML templates.
 * Covers confirmation, recovery, magic link (and other Auth mailer subjects).
 *
 * Requires in .env:
 *   SUPABASE_ACCESS_TOKEN
 *   SUPABASE_PROJECT_ID
 *   RESEND_API_KEY
 *   RESEND_FROM_EMAIL   (verified domain, e.g. Assessa <hello@yourdomain.com>)
 *
 * Usage: npm run db:sync-auth-emails
 */
import { readFileSync, existsSync } from "node:fs";
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

const fileEnv = loadEnvFile();
const env = { ...fileEnv, ...process.env };
const token = env.SUPABASE_ACCESS_TOKEN;
const projectRef = (env.SUPABASE_PROJECT_ID || "").trim();
const resendKey = (env.RESEND_API_KEY || "").trim();
const from = parseFrom(env.RESEND_FROM_EMAIL);

if (!token) {
  console.error("Missing SUPABASE_ACCESS_TOKEN");
  process.exit(1);
}
if (!projectRef) {
  console.error("Missing SUPABASE_PROJECT_ID");
  process.exit(1);
}
if (!resendKey) {
  console.error("Missing RESEND_API_KEY — required for Auth SMTP");
  process.exit(1);
}
if (!from?.adminEmail) {
  console.error(
    "Missing or invalid RESEND_FROM_EMAIL (use a verified domain address, e.g. Assessa <hello@yourdomain.com>)",
  );
  process.exit(1);
}

function loadTemplate(name) {
  return readFileSync(resolve("supabase/templates", name), "utf8");
}

const payload = {
  external_email_enabled: true,
  mailer_autoconfirm: false,
  mailer_secure_email_change_enabled: true,

  mailer_subjects_confirmation: "Confirm your Assessa account",
  mailer_templates_confirmation_content: loadTemplate("confirmation.html"),
  mailer_subjects_recovery: "Reset your Assessa password",
  mailer_templates_recovery_content: loadTemplate("recovery.html"),
  mailer_subjects_magic_link: "Your Assessa sign-in link",
  mailer_templates_magic_link_content: loadTemplate("magic_link.html"),
  mailer_subjects_invite: "You're invited to Assessa",
  mailer_subjects_email_change: "Confirm your new Assessa email",

  // Resend SMTP — Auth confirmation / magic link / recovery / invite
  hook_send_email_enabled: false,
  smtp_host: "smtp.resend.com",
  smtp_port: "465",
  smtp_user: "resend",
  smtp_pass: resendKey,
  smtp_admin_email: from.adminEmail,
  smtp_sender_name: from.senderName,

  // Built-in mailer is ~2/hour. Custom SMTP unlocks raising this.
  // Still a Supabase Auth gate (not Resend) — bump for production testing.
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

console.log("Auth email + Resend SMTP synced for", projectRef);
console.log("- SMTP: smtp.resend.com:465");
console.log("- From:", `${from.senderName} <${from.adminEmail}>`);
console.log("- Templates: confirmation, recovery, magic_link");
console.log("- Supabase email send rate limit:", payload.rate_limit_email_sent, "/hour");
console.log(
  "Note: 'email rate limit exceeded' is from Supabase Auth (not Resend).",
);
console.log(
  "Ensure this domain is verified in Resend → Domains, then test signup / forgot-password.",
);
