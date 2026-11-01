/**
 * Small env helpers. Kept framework-free so they can be unit-tested standalone.
 */

/**
 * Parse an integer env var, honoring an explicit `0`. Falls back to `fallback`
 * only when the var is unset/blank or not a finite number — unlike
 * `Number(env) || fallback`, which silently coerces a deliberate `0` back to the
 * default.
 */
export function envInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Just the shape these helpers read. Deliberately not `NodeJS.ProcessEnv`: Next
 * augments that to require `NODE_ENV`, which would force every test to pass a
 * key none of this logic looks at.
 */
type EnvLike = Readonly<Record<string, string | undefined>>;

/**
 * True when this process is serving a deployment that is reachable only over
 * HTTPS, which is what decides whether auth cookies may carry `Secure`.
 *
 * Keyed on `VERCEL_ENV` rather than `NODE_ENV` on purpose. Every Vercel
 * deployment — production and preview alike — is HTTPS-only, while `NODE_ENV`
 * is also `production` for a local `pnpm build && pnpm start` (§5), which serves
 * plain http://localhost. Gating on `NODE_ENV` would mark the cookie `Secure`
 * there, the browser would drop it, and admin login would break locally for no
 * security gain. `vercel dev` sets `VERCEL_ENV=development` and is likewise
 * excluded.
 */
export function servedOverHttps(env: EnvLike = process.env): boolean {
  return env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview";
}

/** Shortest PAYLOAD_SECRET we accept — for admin sessions and upload claims alike. */
export const MIN_SECRET_LENGTH = 16;

/**
 * Payload signs admin session tokens with this. The config used to fall back to
 * `""` for a missing var, so a deploy that lost the secret would boot happily
 * and sign every session with the empty string — forgeable by anyone who
 * guessed, and the admin panel is the only thing standing in front of the
 * applicants' personal data (CLAUDE.md DB5). Fail closed instead.
 *
 * `exempt` covers the two cases that import the config but never sign anything:
 *  - `next build`, which collects routes. A build with no runtime secret should
 *    still produce an artifact; the guard fires on the first real request.
 *  - Payload's code generators (`generate:types`, `generate:importmap`,
 *    `generate:db-schema`), which DoD2 and DB7 require on any machine, including
 *    a clean clone or CI with no secret. See isPayloadCodegen().
 */
export function requirePayloadSecret(
  env: EnvLike = process.env,
  exempt = env.NEXT_PHASE === "phase-production-build" || isPayloadCodegen(),
): string {
  const secret = env.PAYLOAD_SECRET;
  if (secret && secret.length >= MIN_SECRET_LENGTH) return secret;
  if (exempt) return secret ?? "";
  throw new Error(
    `PAYLOAD_SECRET is missing or shorter than ${MIN_SECRET_LENGTH} characters. ` +
      "Set it before starting the server — an empty secret makes admin sessions forgeable.",
  );
}

/**
 * True when this process is the Payload CLI running a `generate:*` command.
 * Those only read the config to emit files (generate:db-schema even sets
 * `disableDBConnect`), so they have no use for the secret. Keyed on argv
 * because the CLI sets no env var of its own for them; `next start` and the
 * migrate/run commands never match, so the guard still applies everywhere a
 * session or a database write can happen.
 */
export function isPayloadCodegen(argv: readonly string[] = process.argv): boolean {
  return argv.slice(2).some((arg) => arg.startsWith("generate:"));
}
