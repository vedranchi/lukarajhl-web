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

/** Shortest secret we accept. Mirrors the floor in src/lib/track-uploads.ts. */
export const MIN_SECRET_LENGTH = 16;

/**
 * Payload signs admin session tokens with this. The config used to fall back to
 * `""` for a missing var, so a deploy that lost the secret would boot happily
 * and sign every session with the empty string — forgeable by anyone who
 * guessed, and the admin panel is the only thing standing in front of the
 * applicants' personal data (CLAUDE.md DB5). Fail closed instead.
 *
 * `isBuild` exempts `next build`: the config is imported to collect routes, and
 * a build that has no runtime secret should still produce an artifact rather
 * than hard-fail the pipeline. The guard still fires on the first real request.
 */
export function requirePayloadSecret(
  env: EnvLike = process.env,
  isBuild = env.NEXT_PHASE === "phase-production-build",
): string {
  const secret = env.PAYLOAD_SECRET;
  if (secret && secret.length >= MIN_SECRET_LENGTH) return secret;
  if (isBuild) return secret ?? "";
  throw new Error(
    `PAYLOAD_SECRET is missing or shorter than ${MIN_SECRET_LENGTH} characters. ` +
      "Set it before starting the server — an empty secret makes admin sessions forgeable.",
  );
}
