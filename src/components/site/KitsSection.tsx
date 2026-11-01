import { Reveal } from "./Reveal";
import { BeatStarsIcon } from "./icons";
import { bundleKit, listedKits, beatstarsStore, hasMoreKits } from "@/data/content";

/**
 * Ruled list, the same shape the Top 10 and the channel columns use: a row per
 * kit, a hairline between them, one white tint on hover. The artwork carries
 * the section, so it is the only thing on the row with any weight; the price
 * takes the amber readout the iPod's license line uses.
 *
 * This replaced a horizontal rail of gradient cards. The rail hid four of five
 * kits off the right edge and the cards fought the artwork they framed.
 *
 * The bundle sits beside the list at full size, the way the Top 10 puts the
 * device beside its rows: it is the most sounds for the money, and it gives
 * the section a piece of artwork big enough to anchor it.
 */
export function KitsSection() {
  return (
    <section className="section shell" id="kits">
      <Reveal>
        <div className="sec-head">
          <h2 className="sec-title">Sound Kits</h2>
          <p className="sec-note">All the sounds I use daily to create my beats</p>
        </div>
      </Reveal>

      <div className="kits-grid">
      <Reveal delay={100} className="kits-list-wrap">
        <ul className="kits">
          {listedKits.map((k) => (
            <li key={k.file}>
              <a className="kit-row" href={k.buyUrl} target="_blank" rel="noopener noreferrer">
                <span className="kit-art">
                  {k.image ? (
                    // Plain <img>, not next/image: the optimizer would refetch the
                    // asset from BeatStars server-side. Loading it directly keeps
                    // this as plain cross-origin media, like the audio stream (P2).
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={k.image} alt={`${k.file} cover art`} width={400} height={400} loading="lazy" decoding="async" />
                  ) : (
                    <BeatStarsIcon aria-hidden="true" />
                  )}
                </span>
                <span className="kit-text">
                  <h3 className="kit-name">{k.file}</h3>
                  <span className="kit-meta">{k.meta}</span>
                </span>
                <span className="kit-price">{k.price}</span>
              </a>
            </li>
          ))}
        </ul>
      </Reveal>

      {bundleKit ? (
        <Reveal delay={160} className="kit-feature-wrap">
          <article className="kit-feature">
            <a
              className="kit-feature-art"
              href={bundleKit.buyUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${bundleKit.file} on BeatStars`}
            >
              {bundleKit.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bundleKit.image} alt={`${bundleKit.file} cover art`} width={400} height={400} loading="lazy" decoding="async" />
              ) : (
                <BeatStarsIcon aria-hidden="true" />
              )}
            </a>
            <h3 className="kit-feature-name">{bundleKit.file}</h3>
            <p className="kit-feature-meta">{bundleKit.meta}</p>
            <div className="kit-feature-foot">
              <span className="kit-price">{bundleKit.price}</span>
              <a
                className="btn primary"
                href={bundleKit.buyUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Get the bundle
              </a>
            </div>
          </article>
        </Reveal>
      ) : null}
      </div>

      {hasMoreKits ? (
        <Reveal delay={140}>
          <div className="kits-foot">
            <a className="btn" href={beatstarsStore} target="_blank" rel="noopener noreferrer">
              Browse all kits ↗
            </a>
          </div>
        </Reveal>
      ) : null}
    </section>
  );
}
