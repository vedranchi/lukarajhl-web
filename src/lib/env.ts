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
