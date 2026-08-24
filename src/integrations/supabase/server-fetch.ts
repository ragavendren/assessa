/**
 * Shared server-side fetch for Supabase clients.
 * Handles new opaque API keys and optional local TLS bypass for corporate SSL inspection.
 */
import { Agent, fetch as undiciFetch } from "undici";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function stripEnvQuotes(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/** Local-only escape hatch when antivirus/proxy MITMs HTTPS with a private CA. */
export function supabaseInsecureTlsEnabled() {
  const flag = stripEnvQuotes(process.env["SUPABASE_INSECURE_TLS"]).toLowerCase();
  return flag === "1" || flag === "true" || process.env["NODE_TLS_REJECT_UNAUTHORIZED"] === "0";
}

let insecureAgent: Agent | null = null;
let warnedInsecure = false;

function getInsecureAgent() {
  if (!insecureAgent) {
    insecureAgent = new Agent({ connect: { rejectUnauthorized: false } });
  }
  if (!warnedInsecure && process.env.NODE_ENV !== "production") {
    warnedInsecure = true;
    console.warn(
      "[Supabase] SUPABASE_INSECURE_TLS is enabled — TLS certificate verification is disabled for Supabase fetches (local SSL inspection workaround).",
    );
  }
  return insecureAgent;
}

export function createSupabaseFetch(supabaseKey: string): typeof fetch {
  const insecure = supabaseInsecureTlsEnabled();

  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);

    if (insecure) {
      return undiciFetch(input as Parameters<typeof undiciFetch>[0], {
        ...(init as object),
        headers,
        dispatcher: getInsecureAgent(),
      }) as unknown as ReturnType<typeof fetch>;
    }

    return fetch(input, { ...init, headers });
  };
}

export function formatSupabaseFetchError(error: unknown) {
  if (!error || typeof error !== "object") return String(error ?? "unknown error");
  const err = error as { message?: string; cause?: { code?: string; message?: string } };
  const cause = err.cause?.code || err.cause?.message;
  if (cause === "SELF_SIGNED_CERT_IN_CHAIN" || /self.?signed|CERT/i.test(String(cause ?? ""))) {
    return `${err.message ?? "fetch failed"} (${cause}). Local SSL inspection is blocking Node. Set SUPABASE_INSECURE_TLS=true in .env for local dev, or install your corporate CA via NODE_EXTRA_CA_CERTS.`;
  }
  return cause ? `${err.message ?? "fetch failed"} (${cause})` : (err.message ?? "unknown error");
}

export { stripEnvQuotes };
