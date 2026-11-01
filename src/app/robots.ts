import type { MetadataRoute } from "next";
import { siteUrl } from "@/data/content";

/**
 * There was no robots.txt at all, which left `/admin` and the Payload REST API
 * eligible for indexing. Neither serves anything a crawler should hold: `/admin`
 * is the client's login, and `/api/*` answers 403 to anyone unauthenticated.
 *
 * This is hygiene, not access control — the 403s above are the control. It keeps
 * the login page out of search results and stops crawlers spending the site's
 * function budget on routes that can only ever refuse them.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin/", "/api/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
