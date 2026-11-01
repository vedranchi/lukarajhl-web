import type { Metadata } from "next";
import { IBM_Plex_Mono, VT323 } from "next/font/google";
import { siteName, siteUrl } from "@/data/content";
import "./globals.css";

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const display = VT323({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const title = "Luka Rajhl - Beat Producer";

/**
 * Most visits arrive from a shared link (Instagram bio, DMs, WhatsApp), so the
 * preview card is the first impression. The image comes from the
 * `opengraph-image.tsx` file convention next to this layout; Next adds the
 * og:image tags for it. X/Twitter falls back to og:image, so no separate
 * twitter-image is needed.
 *
 * Deliberately no `description` (and so no og:/twitter:description): the
 * client wants a shared link to show the image and title only, without a line
 * of copy under them. Search engines write their own snippet from the page.
 */
export const metadata: Metadata = {
  // Resolves the relative og:image / canonical URLs. Pinned to production so a
  // link shared from a preview deployment still previews the real site.
  metadataBase: new URL(siteUrl),
  title,
  // No `alternates.canonical` here: this layout also wraps the (payload) admin
  // segment, so a canonical set here would mark every admin view as a
  // duplicate of the homepage. It lives in page.tsx instead.
  openGraph: {
    type: "website",
    url: "/",
    siteName,
    title,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title,
  },
  // Google Search Console HTML-tag verification. Omitted when unset; a DNS
  // TXT record is the preferred method (see .env.example).
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${mono.variable} ${display.variable}`}>
      <body>
        <noscript>
          <style>{`[data-reveal]{opacity:1!important;transform:none!important}`}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}
