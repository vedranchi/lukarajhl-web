/**
 * Supabase Storage plumbing for the Private Telegram application form.
 *
 * Applicants attach three mp3s. They are uploaded **straight from the browser**
 * to a private Supabase bucket using short-lived signed URLs minted here, then
 * the form posts only the object paths. Two reasons it works this way:
 *
 *  - Next's server actions cap request bodies at 1 MB by default, so 3 x 20 MB
 *    could never be posted through the action itself.
 *  - The service-role key never leaves the server; the browser only ever holds a
 *    single-use upload token scoped to one object path.
 *
 * Endpoint shapes below were verified against the live project rather than taken
 * from documentation (CLAUDE.md P4 applies to any third-party API):
 *   POST /object/upload/sign/{bucket}/{path}      -> { url, token }
 *   PUT  /storage/v1{url}  (Content-Type only)    -> { Key }
 *   GET  /object/info/authenticated/{bucket}/{p}  -> { size, content_type, ... }
 *   POST /object/sign/{bucket}/{path} {expiresIn} -> { signedURL }
 *   DELETE /object/{bucket} { prefixes: [...] }   -> [ ... ]
 *
 * The bucket itself enforces `public: false`, a 20 MB cap and an audio/mpeg
 * allow-list, so a client that bypassed every check here still cannot store a
 * 200 MB wav — verified: such a PUT returns 415 InvalidMimeType.
 */

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { MIN_SECRET_LENGTH } from "./env";

/** Exactly three, per the brief: an applicant's three best solo beats. */
export const TRACK_COUNT = 3;
export const MAX_TRACK_BYTES = 20 * 1024 * 1024;
/** Below this a "beat" is a stub or an empty file, not a demo. */
export const MIN_TRACK_BYTES = 1024;
/** What the bucket stores. Browsers report .mp3 as either of these two. */
export const STORED_MIME = "audio/mpeg";
const ACCEPTED_CLIENT_MIME = new Set(["audio/mpeg", "audio/mp3", ""]);

/** How long the browser has to finish uploading before the claim goes stale. */
const CLAIM_TTL_MS = 60 * 60 * 1_000;
/** Long enough that a link in the notification email still works weeks later. */
export const DOWNLOAD_URL_TTL_SECONDS = 60 * 60 * 24 * 365;

export type TrackInput = { name: string; size: number; type: string };
export type UploadTarget = { path: string; uploadUrl: string };
export type PreparedUploads = { targets: UploadTarget[]; claim: string };
export type StoredTrack = { path: string; originalName: string; sizeBytes: number; url: string };

function bucket(): string {
  return process.env.INVITE_TRACKS_BUCKET || "invite-tracks";
}

/** Null when storage is unconfigured, so callers fail closed with a clear message. */
function storage(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

function authHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}` };
}

/**
 * Validate what the browser *claims* about the files before minting any upload
 * URL. This is advisory — the browser could lie — which is why `statObject`
 * re-checks the real object after upload and the bucket enforces its own limits.
 */
export function validateTrackInputs(files: unknown): { ok: true; files: TrackInput[] } | { ok: false; error: string } {
  if (!Array.isArray(files)) return { ok: false, error: "Attach your 3 best solo beats." };
  if (files.length !== TRACK_COUNT) {
    return { ok: false, error: `Attach exactly ${TRACK_COUNT} beats. You attached ${files.length}.` };
  }

  const out: TrackInput[] = [];
  for (const raw of files) {
    if (typeof raw !== "object" || raw === null) return { ok: false, error: "That file list is not valid." };
    const { name, size, type } = raw as Record<string, unknown>;
    if (typeof name !== "string" || typeof size !== "number" || typeof type !== "string") {
      return { ok: false, error: "That file list is not valid." };
    }
    if (!name.toLowerCase().endsWith(".mp3") || !ACCEPTED_CLIENT_MIME.has(type)) {
      return { ok: false, error: `"${name.slice(0, 60)}" is not an mp3. Export as mp3 and try again.` };
    }
    if (!Number.isFinite(size) || size < MIN_TRACK_BYTES) {
      return { ok: false, error: `"${name.slice(0, 60)}" looks empty.` };
    }
    if (size > MAX_TRACK_BYTES) {
      return { ok: false, error: `"${name.slice(0, 60)}" is over ${MAX_TRACK_BYTES / 1024 / 1024} MB.` };
    }
    out.push({ name, size, type });
  }
  return { ok: true, files: out };
}

function claimSecret(): string | null {
  const secret = process.env.PAYLOAD_SECRET;
  // Fail closed even though requirePayloadSecret() guards the same var: its
  // build/codegen carve-out can hand Payload "", and a claim signed with an
  // empty key would be forgeable.
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

/**
 * A claim binds the exact object paths this server issued to a short window.
 * Without it the submit step would accept any path a client typed, letting
 * someone attach another applicant's uploads to their own request.
 */
function makeClaim(paths: string[], secret: string): string {
  const exp = Date.now() + CLAIM_TTL_MS;
  return `${exp}.${sign(`${exp}.${paths.join("|")}`, secret)}`;
}

export function verifyClaim(claim: unknown, paths: string[]): boolean {
  const secret = claimSecret();
  if (!secret || typeof claim !== "string") return false;
  const [expRaw, sig] = claim.split(".");
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now() || !sig) return false;

  const expected = sign(`${exp}.${paths.join("|")}`, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Object paths are built here, never accepted from the client. */
function trackPath(folder: string, index: number): string {
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `requests/${month}/${folder}/${index + 1}.mp3`;
}

export async function prepareUploads(
  files: TrackInput[],
): Promise<{ ok: true; prepared: PreparedUploads } | { ok: false; error: string }> {
  const store = storage();
  const secret = claimSecret();
  if (!store || !secret) return { ok: false, error: "Uploads are temporarily unavailable." };

  const folder = randomUUID();
  const paths = files.map((_, i) => trackPath(folder, i));
  const targets: UploadTarget[] = [];

  for (const path of paths) {
    const res = await fetch(`${store.url}/storage/v1/object/upload/sign/${bucket()}/${path}`, {
      method: "POST",
      headers: { ...authHeaders(store.key), "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) {
      console.error("prepareUploads: sign failed", res.status);
      return { ok: false, error: "Uploads are temporarily unavailable." };
    }
    const { url } = (await res.json()) as { url?: string };
    if (!url) return { ok: false, error: "Uploads are temporarily unavailable." };
    targets.push({ path, uploadUrl: `${store.url}/storage/v1${url}` });
  }

  return { ok: true, prepared: { targets, claim: makeClaim(paths, secret) } };
}

/**
 * Confirm an object really landed, at a size and type we accept. This is what
 * stops a request claiming uploads that never happened, or a file swapped for
 * something else between signing and submitting.
 */
export async function statObject(
  path: string,
): Promise<{ ok: true; sizeBytes: number } | { ok: false; error: string }> {
  const store = storage();
  if (!store) return { ok: false, error: "Uploads are temporarily unavailable." };

  const res = await fetch(`${store.url}/storage/v1/object/info/authenticated/${bucket()}/${path}`, {
    headers: authHeaders(store.key),
  });
  if (!res.ok) return { ok: false, error: "One of your beats did not finish uploading." };

  const info = (await res.json()) as { size?: number; content_type?: string };
  const size = typeof info.size === "number" ? info.size : -1;
  if (info.content_type !== STORED_MIME) return { ok: false, error: "Only mp3 files are accepted." };
  if (size < MIN_TRACK_BYTES || size > MAX_TRACK_BYTES) {
    return { ok: false, error: "One of your beats is the wrong size." };
  }
  return { ok: true, sizeBytes: size };
}

/** Signed read link for the notification email and the admin row. */
export async function signDownloadUrl(path: string, expiresIn = DOWNLOAD_URL_TTL_SECONDS): Promise<string | null> {
  const store = storage();
  if (!store) return null;

  const res = await fetch(`${store.url}/storage/v1/object/sign/${bucket()}/${path}`, {
    method: "POST",
    headers: { ...authHeaders(store.key), "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn }),
  });
  if (!res.ok) return null;

  const { signedURL } = (await res.json()) as { signedURL?: string };
  return signedURL ? `${store.url}/storage/v1${signedURL}` : null;
}

/**
 * How many objects may be created bucket-wide in an hour. The per-IP limit
 * counts *request rows*, so it cannot see someone who mints upload URLs and
 * never submits: their row count stays zero forever. This is the backstop, and
 * being global it also holds against a flood spread across many IPs.
 *
 * 60 = twenty complete applications an hour, far above anything real.
 */
const MAX_UPLOADS_PER_HOUR = 60;

/** Counts objects created in the last hour, newest month first. Cheap in
    practice: retention keeps the bucket small and applications are rare. */
export async function recentUploadCount(): Promise<number> {
  const store = storage();
  if (!store) return 0;

  const now = new Date();
  const months = [
    `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`,
    // An upload just after midnight on the 1st still has to see yesterday.
    `${new Date(now.getTime() - 86_400_000).getUTCFullYear()}-${String(
      new Date(now.getTime() - 86_400_000).getUTCMonth() + 1,
    ).padStart(2, "0")}`,
  ];

  const since = Date.now() - 60 * 60 * 1_000;
  let count = 0;

  for (const month of new Set(months)) {
    // One level down from requests/<month> is a folder per submission; listing
    // with that prefix returns every object beneath it.
    const res = await fetch(`${store.url}/storage/v1/object/list/${bucket()}`, {
      method: "POST",
      headers: { ...authHeaders(store.key), "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: `requests/${month}`, limit: 1000 }),
    });
    if (!res.ok) continue;

    const rows = (await res.json()) as { created_at?: string; id?: string | null }[];
    for (const row of rows) {
      // Folders come back with a null id and no useful timestamp; recurse once.
      if (row.id === null) {
        const sub = await fetch(`${store.url}/storage/v1/object/list/${bucket()}`, {
          method: "POST",
          headers: { ...authHeaders(store.key), "Content-Type": "application/json" },
          body: JSON.stringify({ prefix: `requests/${month}/${(row as { name?: string }).name}`, limit: 1000 }),
        });
        if (!sub.ok) continue;
        for (const o of (await sub.json()) as { created_at?: string }[]) {
          if (o.created_at && new Date(o.created_at).getTime() >= since) count += 1;
        }
      } else if (row.created_at && new Date(row.created_at).getTime() >= since) {
        count += 1;
      }
    }
  }
  return count;
}

/** True when the bucket has taken too many objects in the last hour. */
export async function uploadsAreFlooded(): Promise<boolean> {
  return (await recentUploadCount()) >= MAX_UPLOADS_PER_HOUR;
}

/** Used by the cleanup path and by scripts/purge-invite-tracks.mjs. */
export async function deleteObjects(paths: string[]): Promise<boolean> {
  const store = storage();
  if (!store || paths.length === 0) return false;

  const res = await fetch(`${store.url}/storage/v1/object/${bucket()}`, {
    method: "DELETE",
    headers: { ...authHeaders(store.key), "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: paths }),
  });
  return res.ok;
}
