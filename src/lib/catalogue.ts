/**
 * Pure helpers over the baked BeatStars catalogue (no framework imports, so they
 * unit-test standalone).
 */

export type BeatTitleParts = {
  /** The beat's own name — the quoted part of a BeatStars title. */
  name: string;
  /** The "type beat" artist tags in front of it, or null when there are none. */
  tags: string | null;
};

/** Straight or curly double quotes. Single quotes are left alone on purpose:
    they show up as apostrophes inside names ("don't"). */
const QUOTED = /["“”]([^"“”]+)["“”]/g;
const EDGE_SEPARATORS = /^[\s\-–—|:·]+|[\s\-–—|:·]+$/g;

/**
 * BeatStars titles front-load SEO tags: `fakemink + feng type beat - "on the
 * line"`. Nearly every title starts the same way, so in a narrow column the
 * part that tells beats apart gets truncated away. This pulls the quoted name
 * out as the main line and leaves the tags as a secondary one.
 *
 * Falls back, in order, to the text after the last " - ", then to the whole
 * title as the name, so an oddly formatted title still renders in full.
 */
export function splitBeatTitle(title: string): BeatTitleParts {
  const raw = title.trim();

  const quoted = [...raw.matchAll(QUOTED)].at(-1);
  const quotedName = quoted?.[1].trim();
  if (quoted && quotedName) {
    const before = raw.slice(0, quoted.index);
    const after = raw.slice(quoted.index + quoted[0].length);
    const tags = `${before} ${after}`.replace(EDGE_SEPARATORS, "").replace(/\s+/g, " ").trim();
    return { name: quotedName, tags: tags || null };
  }

  const dash = raw.lastIndexOf(" - ");
  if (dash > 0) {
    const name = raw.slice(dash + 3).trim();
    const tags = raw.slice(0, dash).trim();
    if (name && tags) return { name, tags };
  }

  return { name: raw, tags: null };
}

/** "$29.99" → 29.99. Null for anything that isn't a positive amount. */
function amount(price: string | null | undefined): number | null {
  if (!price) return null;
  const n = Number(price.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * The cheapest paid lease among the given beats, as BeatStars formats it
 * ("$29.99"), or null when none has a price. Derived rather than hardcoded so
 * the hero line and the share card follow a price change on the next
 * catalogue refresh.
 */
export function lowestLeasePrice(
  beats: readonly { license: { price: string | null } }[],
): string | null {
  let best: { n: number; label: string } | null = null;
  for (const b of beats) {
    const n = amount(b.license.price);
    if (n !== null && (best === null || n < best.n)) best = { n, label: b.license.price! };
  }
  return best?.label ?? null;
}
