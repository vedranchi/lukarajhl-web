import { Reveal } from "./Reveal";
import { ScrollLink } from "./ScrollLink";
import { HeroVideo } from "./HeroVideo";
import { beatstarsStore, featuredKit, youtubeTutorialsChannelId } from "@/data/content";
import { fetchLatestVideo } from "@/lib/youtube";

export async function Hero() {
  // Live from the tutorials channel's feed, revalidated hourly. Null on any
  // failure, which is why the featured kit stays as the fallback below.
  const video = await fetchLatestVideo(youtubeTutorialsChannelId);

  return (
    <header className="hero shell">
      <div className="hero-lede">
        <Reveal>
          <h1 className="hero-name">LUKA RAJHL</h1>
        </Reveal>

        {/* One primary action. The store lives in the beat-store card further down,
            so it isn't repeated here as a competing CTA. */}
        <Reveal delay={220}>
          <div className="hero-cta">
            <ScrollLink className="btn primary" targetId="top10">
              Hear the beats
            </ScrollLink>
            <a className="quietlink" href={beatstarsStore} target="_blank" rel="noopener noreferrer">
              Open the store ↗
            </a>
          </div>
        </Reveal>
      </div>

      {/* Right column: the newest tutorial, falling back to the featured kit if
          YouTube is unreachable so the column is never empty. */}
      {video ? (
        <Reveal delay={320} className="hero-feature">
          <HeroVideo video={video} />
        </Reveal>
      ) : featuredKit ? (
        <Reveal delay={320} className="hero-feature">
          <a
            className="hero-kit"
            href={featuredKit.buyUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {featuredKit.image ? (
              // Plain <img>, not next/image: the optimizer would refetch the asset
              // from BeatStars server-side. See KitsSection for the same note (P2).
              // alt="": the link's own text already names it, so a descriptive alt is read twice.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="hero-kit-art"
                src={featuredKit.image}
                alt=""
                width={400}
                height={400}
                decoding="async"
              />
            ) : null}
            <span className="hero-kit-name">{featuredKit.file}</span>
            <span className="hero-kit-meta">{featuredKit.meta}</span>
            <span className="hero-kit-foot">
              <span className="hero-kit-price">{featuredKit.price}</span>
              <span className="hero-kit-go">Get the kit ↗</span>
            </span>
          </a>
        </Reveal>
      ) : null}
    </header>
  );
}
