import type { MetadataRoute } from "next";
import { siteUrl } from "@/data/content";

/**
 * There was no robots.txt at all, which left `/admin` and the Payload REST API
 * eligible for indexing. Neither serves anything a crawler should hold: `/admin`
 * is the client's login, and `/api/*` answers 403 to anyone unauthenticated.
 *
 * This is hygiene, not access control — the 403s above are the control. `/api/`
 * is disallowed so crawlers don't spend the site's function budget on routes
 * that can only refuse them (a 403 is never indexed anyway).
 *
 * `/admin` is deliberately NOT disallowed. A Disallow stops crawling, not
 * indexing, and it would hide the `X-Robots-Tag: noindex` that next.config.ts
 * sends on /admin — which is what actually keeps the login page out of results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
