/**
 * Supabase Auth Send Email Hook → Resend API.
 * When enabled, Supabase does not send Auth mail itself.
 */
import { Webhook } from "standardwebhooks";
import { sendAuthEmail, type AuthEmailPayload } from "@/lib/email.server";

function hookSecret() {
  // Supabase stores secrets as "v1,whsec_..." — verifier wants the part after "v1,"
  const raw = (process.env["SEND_EMAIL_HOOK_SECRET"] || "").trim();
  if (!raw) return "";
  return raw.startsWith("v1,") ? raw.slice(3) : raw;
}

function verifyRequest(request: Request, body: string) {
  const secret = hookSecret();
  if (!secret) {
    console.warn(
      "[auth-email-hook] SEND_EMAIL_HOOK_SECRET unset — rejecting (set secret for production)",
    );
    return false;
  }

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  try {
    const wh = new Webhook(secret);
    wh.verify(body, headers);
    return true;
  } catch (error) {
    console.error("[auth-email-hook] signature verification failed:", error);
    return false;
  }
}

export async function handleSupabaseSendEmailHook(request: Request): Promise<Response> {
  const bodyText = await request.text();
  if (!verifyRequest(request, bodyText)) {
    return new Response(JSON.stringify({ error: "invalid signature" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  let payload: AuthEmailPayload;
  try {
    payload = JSON.parse(bodyText) as AuthEmailPayload;
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const ok = await sendAuthEmail(payload);
  if (!ok) {
    // Non-2xx makes Supabase retry / surface failure to the client
    return new Response(JSON.stringify({ error: "resend_failed" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
