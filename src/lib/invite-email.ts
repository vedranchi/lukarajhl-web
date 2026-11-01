import { Resend } from "resend";

/**
 * Owner-notification email for a private Telegram request. This email is the
 * review workflow: it carries the handle and a signed link to each beat, and
 * Luka replies on Instagram from it.
 *
 * Contract: **never throws.** Returns `{ ok: true }` on a successful send and
 * `{ ok: false, error }` on a missing-config, transport, or Resend-API error.
 * recordInviteRequest() depends on this so a send failure is stamped on the row
 * as `status: "email_failed"` without losing the already-stored lead.
 */

export type SendInviteEmailResult = { ok: true } | { ok: false; error: string };

/** The subset of a lead row the email template interpolates (all validator-sanitised). */
export type InviteEmailInput = {
  instagram: string | null;
  createdAt?: string | null;
  tracks?: { path: string; originalName?: string | null; sizeBytes?: number | null; url?: string | null }[] | null;
  // `ip` stays on the row for rate limiting, but is deliberately not put in the
  // email: it is the applicant's personal data and nothing in reviewing three
  // beats needs it. Accepted here only so callers can pass the row as-is.
  ip?: string | null;
};

export async function sendInviteEmail(doc: InviteEmailInput): Promise<SendInviteEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const notifyTo = process.env.INVITE_NOTIFY_TO;
  if (!apiKey || !notifyTo) {
    return { ok: false, error: "RESEND_API_KEY / INVITE_NOTIFY_TO not configured" };
  }

  const { instagram, tracks } = doc;
  const created = doc.createdAt ? new Date(doc.createdAt) : new Date();
  const skopje = created.toLocaleString("en-GB", { timeZone: "Europe/Skopje", hour12: false });

  const text = [
    "Instagram",
    "---------",
    instagram ?? "unavailable",
    "",
    "Beats",
    "-----",
    ...(tracks?.length
      ? tracks.flatMap((t, i) => [
          `${i + 1}. ${t.originalName || t.path}`,
          `   ${t.url || `(link unavailable: ${t.path} in the Supabase invite-tracks bucket)`}`,
        ])
      : ["(none attached)"]),
    "",
    "Requested At",
    "------------",
    `${created.toISOString()} (UTC) · ${skopje} (Skopje)`,
    "",
    `${instagram} has requested to join your private Telegram group.`,
    "",
    "Listen first, then reply on Instagram with the group invite if it is a fit.",
  ].join("\n");

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.INVITE_FROM || "Private Telegram <onboarding@resend.dev>",
      to: notifyTo,
      subject: `${instagram} would like to join your private Telegram group`,
      text,
    });
    if (error) {
      return { ok: false, error: error.message || String(error) };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  return { ok: true };
}
