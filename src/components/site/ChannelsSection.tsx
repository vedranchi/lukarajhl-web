import { Reveal } from "./Reveal";
import { SocialIcon } from "./icons";
import { socials, youtubeChannels } from "@/data/content";
import { fetchLatestVideos } from "@/lib/youtube";

/** Three recent uploads per plate. One video is a link; three shows what the
    channel actually posts and that it is still running. The hero already
    features the newest tutorial, so the plates deliberately show a list rather
    than a second large thumbnail of the same video. */
const PER_CHANNEL = 3;

/**
 * Prominent band, a step below the Private Telegram panel in the page's
 * hierarchy: its own full-bleed plate, left-aligned on a flat surface, where
 * that panel is centred on a lit one. Ranking stays Telegram > Channels >
 * Beats.
 *
 * The section's subject is the two YouTube channels, so they take the weight:
 * one plate each, carrying that channel's real uploads straight from its feed.
 * Store, Instagram and Telegram drop to a hairline row underneath, which is
 * what makes this a hierarchy rather than five equal cards.
 *
 * A plate whose feed failed still renders its name, blurb and subscribe button,
 * so a YouTube outage costs the upload list and nothing else.
 */
export async function ChannelsSection() {
  const feeds = await Promise.all(
    youtubeChannels.map((channel) => fetchLatestVideos(channel.channelId, PER_CHANNEL)),
  );

  return (
    <section className="band" id="channels">
      <div className="shell">
        <Reveal>
          <div className="sec-head">
            <h2 className="sec-title">Channels</h2>
          </div>
        </Reveal>

        <div className="chans">
          {youtubeChannels.map((channel, i) => {
            const videos = feeds[i];
            return (
              <Reveal key={channel.key} delay={i * 90} className="chan-slot">
                <article className="chan">
                  <header className="chan-head">
                    <h3 className="chan-name">{channel.name}</h3>
                    <p className="chan-handle">
                      <span className="chan-mark" aria-hidden="true">
                        <SocialIcon kind="youtube" />
                      </span>
                      {channel.handle}
                    </p>
                  </header>

                  <p className="chan-blurb">{channel.blurb}</p>

                  {videos.length > 0 ? (
                    <ul className="chan-vids">
                      {videos.map((video) => (
                        <li key={video.id}>
                          <a className="chan-vid" href={video.url} target="_blank" rel="noopener noreferrer">
                            <span className="chan-vid-art">
                              {/* Plain <img>, not next/image: the optimizer would
                                  refetch a third-party asset server-side. Same
                                  call as the kit artwork and the hero video. */}
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={video.thumbnail}
                                alt={`${video.title} video thumbnail`}
                                width={480}
                                height={360}
                                loading="lazy"
                                decoding="async"
                              />
                            </span>
                            <span className="chan-vid-text">
                              <span className="chan-vid-title">{video.title}</span>
                              {/* Date only. The client asked for view counts
                                  off the site, so nothing renders them and
                                  lib/youtube no longer fetches them. */}
                              <span className="chan-vid-meta">
                                {video.publishedLabel ? (
                                  <time dateTime={video.publishedAt ?? undefined}>
                                    {video.publishedLabel}
                                  </time>
                                ) : null}
                              </span>
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="chan-foot">
                    <a
                      className="btn primary"
                      href={channel.subscribeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Subscribe
                    </a>
                    <a
                      className="quietlink"
                      href={channel.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      All videos ↗
                    </a>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={220}>
          {/* No heading above this row on purpose: the hairline and the drop in
              weight already say "everything else", and the page does not need
              another small uppercase label. */}
          <ul className="elsewhere" aria-label="More places to find Luka Rajhl">
            {socials.map((s) => (
              <li key={s.handle}>
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  <span className="elsewhere-ico">
                    <SocialIcon kind={s.icon} />
                  </span>
                  <span className="elsewhere-text">
                    <span className="elsewhere-name">{s.name}</span>
                    <span className="elsewhere-sub">{s.sub}</span>
                  </span>
                  <span className="elsewhere-arr" aria-hidden="true">
                    ↗
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
