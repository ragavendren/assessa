/**
 * Outbound email via Resend.
 * - Product: invites, results, badges (Resend API)
 * - Auth: confirmation / magic link / recovery via Supabase SMTP → Resend
 *   (configured by `npm run db:sync-auth-emails`)
 */
import { Resend } from "resend";

export type EmailPayload = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

/** Simple RFC-ish address check Resend accepts as `email@example.com`. */
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

function stripQuotes(value: string | undefined) {
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

/** Normalize `Name <email@x.com>`, quoted, or raw addresses into bare emails. */
export function normalizeEmailAddress(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let value = stripQuotes(raw)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
  if (!value) return null;

  const angled = value.match(/<([^<>@\s]+@[^<>@\s]+\.[^<>@\s]+)>/);
  if (angled?.[1]) value = angled[1].trim();

  value = stripQuotes(value).toLowerCase();
  if (!EMAIL_RE.test(value)) return null;
  return value;
}

/** Parse invite textarea: commas / semicolons / newlines, plus `Name <email>` forms. */
export function parseEmailList(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const parts = raw
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const emails: string[] = [];
  for (const part of parts) {
    const single = normalizeEmailAddress(part);
    if (single) {
      emails.push(single);
      continue;
    }
    for (const token of part.split(/\s+/)) {
      const email = normalizeEmailAddress(token);
      if (email) emails.push(email);
    }
  }
  return [...new Set(emails)];
}

function resendClient() {
  const apiKey = stripQuotes(process.env["RESEND_API_KEY"]);
  if (!apiKey) return null;
  return new Resend(apiKey);
}

export function appBaseUrl() {
  const configured = stripQuotes(process.env["APP_URL"] || process.env["VITE_APP_URL"]);
  if (configured) return configured.replace(/\/$/, "");
  const vercel = stripQuotes(process.env["VERCEL_URL"]);
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return "http://localhost:3000";
}

function fromAddress() {
  const raw = stripQuotes(process.env["RESEND_FROM_EMAIL"]) || "Assessa <onboarding@resend.dev>";
  if (raw.includes("<") && raw.includes(">")) return raw;
  if (raw.includes("@")) return `Assessa <${raw}>`;
  return "Assessa <onboarding@resend.dev>";
}

/** Send one email. Returns false when Resend is not configured or send fails. */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const client = resendClient();
  if (!client) {
    console.warn("[email] RESEND_API_KEY not set — skipping send:", payload.subject);
    return false;
  }

  const rawRecipients = Array.isArray(payload.to) ? payload.to : [payload.to];
  const to = [
    ...new Set(
      rawRecipients
        .map((value) => normalizeEmailAddress(value))
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  if (to.length === 0) {
    console.warn(
      "[email] skipping send — no valid recipients for:",
      payload.subject,
      "raw=",
      rawRecipients,
    );
    return false;
  }

  try {
    const { error } = await client.emails.send({
      from: fromAddress(),
      // Resend is pickier with arrays in some edge cases; use a string for one recipient.
      to: to.length === 1 ? to[0]! : to,
      subject: payload.subject,
      html: payload.html,
      ...(payload.text ? { text: payload.text } : {}),
    });
    if (error) {
      console.error("[email] Resend error:", error, "to=", to);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email] Resend send failed:", error, "to=", to);
    return false;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(
  title: string,
  bodyHtml: string,
  cta?: { href: string; label: string },
  opts?: { brandAsHeading?: boolean },
) {
  const brandHeading = opts?.brandAsHeading !== false;
  const heading = brandHeading
    ? `<h1 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.2;color:#0f3d2e;font-weight:600">Assessa</h1>
       <p style="margin:0 0 22px;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:#5b6b63;font-weight:600">${escapeHtml(title)}</p>`
    : `<p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#5b6b63">Assessa</p>
       <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${escapeHtml(title)}</h1>`;

  const button = cta
    ? `<p style="margin:28px 0 8px">
        <a href="${escapeHtml(cta.href)}"
           style="display:inline-block;background:#0f3d2e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">
          ${escapeHtml(cta.label)}
        </a>
      </p>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f6f5;font-family:Public Sans,Segoe UI,sans-serif;color:#14201b">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f5;padding:32px 16px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:520px;background:#fff;border-radius:16px;padding:32px 28px;border:1px solid #e2e8e4">
            <tr>
              <td>
                ${heading}
                ${bodyHtml}
                ${button}
                <p style="margin:28px 0 0;font-size:12px;color:#7a8a82">
                  You received this because of activity on Assessa.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendNotificationEmail(input: {
  to: string;
  kind: string;
  title: string;
  body?: string;
  href?: string;
  ctaLabel?: string;
}) {
  const bodyHtml = `<p style="margin:0;font-size:15px;line-height:1.55;color:#33443c">${escapeHtml(input.body || "")}</p>`;
  return sendEmail({
    to: input.to,
    subject: input.title,
    html: layout(
      input.title,
      bodyHtml,
      input.href ? { href: input.href, label: input.ctaLabel ?? "Open Assessa" } : undefined,
      {
        brandAsHeading: false,
      },
    ),
    text: [input.title, input.body, input.href].filter(Boolean).join("\n\n"),
  });
}

export async function sendExamInvitationEmails(input: {
  emails: string[];
  examId: string;
  title: string;
  description?: string;
}) {
  const href = `${appBaseUrl()}/take/${input.examId}`;
  const description = input.description?.trim()
    ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#33443c">${escapeHtml(input.description.trim())}</p>`
    : "";
  const bodyHtml = `${description}<p style="margin:0;font-size:15px;line-height:1.55;color:#33443c">You have been invited to take <strong>${escapeHtml(input.title)}</strong> on Assessa.</p>`;

  const results = await Promise.all(
    input.emails.map((email) =>
      sendEmail({
        to: email,
        subject: `Invitation: ${input.title}`,
        html: layout(
          `You're invited — ${input.title}`,
          bodyHtml,
          {
            href,
            label: "Open assessment",
          },
          { brandAsHeading: false },
        ),
        text: `You're invited to ${input.title}\n\n${input.description ?? ""}\n\nOpen: ${href}`,
      }),
    ),
  );
  return results.filter(Boolean).length;
}
