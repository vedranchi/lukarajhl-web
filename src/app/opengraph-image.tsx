import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { leasesFrom, siteTagline } from "@/data/content";

/**
 * The link-preview card (Instagram DMs, WhatsApp, iMessage, X). Rendered once at
 * build time — it reads no request data — and served as a static PNG.
 *
 * Colours are literal hex because Satori cannot read the CSS custom properties
 * in globals.css. They are copies of those tokens (--bg, --surface-2, --ink,
 * --muted, --accent, --accent-deep, --magenta); change them there first, then
 * here. The amber is the LED-readout use DS2 allows, brightened for a dark
 * display rather than the page's light plates.
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

const C = {
  bg: "#CBC6DA",
  bg2: "#D6D2E3",
  surface: "#E7E4F0",
  surface2: "#F2F0F8",
  ink: "#17151E",
  muted: "#453F58",
  accent: "#5F5397",
  accentDeep: "#3A3163",
  magenta: "#7E4E8C",
  led: "#F2B84B",
  hair: "rgba(24, 19, 46, 0.26)",
};

export default async function OpengraphImage() {
  const [display, mono] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/VT323-Regular.ttf")),
    readFile(join(process.cwd(), "assets/fonts/IBMPlexMono-SemiBold.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `radial-gradient(70% 60% at 78% 8%, rgba(139, 124, 200, 0.45), transparent 70%), linear-gradient(160deg, ${C.bg2}, ${C.bg} 60%, #BDB6D1)`,
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
              color: "#F1EFF7",
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
