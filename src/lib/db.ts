import { Pool } from "pg";

/**
 * Postgres access for the one thing that needs it: the invite form's
 * `invite_requests` rows (rate limiting, duplicate detection, the lead record).
 * Server-only — imported by the server action, never by a client component.
 */

type EnvLike = Readonly<Record<string, string | undefined>>;

/**
 * Connection string (CLAUDE.md DB4). Local dev sets DATABASE_URL by hand; on
 * Vercel the Supabase integration injects POSTGRES_URL instead (it never
 * creates DATABASE_URL), so fall back to it.
 *
 * The integration's URL carries `sslmode=require`, which recent node-postgres
 * coerces to `verify-full` and then rejects Supabase's self-signed chain — and
 * that URL param overrides the pool's explicit `ssl` option. Strip it so
 * `ssl: { rejectUnauthorized: false }` below governs (TLS stays on, only the
 * chain check is skipped). Don't "simplify" this.
 */
export function pgConnectionString(env: EnvLike = process.env): string {
  const raw = env.DATABASE_URL || env.POSTGRES_URL || "";
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("ssl");
    return url.toString();
  } catch {
    return raw;
  }
}

let pool: Pool | null = null;

/**
 * One small pool per warm function instance. Serverless instances are many and
 * short-lived and the Supabase pooler multiplexes behind them, so each holds
 * only a couple of connections and lets idle ones go quickly.
 *
 * Throws when no URL is configured rather than letting node-postgres fall back
 * to localhost — the caller turns that into a "try again later" for the visitor.
 */
export function getPool(): Pool {
  if (pool) return pool;
  const connectionString = pgConnectionString();
  if (!connectionString) throw new Error("DATABASE_URL / POSTGRES_URL is not configured");
  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  // An idle client dropped by the pooler emits on the pool; without a listener
  // that is an uncaught error that takes the whole instance down.
  pool.on("error", (err) => console.error("[db] idle client error:", err.message));
  return pool;
}
