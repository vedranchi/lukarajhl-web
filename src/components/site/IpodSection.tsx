"use client";

import { useEffect, useState } from "react";
import { Reveal } from "./Reveal";
import { BeatStarsIcon } from "./icons";
import { useSeekBar } from "./useSeekBar";
import { beatstarsStore, playlist } from "@/data/content";

/**
 * Classic-iPod player for the Top 10. It owns no audio: the controls dispatch
 * the same `lr:toggle-play` / `lr:play-track` events the beats list already
 * uses, and the screen mirrors `lr:track-changed` + `lr:progress` coming back
 * from PlayerDock, which holds the page's single <audio> element.
 *
 * Track order is the baked BeatStars ranking (plays desc) from `playlist`.
 */

/** "3:02" / "03:02" -> seconds. Returns 0 for anything unparseable. */
function toSeconds(t: string): number {
  const parts = t.split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

function fmt(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function IpodSection() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState("0:00");
  const [total, setTotal] = useState(playlist[0]?.total ?? "0:00");
  // Track which index failed rather than resetting a flag in an effect, so a
  // new track retries its artwork without a cascading render.
  const [artFailedAt, setArtFailedAt] = useState<number | null>(null);
  const seek = useSeekBar(progress);

  useEffect(() => {
    const onTrack = (e: Event) => {
      const d = (e as CustomEvent<{ index: number; playing: boolean }>).detail;
      if (!d) return;
      setIndex(d.index);
      setPlaying(d.playing);
    };
    const onProgress = (e: Event) => {
      const d = (e as CustomEvent<{ progress: number; elapsed: string; total: string }>).detail;
      if (!d) return;
      setProgress(d.progress);
      setElapsed(d.elapsed);
      setTotal(d.total);
    };
    window.addEventListener("lr:track-changed", onTrack);
    window.addEventListener("lr:progress", onProgress);
    return () => {
      window.removeEventListener("lr:track-changed", onTrack);
      window.removeEventListener("lr:progress", onProgress);
    };
  }, []);

  const artFailed = artFailedAt === index;
  const track = playlist[index] ?? playlist[0] ?? null;
  const count = playlist.length;

  const toggle = () => window.dispatchEvent(new CustomEvent("lr:toggle-play"));
  const go = (next: number) => {
    if (count === 0) return;
    const i = ((next % count) + count) % count; // wraps both directions
    window.dispatchEvent(new CustomEvent("lr:play-track", { detail: { index: i } }));
  };

  const remaining = Math.max(0, toSeconds(total) - toSeconds(elapsed));

  if (!track) return null;

  return (
    <section className="podwrap" id="top10">
      <div className="shell pod-grid">
        <Reveal className="pod-head-wrap">
          <div className="sec-head pod-head">
            <h2 className="sec-title pod-title">Most popular beats</h2>
            <p className="sec-note pod-note">My top 10 beats, ranked by BeatStars.</p>
          </div>
        </Reveal>

        <Reveal delay={120} className="pod-stage">
          <div>
            <div className="pod" role="group" aria-label="Top 10 beats player">
              <div className="pod-screen">
                <div className="pod-bar">
                  <span>Now Playing</span>
                  <span className="pod-bar-right" aria-hidden="true">
                    <i className={`pod-state ${playing ? "is-play" : ""}`} />
                    <i className="pod-batt" />
                  </span>
                </div>

                <div className="pod-body">
                  <div className="pod-art">
                    {track.image && !artFailed ? (
                      // Plain <img>: the optimizer would refetch this from
                      // BeatStars server-side (CLAUDE.md P2).
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={track.image}
                        alt={`${track.title} cover art`}
                        width={200}
                        height={200}
                        loading="lazy"
                        decoding="async"
                        onError={() => setArtFailedAt(index)}
                      />
                    ) : (
                      <span className="pod-art-fallback" aria-hidden="true">
                        <BeatStarsIcon />
                      </span>
                    )}
                  </div>
                  <div className="pod-meta">
                    {/* Name first, tags as the "artist" line: a 2-line clamp on
                        the full title cut most names off on a phone. */}
                    <p className="pod-track" title={track.title}>
                      {track.name}
                    </p>
                    <p className="pod-artist" title={track.tags ?? undefined}>
                      {track.tags ?? track.artist}
                    </p>
                    <p className="pod-album">
                      {track.plays.toLocaleString()} plays
                    </p>
                  </div>
                </div>

                <div className="pod-scrub">
                  <span className="pod-t">{elapsed}</span>
                  <span className="pod-track-bar" {...seek}>
                    <i style={{ width: `${Math.min(100, progress * 100)}%` }} />
                  </span>
                  <span className="pod-t pod-t-rem">-{fmt(remaining)}</span>
                </div>

                {/* Announce track changes once, not on every progress tick. */}
                <p className="visually-hidden" role="status">
                  {`${index + 1} of ${count}. ${track.title}. ${playing ? "Playing" : "Paused"}.`}
                </p>
              </div>

              <div className="pod-wheel">
                <button type="button" className="pod-btn pod-menu" onClick={() => go(0)}>
                  MENU
                </button>
                <button
                  type="button"
                  className="pod-btn pod-prev"
                  onClick={() => go(index - 1)}
                  aria-label="Previous beat"
                >
                  <span aria-hidden="true">◀◀</span>
                </button>
                <button
                  type="button"
                  className="pod-btn pod-next"
                  onClick={() => go(index + 1)}
                  aria-label="Next beat"
                >
                  <span aria-hidden="true">▶▶</span>
                </button>
                <button
                  type="button"
                  className="pod-btn pod-playpause"
                  onClick={toggle}
                  aria-label={playing ? "Pause" : "Play"}
                >
                  <span aria-hidden="true">▶❙❙</span>
                </button>
                <button
                  type="button"
                  className="pod-centre"
                  onClick={toggle}
                  aria-label={playing ? "Pause" : "Play"}
                />
              </div>

              {/* License for the track on screen. Etched into the body below the
                  wheel, the way a model number sits on the real device. */}
              <p className="pod-license">
                <span className="pod-license-k">License</span>
                <a href={track.buyUrl} target="_blank" rel="noopener noreferrer">
                  {track.license.label}
                </a>
              </p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={200} className="pod-list-wrap">
          <ol className="pod-list">
            {playlist.map((t, i) => {
              const current = i === index;
              return (
                <li key={t.title}>
                  <button
                    type="button"
                    className={`pod-row${current ? " is-current" : ""}`}
                    onClick={() => (current ? toggle() : go(i))}
                    aria-current={current || undefined}
                    aria-label={current && playing ? `Pause ${t.title}` : `Play ${t.title}`}
                  >
                    <span className="pod-row-n">
                      {current && playing ? "❙❙" : String(i + 1).padStart(2, "0")}
                    </span>
                    {/* Nearly every title opens "fakemink + … type beat", so a
                        one-line title truncated to ten identical rows on a
                        phone. The quoted name leads; the tags trail it on
                        desktop and drop to a second line on mobile. */}
                    <span className="pod-row-title" title={t.title}>
                      <span className="pod-row-name">{t.name}</span>
                      {t.tags ? <span className="pod-row-tags">{t.tags}</span> : null}
                    </span>
                    <span className="pod-row-plays">{t.plays.toLocaleString()}</span>
                    <span className="pod-row-time">{t.total}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="pod-foot">
            <p className="pod-foot-note">
              Checkout and licensing are handled on BeatStars.
            </p>
            <a className="btn" href={beatstarsStore} target="_blank" rel="noopener noreferrer">
              Browse all beats ↗
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
