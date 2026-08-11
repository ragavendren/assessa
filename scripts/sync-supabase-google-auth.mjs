/**
 * Enable Google sign-in on the hosted Supabase project and refresh Auth redirect URLs.
 *
 * Requires in .env:
 *   SUPABASE_ACCESS_TOKEN
 *   GOOGLE_CLIENT_ID        (Google Cloud OAuth Web client)
 *   GOOGLE_CLIENT_SECRET
 *
 * Usage: node scripts/sync-supabase-google-auth.mjs
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
const clientId = env.GOOGLE_CLIENT_ID;
const clientSecret = env.GOOGLE_CLIENT_SECRET;
const appUrl = (env.APP_URL || "https://assessa.sstcloud.com.au").replace(/\/$/, "");

if (!token) {
  console.error("Missing SUPABASE_ACCESS_TOKEN");
  process.exit(1);
}
if (!projectRef) {
  console.error("Missing SUPABASE_PROJECT_ID");
  process.exit(1);
}

const developUrl = "https://assessa-git-develop-ragavendrenv-5507s-projects.vercel.app";
const prodVercelAlias = "https://assessa-ragavendrenv-5507s-projects.vercel.app";

const redirects = [
  "http://localhost:3000/**",
  "http://localhost:3000/auth/callback",
  `${appUrl}/**`,
  `${appUrl}/auth/callback`,
  `${prodVercelAlias}/**`,
  `${prodVercelAlias}/auth/callback`,
  `${developUrl}/**`,
  `${developUrl}/auth/callback`,
];

const payload = {
  site_url: appUrl.startsWith("http") ? appUrl : "https://assessa.sstcloud.com.au",
  uri_allow_list: [...new Set(redirects)].join(","),
};

if (clientId && clientSecret) {
  payload.external_google_enabled = true;
  payload.external_google_client_id = clientId;
  payload.external_google_secret = clientSecret;
  console.log("Enabling Google provider with provided client ID");
} else {
  console.log(
    "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — updating redirect URLs only.\n" +
      "Create a Google Cloud OAuth Web client, then re-run this script.",
  );
}

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

console.log("Updated Auth redirects for", projectRef);
console.log("- site_url:", payload.site_url);
console.log("- uri_allow_list:", payload.uri_allow_list);
if (clientId && clientSecret) {
  console.log("- Google OAuth: enabled");
  console.log(
    "Google Console authorized redirect URI must include:\n" +
      `  https://${projectRef}.supabase.co/auth/v1/callback`,
  );
} else {
  console.log("- Google OAuth: unchanged (still disabled until credentials are set)");
}
