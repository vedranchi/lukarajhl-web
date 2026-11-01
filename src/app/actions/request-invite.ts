"use server";

import { headers } from "next/headers";
import { validateInvite } from "@/lib/validate-invite";
import { envInt } from "@/lib/env";
import { pgInviteStore, recordInviteRequest } from "@/lib/invite-requests";
import {
  TRACK_COUNT,
  prepareUploads,
  signDownloadUrl,
  statObject,
  uploadsAreFlooded,
  validateTrackInputs,
  verifyClaim,
  type PreparedUploads,
  type StoredTrack,
} from "@/lib/track-uploads";

/**
 * Server action for the Private Telegram request form.
 *
 * Flow: honeypot + time-gate (silent drop) → validation → durable IP rate
 * limit (Postgres `invite_requests`) → store the lead and email the owner. CSRF
 * is covered by Next server actions (POST-only + same-origin enforcement).
 *
 * Storing, duplicate detection and the email + status stamp live in
 * recordInviteRequest() (src/lib/invite-requests.ts): a lead is always stored,
 * even if the send then fails — it is marked `email_failed` instead. The env
 * guard at the end stays only to surface a friendlier "temporarily unavailable"
 * message when Resend is unconfigured.
 */

export type InviteResult = { ok: true } | { ok: false; error: string };
export type PrepareResult = { ok: true; prepared: PreparedUploads } | { ok: false; error: string };

const MIN_FILL_MS = 3_000; // submissions faster than this are bots
const RATE_LIMIT = envInt(process.env.INVITE_RATE_LIMIT, 3); // creates per IP…
const RATE_WINDOW_MS = envInt(process.env.INVITE_RATE_WINDOW_MS, 60 * 60 * 1_000); // …per hour

/** Edge-set true client IP. The leftmost x-forwarded-for hop is client-settable,
    so trusting it first let the per-IP rate limit be bypassed with a spoofed
    header; XFF is only a fallback when x-real-ip is absent. */
async function clientIp(): Promise<string> {
  const hdrs = await headers();
  return hdrs.get("x-real-ip")?.trim() || hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
}

/** Durable, Postgres-backed per-IP limit shared by both steps of the flow, so
    minting upload URLs is gated by the same budget as creating a request. No IP
    (proxy stripped it) means skip; the honeypot and time-gate still apply. */
async function overRateLimit(ip: string): Promise<boolean> {
  if (!ip) return false;
  const recent = await pgInviteStore().countByIpSince(ip, new Date(Date.now() - RATE_WINDOW_MS));
  return recent >= RATE_LIMIT;
}

/** Silent-drop signals shared by both steps. A bot that skips the form and
    calls the action directly trips the same wires as one that fills it in. */
function looksAutomated(honeypot: unknown, elapsedRaw: unknown): boolean {
  if (typeof honeypot === "string" && honeypot.trim() !== "") return true;
  if (typeof elapsedRaw === "string" && elapsedRaw.trim() !== "") {
    const parsed = Number(elapsedRaw);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed < MIN_FILL_MS) return true;
  }
  return false;
}

/**
 * Step 1 of the upload flow: validate what the browser claims about the three
 * files, then hand back one signed Supabase URL per track plus a claim binding
 * those exact object paths. The browser uploads directly; nothing large ever
 * passes through this action.
 *
 * Guarded as heavily as the submit step, because it is the step that spends
 * storage. The per-IP limit counts request rows, so on its own it cannot see
 * someone who mints URLs and never submits; `uploadsAreFlooded` is the backstop
 * that caps the damage globally.
 */
export async function prepareTrackUploads(
  files: unknown,
  guard?: { company?: unknown; elapsedMs?: unknown },
): Promise<PrepareResult> {
  // Pretend it worked, but hand back nothing usable: a bot gets no upload URL.
  if (looksAutomated(guard?.company, guard?.elapsedMs)) {
    return { ok: false, error: "Uploads are temporarily unavailable." };
  }

  const validated = validateTrackInputs(files);
  if (!validated.ok) return { ok: false, error: validated.error };

  const ip = await clientIp();
  if (await overRateLimit(ip)) {
    return { ok: false, error: "Too many requests from your connection — try again in an hour." };
  }

  if (await uploadsAreFlooded()) {
    console.error("prepareTrackUploads: hourly upload ceiling reached");
    return { ok: false, error: "Too many uploads right now — try again in an hour." };
  }

  return prepareUploads(validated.files);
}

export async function requestInvite(formData: FormData): Promise<InviteResult> {
  // Honeypot + time-gate. Humans never fill the hidden field, and a sub-3s fill
  // is a script; both get a fake success so bots move on. The time-gate is only
  // enforced when the field is present, so a direct POST without it still works
  // rather than silently dropping a visitor with a skewed device clock.
  const elapsedRaw = formData.get("elapsedMs");
  if (looksAutomated(formData.get("company"), elapsedRaw)) return { ok: true };

  let elapsedMs: number | undefined;
  if (typeof elapsedRaw === "string" && elapsedRaw.trim() !== "") {
    const parsed = Number(elapsedRaw);
    if (Number.isFinite(parsed) && parsed >= 0) elapsedMs = parsed;
  }

  const validated = validateInvite(formData.get("instagram"));
  if (!validated.ok) return { ok: false, error: validated.error };
  const { instagram } = validated;

  // The three uploaded beats. `paths` and `claim` come back from
  // prepareTrackUploads; the claim is what proves this browser was issued these
  // exact paths, so a forged or borrowed path cannot be attached to a request.
  const pathsRaw = formData.get("trackPaths");
  const names = formData.getAll("trackNames").map((n) => String(n).slice(0, 120));
  let paths: string[];
  try {
    const parsed = JSON.parse(typeof pathsRaw === "string" ? pathsRaw : "[]");
    paths = Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : [];
  } catch {
    paths = [];
  }

  if (paths.length !== TRACK_COUNT) {
    return { ok: false, error: `Attach exactly ${TRACK_COUNT} beats.` };
  }
  if (!verifyClaim(formData.get("trackClaim"), paths)) {
    return { ok: false, error: "Your uploads expired — pick your beats again." };
  }

  const hdrs = await headers();
  const ip = await clientIp();
  const userAgent = hdrs.get("user-agent")?.slice(0, 500) || "";

  if (await overRateLimit(ip)) {
    return { ok: false, error: "Too many requests from your connection — try again in an hour." };
  }

  // Confirm each object actually landed at an accepted size and type, then mint
  // the review links. Checking storage rather than trusting the post is what
  // stops a request that claims uploads which never happened.
  const tracks: StoredTrack[] = [];
  for (const [i, path] of paths.entries()) {
    const stat = await statObject(path);
    if (!stat.ok) return { ok: false, error: stat.error };
    tracks.push({
      path,
      originalName: names[i] || `${i + 1}.mp3`,
      sizeBytes: stat.sizeBytes,
      url: (await signDownloadUrl(path)) ?? "",
    });
  }

  // Store the lead, then email the owner (or skip the email for a duplicate).
  // Only a failed insert throws; a failed send is stamped `email_failed` on the
  // stored row, so a send failure never loses the lead.
  try {
    await recordInviteRequest({
      instagram,
      tracks,
      source: "invite-form",
      ...(ip ? { ip } : {}),
      ...(userAgent ? { userAgent } : {}),
      ...(elapsedMs !== undefined ? { elapsedMs } : {}),
    });
  } catch (err) {
    console.error("requestInvite: persist failed", err);
    return { ok: false, error: "Could not send your request — please try again later." };
  }

  // The lead is saved; only the message differs when email delivery is down.
  // Distinct copy from a transport failure, so the visitor gets a useful nudge.
  if (!process.env.RESEND_API_KEY || !process.env.INVITE_NOTIFY_TO) {
    console.error("requestInvite: RESEND_API_KEY / INVITE_NOTIFY_TO not configured");
    return { ok: false, error: "Requests are temporarily unavailable — DM on Instagram instead." };
  }

  return { ok: true };
}
