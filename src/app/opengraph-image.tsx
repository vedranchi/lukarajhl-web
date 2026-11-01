import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { leasesFrom, siteTagline } from "@/data/content";
import { rootTokens, tokenReader } from "@/lib/css-tokens";

/**
 * The link-preview card (Instagram DMs, WhatsApp, iMessage, X). Rendered once at
 * build time — it reads no request data — and served as a static PNG.
 *
 * Satori can't resolve CSS custom properties, so the colours are read out of
 * globals.css's :root at build time (CLAUDE.md §10) — change them there. A
 * missing token fails the build. The amber is --amber-lit, the LED-readout use
 * DS2 allows on a dark plate. The rgba glow and shadow below are effect tints,
 * written inline the same way globals.css's own rules write them.
 *
 * Everything sits on the centre line because WhatsApp and some DM clients crop
 * the card to a square thumbnail; the name survives that crop.
 *
 * Fonts are the site's own two faces (VT323, IBM Plex Mono — both SIL OFL),
 * bundled in assets/fonts so the build never depends on a font CDN.
 */

export const alt = `Luka Rajhl. ${siteTagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const [display, mono, css] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/VT323-Regular.ttf")),
    readFile(join(process.cwd(), "assets/fonts/IBMPlexMono-SemiBold.ttf")),
    readFile(join(process.cwd(), "src/app/globals.css"), "utf8"),
  ]);

  const t = tokenReader(rootTokens(css));
  const C = {
    bg: t("bg"),
    bg2: t("bg-2"),
    bg3: t("bg-3"),
    surface: t("surface"),
    surface2: t("surface-2"),
    ink: t("ink"),
    muted: t("muted"),
    accent: t("accent"),
    accentDeep: t("accent-deep"),
    magenta: t("magenta"),
    led: t("amber-lit"),
    onAccent: t("on-accent"),
    hair: t("hair-2"),
  };

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `radial-gradient(70% 60% at 78% 8%, rgba(139, 124, 200, 0.45), transparent 70%), linear-gradient(160deg, ${C.bg2}, ${C.bg} 60%, ${C.bg3})`,
          fontFamily: "Plex Mono",
        }}
      >
        {/* The window: same beveled plate + violet title bar as the site chrome. */}
        <div
          style={{
            width: 1020,
            display: "flex",
            flexDirection: "column",
            borderRadius: 18,
            border: `2px solid ${C.hair}`,
            overflow: "hidden",
            boxShadow: "0 30px 70px -30px rgba(30, 24, 56, 0.65)",
            background: `linear-gradient(165deg, ${C.surface2}, ${C.surface})`,
          }}
        >
          <div
            style={{
              height: 58,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 26px",
              background: `linear-gradient(90deg, ${C.accentDeep}, ${C.accent} 62%, ${C.magenta})`,
              color: C.onAccent,
              fontSize: 22,
              letterSpacing: 4,
            }}
          >
            <span>LUKARAJHL.COM</span>
            <div style={{ display: "flex", gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    border: "2px solid rgba(241, 239, 247, 0.7)",
                  }}
                />
              ))}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "44px 40px 52px",
            }}
          >
            <div
              style={{
                fontFamily: "VT323",
                fontSize: 188,
                lineHeight: 0.9,
                color: C.ink,
                letterSpacing: -2,
              }}
            >
              LUKA RAJHL
            </div>
            <div
              style={{
                marginTop: 18,
                fontSize: 30,
                letterSpacing: 7,
                color: C.muted,
              }}
            >
              BEAT PRODUCER · SKOPJE
            </div>

            {leasesFrom ? (
              <div
                style={{
                  marginTop: 34,
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "10px 30px 12px",
                  borderRadius: 10,
                  background: C.ink,
                  border: `2px solid ${C.accentDeep}`,
                  color: C.led,
                  fontFamily: "VT323",
                  fontSize: 52,
                  lineHeight: 1,
                  letterSpacing: 2,
                }}
              >
                <div style={{ width: 14, height: 14, borderRadius: 7, background: C.led }} />
                {`LEASES FROM ${leasesFrom}`}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "VT323", data: display, weight: 400, style: "normal" },
        { name: "Plex Mono", data: mono, weight: 600, style: "normal" },
      ],
    },
  );
}
