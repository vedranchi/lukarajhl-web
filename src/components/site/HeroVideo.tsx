import type { LatestVideo } from "@/lib/youtube";

/**
 * Newest tutorial, in the hero's right column. Same plate as the featured kit
 * it replaces (`.hero-kit`), so the hero composition is unchanged — only the
 * artwork's shape (16:9, cropped from YouTube's letterboxed hqdefault) and the
 * play badge say "this is a video". No label above it: the client had the
 * kit's label removed, and the badge plus "Watch on YouTube" already say it.
 */
export function HeroVideo({ video }: { video: LatestVideo }) {
  return (
    <a className="hero-kit hero-vid" href={video.url} target="_blank" rel="noopener noreferrer">
      <span className="hero-vid-art">
        {/* Plain <img>, not next/image: same reason as the kit artwork — the
            optimizer would refetch a third-party asset server-side. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="hero-kit-art hero-vid-thumb"
          src={video.thumbnail}
          alt={`${video.title} video thumbnail`}
          width={480}
          height={360}
          decoding="async"
        />
        <span className="hero-vid-play" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
        </span>
      </span>
      <span className="hero-kit-name">{video.title}</span>
      <span className="hero-kit-meta">
        Tutorials
        {video.publishedLabel ? (
          <>
            {" · "}
            <time dateTime={video.publishedAt ?? undefined}>{video.publishedLabel}</time>
          </>
        ) : null}
      </span>
      {/* No view count: the client asked for view counts off the site, so
          lib/youtube does not fetch one. */}
      <span className="hero-kit-foot">
        <span className="hero-kit-go">Watch on YouTube ↗</span>
      </span>
    </a>
  );
}
