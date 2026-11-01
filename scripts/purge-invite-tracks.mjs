#!/usr/bin/env node
/**
 * Deletes applicant beats from the private Supabase bucket once they are older
 * than the retention window (90 days by default).
 *
 * Retention was agreed with the client: applications are reviewed within days,
 * so keeping strangers' audio indefinitely is storage nobody wants and personal
 * content nobody asked to keep. The same sweep also clears *orphans* — objects
 * uploaded by someone who never finished the form — because they age out on
 * exactly the same clock.
 *
 * Deleting the object does not delete the request row: the row keeps the
 * applicant's handle and the file names, and its signed links simply stop
 * resolving. That is deliberate, so the lead history stays intact.
 *
 *   node scripts/purge-invite-tracks.mjs --dry-run     # show what would go
 *   node scripts/purge-invite-tracks.mjs               # delete
 *   RETENTION_DAYS=30 node scripts/purge-invite-tracks.mjs
 *
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment
 * (`node --env-file=.env scripts/purge-invite-tracks.mjs`).
 */

const DRY_RUN = process.argv.includes("--dry-run");
const RETENTION_DAYS = Number(process.env.RETENTION_DAYS || 90);
const BUCKET = process.env.INVITE_TRACKS_BUCKET || "invite-tracks";
const ROOT = "requests";

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}
if (!Number.isFinite(RETENTION_DAYS) || RETENTION_DAYS < 1) {
  console.error(`RETENTION_DAYS must be a positive number, got ${process.env.RETENTION_DAYS}`);
  process.exit(1);
}

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

/** The list endpoint is per-prefix, not recursive: a folder comes back with a
    null id, so walk into anything that has one. It is also paged, so keep
    asking until a short page — otherwise anything past the first PAGE entries
    of a folder would never be listed and would outlive the retention window. */
const PAGE = 1000;
async function list(prefix) {
  const all = [];
  for (let offset = 0; ; offset += PAGE) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ prefix, limit: PAGE, offset, sortBy: { column: "name", order: "asc" } }),
    });
    if (!res.ok) throw new Error(`list ${prefix} failed: ${res.status} ${await res.text()}`);
    const page = await res.json();
    all.push(...page);
    if (page.length < PAGE) return all;
  }
}

async function walk(prefix, out = []) {
  for (const entry of await list(prefix)) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null) await walk(path, out);
    else out.push({ path, createdAt: entry.created_at, size: entry.metadata?.size ?? 0 });
  }
  return out;
}

const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
const objects = await walk(ROOT);
const stale = objects.filter((o) => new Date(o.createdAt).getTime() < cutoff);

console.log(`${objects.length} object(s) in ${BUCKET}/${ROOT}, ${stale.length} older than ${RETENTION_DAYS} days.`);
for (const o of stale) {
  console.log(`  ${DRY_RUN ? "would delete" : "delete"} ${o.path} (${(o.size / 1024 / 1024).toFixed(1)} MB, ${o.createdAt})`);
}

if (DRY_RUN || stale.length === 0) process.exit(0);

// Chunked: the delete endpoint takes a list, and a year of applications should
// not go out as one enormous request body.
for (let i = 0; i < stale.length; i += 100) {
  const batch = stale.slice(i, i + 100).map((o) => o.path);
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers,
    body: JSON.stringify({ prefixes: batch }),
  });
  if (!res.ok) {
    console.error(`delete batch failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
}
console.log(`Deleted ${stale.length} object(s).`);
