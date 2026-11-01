/**
 * Site content for the Luka Rajhl retro landing.
 *
 * Beats & kits are a real BeatStars snapshot: `src/data/beatstars-catalogue.json`
 * (regenerate with `node scripts/fetch-beatstars.mjs`; auto-refreshed on a schedule
 * by .github/workflows/refresh-catalogue.yml). Everything else is authored here
 * until it moves to Payload CMS.
 */
import catalogue from "./beatstars-catalogue.json";
import { lowestLeasePrice, splitBeatTitle } from "@/lib/catalogue";

export type Beat = {
  n: string;
  title: string;
  time: string;
  plays: number;
  /** BeatStars cover art (400px webp), or null when the beat has none. */
  image: string | null;
  /** Derived from BeatStars price + free/exclusive flags. See the fetch script. */
  license: { label: string; price: string | null };
  buyUrl: string;
  stream: string;
  playing?: boolean;
};

export type Kit = {
  file: string;
  meta: string;
  price: string;
  /** BeatStars CDN artwork (400px webp), or null when the kit has none. */
  image: string | null;
  buyUrl: string;
};

export type SocialKind = "youtube" | "instagram" | "telegram" | "beatstars";

export type Social = {
  /** What the destination is *for*, not which platform it is — the two YouTube
      channels are told apart here, and the icon carries the platform. */
  name: string;
  sub: string;
  handle: string;
  url: string;
  icon: SocialKind;
};
/** BeatStars store root + private Telegram group. */
export const beatstarsStore = catalogue.store;

/** Canonical production origin. Absolute URLs in metadata (og:image, sitemap,
    canonical) resolve against it, so preview deployments still point shared
    links at the real site. */
export const siteUrl = "https://lukarajhl.com";
export const siteName = "Luka Rajhl";

/** Snapshot timestamp of the baked catalogue — the page's real "last changed". */
export const catalogueGeneratedAt = catalogue._generatedAt;
/** The two YouTube channels, which serve different purposes: the tutorials
    channel ("Luka Rajhl") publishes production breakdowns and how-tos; the
    type-beat channel ("lukarajhl", @rajhlski) publishes free type beats.
    Verified against both channels' upload feeds, so don't swap them.

    Both are keyed by channel ID because that is the only form the Atom feed
    accepts (`/feeds/videos.xml?channel_id=`), and it survives a vanity-handle
    change. The tutorials channel keeps its @handle URL for humans, since that
    is the link the client shares. */
export const youtubeTutorialsChannelId = "UCMcvYZ58vysUkGQbBfalkxQ";
export const youtubeTypeBeatsChannelId = "UCU6-wec8KCUzF-qfDaq37oA";
export const youtubeTutorials = "https://www.youtube.com/@lukarajhl";
export const youtubeTypeBeats = `https://www.youtube.com/channel/${youtubeTypeBeatsChannelId}`;

export type YoutubeChannel = {
  /** React key and CSS hook. */
  key: string;
  /** What the channel is for. It is the card's title: the platform is obvious
      from the icon, the purpose is not. */
  name: string;
  /** What a visitor gets if they subscribe. One sentence. */
  blurb: string;
  handle: string;
  channelId: string;
  url: string;
  /** `?sub_confirmation=1` opens YouTube with the subscribe prompt already up. */
  subscribeUrl: string;
};

export const youtubeChannels: YoutubeChannel[] = [
  {
    key: "tutorials",
    name: "Tutorials",
    blurb: "How I make the beats, song breakdowns and producer tips",
    handle: "@lukarajhl",
    channelId: youtubeTutorialsChannelId,
    url: youtubeTutorials,
    subscribeUrl: `${youtubeTutorials}?sub_confirmation=1`,
  },
  {
    key: "type-beats",
    name: "Type Beats",
    blurb: "All my beats in one place. Upload every other day.",
    handle: "@rajhlski",
    channelId: youtubeTypeBeatsChannelId,
    url: youtubeTypeBeats,
    subscribeUrl: `${youtubeTypeBeats}?sub_confirmation=1`,
  },
];

/** Two different rooms, and they must not be confused. `telegramPublic` is the
    open "lukarajhl vault" channel anyone can join, and it is the one the
    Channels strip links to. `telegramInvite` is the private group's invite
    link: it is what applicants are given once Luka has approved them, so it
    must never be printed on a public page. */
export const telegramPublic = "https://t.me/lukarajhl";
export const telegramInvite = "https://t.me/+nfPjj9ktvsYwMWVk";

/** Real BeatStars catalogue (top-10 snapshot — see scripts/fetch-beatstars.mjs). */
export const beats: Beat[] = catalogue.beats;

/** Cheapest lease on the front page ("$29.99"), or null if none is priced.
    Derived, so the meta description and the share card follow a price change on the
    next catalogue refresh instead of going stale. */
export const leasesFrom = lowestLeasePrice(beats);

/** Who this is and what it costs, in one line. Used by the share card's alt
    text only; the homepage deliberately shows no tagline under the name. */
export const siteTagline = leasesFrom
  ? `Beat producer from Skopje. Leases from ${leasesFrom}.`
  : "Beat producer from Skopje.";

/** Meta / Open Graph description: what a link preview says under the title. */
export const siteDescription =
  `Luka Rajhl, beat producer from Skopje. Hear his most popular beats` +
  (leasesFrom ? `, lease them on BeatStars from ${leasesFrom}` : ", license them on BeatStars") +
  ", and get the sound kits he makes them with.";

/**
 * Client-authored kit descriptions, matched on the kit title. BeatStars' own
 * blurbs are marketing prose that the fetch script has to truncate; these say
 * what is actually in the box. They live here, not in
 * `beatstars-catalogue.json`, because the scheduled refresh rewrites that file
 * (CLAUDE.md P3/G6). Kits with no entry keep their BeatStars blurb.
 */
const kitDescriptions: { match: string; meta: string }[] = [
  { match: "EXIMIA", meta: "100 vocal chops" },
  { match: "SEPIA", meta: "70 VOCAL CHOPS, 30 ONE SHOTS, 70 drum sounds" },
  {
    match: "BUNDLE",
    meta:
      "300+ SOUNDS INCLUDING 190 DRUM SOUNDS, 20 FREE LOOPS, 35 VOCAL CHOPS, " +
      "10 STARTERS, 35 ONE SHOTS AND 3 MIXER TRACKS",
  },
  // Must stay after BUNDLE: the bundle's title also contains "LUKARAJHL STASH
  // KIT", and the first match in this list wins.
  { match: "LUKARAJHL STASH", meta: "190 drum SOUNDS" },
];

export const kits: Kit[] = catalogue.kits.map((k) => {
  const override = kitDescriptions.find((d) => k.file.toUpperCase().includes(d.match));
  return override ? { ...k, meta: override.meta } : k;
});

/** Full store totals (the page shows the most-popular subset). */
export const catalogueTotals = catalogue.totals;
export const catalogueShown = catalogue.shown;
export const hasMoreBeats = catalogueTotals.beats > catalogueShown.beats;
export const hasMoreKits = catalogueTotals.kits > catalogueShown.kits;

/** The kit featured beside the Sound Kits list: the bundle, which is the most
    sounds for the money and the widest piece of artwork in the section. The
    rest of the kits fill the ruled list next to it. */
export const bundleKit: Kit | undefined =
  kits.find((k) => k.file.toUpperCase().includes("BUNDLE")) ?? kits[0];
export const listedKits: Kit[] = kits.filter((k) => k !== bundleKit);

/** Newest kit, featured beside the hero title. Matched by name so a catalogue
    refresh can't drop it; falls back to the first kit if it ever disappears. */
export const featuredKit: Kit | undefined =
  kits.find((k) => k.file.toUpperCase().includes("EXIMIA")) ?? kits[0];

/** Everywhere else, under the two channel plates. The YouTube channels are not
    in here: they are the section's subject, not one of its footnotes. */
export const socials: Social[] = [
  { name: "Beat Store", sub: "Leases and exclusives", handle: "beatstars.com/rajhl", url: beatstarsStore, icon: "beatstars" },
  { name: "Instagram", sub: "lyfe", handle: "@luka.rajhl", url: "https://www.instagram.com/luka.rajhl/", icon: "instagram" },
  { name: "Telegram", sub: "Free loops", handle: "@lukarajhl", url: telegramPublic, icon: "telegram" },
];

/** The four Channels-tab badges (subscribe / follow / join / store). */
export const channelBadges: { label: string; url: string }[] = [
  { label: "TUTORIALS ►", url: `${youtubeTutorials}?sub_confirmation=1` },
  { label: "TYPE BEATS ►", url: `${youtubeTypeBeats}?sub_confirmation=1` },
  { label: "FOLLOW ★", url: "https://www.instagram.com/luka.rajhl/" },
  { label: "JOIN ✈", url: telegramPublic },
  { label: "BEATSTARS ♪", url: beatstarsStore },
];

/** Spotify playlist embedded next to the invite form (official embed iframe). */
export const spotifyPlaylist = {
  id: "7JRpQCqP4BIrO0Wk35MaMD",
  /** Spotify IFrame API addresses content by URI, not embed URL. */
  uri: "spotify:playlist:7JRpQCqP4BIrO0Wk35MaMD",
  embedUrl: "https://open.spotify.com/embed/playlist/7JRpQCqP4BIrO0Wk35MaMD?utm_source=generator&theme=0",
  openUrl: "https://open.spotify.com/playlist/7JRpQCqP4BIrO0Wk35MaMD",
};

export type PlaylistTrack = {
  /** Full BeatStars title — accessible names, tooltips, the desktop dock. */
  title: string;
  /** The quoted beat name, the line that tells beats apart. */
  name: string;
  /** The "type beat" tags in front of the name, or null. */
  tags: string | null;
  artist: string;
  src: string;
  total: string;
  plays: number;
  image: string | null;
  license: { label: string; price: string | null };
  buyUrl: string;
};

/**
 * Browser transport playlist — every beat shown on the front page (the top-10
 * snapshot), each streamed from BeatStars (a client-side preview, embed-like).
 * The Skip control shuffles across this list. Track 0 is the most-popular beat,
 * matching what the table shows as "now playing".
 */
export const playlist: PlaylistTrack[] = beats.map((b) => ({
  title: b.title,
  ...splitBeatTitle(b.title),
  artist: "Luka Rajhl",
  src: b.stream,
  total: b.time || "0:00",
  plays: b.plays,
  image: b.image,
  license: b.license,
  buyUrl: b.buyUrl,
}));

/**
 * Initial transport state. `fallbackSrc` is a self-contained retro loop used if
 * a stream fails to load, so the player always works.
 */
const top = catalogue.topBeat;
export const nowPlaying = {
  title: top?.title ?? "Retro Test Loop",
  artist: top?.artist ?? "Luka Rajhl",
  image: top?.image ?? null,
  src: top?.stream ?? "/audio/placeholder-loop.wav",
  fallbackSrc: "/audio/placeholder-loop.wav",
  total: top?.total || "0:15",
  buyUrl: top?.buyUrl ?? beatstarsStore,
};
