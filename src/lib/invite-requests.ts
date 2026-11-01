import { randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { getPool } from "@/lib/db";
import { envInt } from "@/lib/env";
import { sendInviteEmail, type InviteEmailInput, type SendInviteEmailResult } from "@/lib/invite-email";
import { validateInvite } from "@/lib/validate-invite";
import type { StoredTrack } from "@/lib/track-uploads";

/**
 * Private Telegram applications: the lead record, duplicate detection and the
 * owner email.
 *
 * Rows live in `invite_requests` + `invite_requests_tracks`, the tables Payload
 * created when it hosted this form. Payload is gone; the tables stayed so the
 * lead history is in one place, and this module writes the same shape Payload
 * did (1-based `_order`, 24-hex track ids) so old and new rows read alike.
 * The server action is the only writer.
 */

export type InviteStatus = "new" | "emailed" | "email_failed" | "duplicate" | "spam";

export type InviteRow = {
  instagram: string;
  tracks: StoredTrack[];
  status: InviteStatus;
  source: string;
  ip: string | null;
  userAgent: string | null;
  elapsedMs: number | null;
};

/** The SQL surface, injectable so the workflow below unit-tests without a DB. */
export interface InviteStore {
  countByIpSince(ip: string, since: Date): Promise<number>;
  countByHandleSince(instagram: string, since: Date): Promise<number>;
  insert(row: InviteRow): Promise<{ id: number; createdAt: string }>;
  setEmailOutcome(
    id: number,
    outcome: { status: "emailed"; sentAt: string } | { status: "email_failed"; error: string },
  ): Promise<void>;
}

/** Same id shape Payload gave array rows, so old and new track rows match. */
const trackRowId = () => randomBytes(12).toString("hex");

/** Table names are deliberately unqualified (search_path → public). */
export function pgInviteStore(pool: () => Pool = getPool): InviteStore {
  return {
    async countByIpSince(ip, since) {
      const { rows } = await pool().query<{ n: number }>(
        "select count(*)::int as n from invite_requests where ip = $1 and created_at > $2",
        [ip, since.toISOString()],
      );
      return rows[0]?.n ?? 0;
    },

    async countByHandleSince(instagram, since) {
      const { rows } = await pool().query<{ n: number }>(
        "select count(*)::int as n from invite_requests where instagram = $1 and created_at > $2",
        [instagram, since.toISOString()],
      );
      return rows[0]?.n ?? 0;
    },

    // Row and tracks in one transaction: a lead never lands without its beats.
    async insert(row) {
      const client = await pool().connect();
      try {
        await client.query("begin");
        const { rows } = await client.query<{ id: number; created_at: Date }>(
          `insert into invite_requests (instagram, status, source, ip, user_agent, elapsed_ms)
           values ($1, $2::enum_invite_requests_status, $3, $4, $5, $6)
           returning id, created_at`,
          [row.instagram, row.status, row.source, row.ip, row.userAgent, row.elapsedMs],
        );
        const { id, created_at } = rows[0];
        for (const [i, t] of row.tracks.entries()) {
          await client.query(
            `insert into invite_requests_tracks (_order, _parent_id, id, path, original_name, size_bytes, url)
             values ($1, $2, $3, $4, $5, $6, $7)`,
            [i + 1, id, trackRowId(), t.path, t.originalName, t.sizeBytes, t.url || null],
          );
        }
        await client.query("commit");
        return { id, createdAt: new Date(created_at).toISOString() };
      } catch (err) {
        await client.query("rollback").catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },

    async setEmailOutcome(id, outcome) {
      await pool().query(
        `update invite_requests
           set status = $2::enum_invite_requests_status, email_sent_at = $3, email_error = $4, updated_at = now()
         where id = $1`,
        outcome.status === "emailed"
          ? [id, "emailed", outcome.sentAt, null]
          : [id, "email_failed", null, outcome.error.slice(0, 1000)],
      );
    },
  };
}

/** Match the action's cap so a stored user-agent can never balloon a row. */
const USER_AGENT_MAX = 500;

/** How far back a same-handle lead counts as a duplicate (default 24h, env-tunable). */
export function dedupeWindowMs(): number {
  return envInt(process.env.INVITE_DEDUPE_WINDOW_MS, 24 * 60 * 60 * 1_000);
}

export type InviteInput = {
  instagram: string;
  tracks: StoredTrack[];
  ip?: string;
  userAgent?: string;
  elapsedMs?: number;
  source?: string;
};

export type InviteDeps = {
  store: InviteStore;
  send: (doc: InviteEmailInput) => Promise<SendInviteEmailResult>;
};

/**
 * Store a lead, then notify the owner.
 *
 * 1. Re-validate and canonicalise the handle (defense in depth: the action
 *    already did, but this is the function that writes).
 * 2. A same-handle lead inside the dedupe window → stored as `duplicate`, and
 *    no second email: repeat interest stays visible, the inbox stays quiet.
 * 3. Insert. A failure here throws — the caller tells the visitor to retry.
 * 4. Send, then stamp `emailed` or `email_failed`. The lead is already stored,
 *    so neither a send failure nor a failed stamp may throw: an `email_failed`
 *    row is the record that someone applied and the email didn't arrive.
 */
export async function recordInviteRequest(
  input: InviteInput,
  deps: InviteDeps = { store: pgInviteStore(), send: sendInviteEmail },
): Promise<{ id: number; status: InviteStatus }> {
  const valid = validateInvite(input.instagram);
  if (!valid.ok) throw new Error(valid.error);
  const instagram = valid.instagram;

  const since = new Date(Date.now() - dedupeWindowMs());
  const prior = await deps.store.countByHandleSince(instagram, since);
  const status: InviteStatus = prior > 0 ? "duplicate" : "new";

  const { id, createdAt } = await deps.store.insert({
    instagram,
    tracks: input.tracks,
    status,
    source: input.source || "invite-form",
    ip: input.ip || null,
    userAgent: input.userAgent ? input.userAgent.slice(0, USER_AGENT_MAX) : null,
    elapsedMs: input.elapsedMs ?? null,
  });

  // One structured line per lead — no handle, no email body (CLAUDE.md DB5).
  console.info(
    JSON.stringify({ evt: "invite_request", id, status, ip: input.ip ?? null, elapsedMs: input.elapsedMs ?? null }),
  );

  if (status !== "new") return { id, status };

  const sent = await deps.send({ instagram, createdAt, tracks: input.tracks });
  const outcome = sent.ok
    ? ({ status: "emailed", sentAt: new Date().toISOString() } as const)
    : ({ status: "email_failed", error: sent.error } as const);
  if (!sent.ok) console.error(JSON.stringify({ evt: "invite_email_failed", id, error: sent.error }));

  try {
    await deps.store.setEmailOutcome(id, outcome);
  } catch (err) {
    console.error(JSON.stringify({ evt: "invite_status_update_failed", id, error: String(err) }));
  }
  return { id, status: outcome.status };
}
