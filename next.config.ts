import type { NextConfig } from "next";

/**
 * Response headers for every route.
 *
 * Vercel adds only HSTS by default (`max-age=63072000`, on custom domains);
 * everything else here was missing, and nothing stopped the page from being framed.
 *
 * On the CSP being this narrow — it sets only the four directives that restrict
 * *navigation and embedding*, not resource loading. That is deliberate, not an
 * oversight:
 *
 *  - `media-src`/`img-src` would break the site. The beat player streams from
 *    `main.v2.beatstars.com`, which 302s to a freshly signed S3 URL on a host we
 *    cannot predict or pin (CLAUDE.md P2). CSP re-checks each hop of a redirect
 *    chain, so any media allowlist would kill playback — the site's core feature
 *    — the first time BeatStars changed buckets.
 *  - `script-src` worth having means nonces, and nonces mean middleware on every
 *    request, which would opt the homepage out of the static prerender it is
 *    built around (README: statically rendered, revalidated hourly). The XSS
 *    surface it would buy back is close to nil: there is no
 *    `dangerouslySetInnerHTML` anywhere, and no user-generated content is ever
 *    rendered — applications go to the database and the owner's inbox only.
 *
 * What is here costs nothing and closes real holes. Revisit `script-src` if the
 * page ever renders untrusted content.
 */
const securityHeaders = [
  // Same value Vercel already sends on the custom domain, stated here so it no
  // longer depends on a platform default and also covers *.vercel.app. Setting
  // the header replaces Vercel's, so it must never be weaker than 63072000.
  // Deliberately no `includeSubDomains` and no `preload`: the client owns the
  // domain (CLAUDE.md D6) and we don't control what its other subdomains serve
  // (email-tracking CNAMEs, for example). Both are their call.
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  // Clickjacking: nothing here is meant to be embedded, and a framed invite form
  // under someone else's overlay is how a submission gets faked.
  // X-Frame-Options for older agents, frame-ancestors for current ones.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Keeps the full URL off cross-origin requests — the outbound BeatStars,
  // YouTube and Instagram links get the origin only.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing here uses any of these; denying them means an injected script or a
  // third-party embed cannot ask for them either.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "frame-ancestors 'none'", // the modern half of X-Frame-Options: DENY
      "base-uri 'self'", // stops an injected <base> repointing every relative URL
      "object-src 'none'", // no <object>/<embed>/<applet>, ever
      "form-action 'self'", // a form can only post back to us, never off-site
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework version to scanners. Cosmetic next to the
  // headers above, but it is one line and there is no reason to publish it.
  poweredByHeader: false,
  // node-postgres stays a plain runtime require instead of being bundled: it
  // lazily requires the optional native `pg-native`, which bundlers try to
  // resolve and fail on. Vercel's file tracing ships it with the function.
  serverExternalPackages: ["pg"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
