import type { MetadataRoute } from "next";
import { siteUrl } from "@/data/content";

/**
 * Everything is public: one page, plus the generated sitemap and preview image.
 * There is no admin or API route left to keep crawlers out of — the Payload
 * admin that used to live at /admin was removed. Unknown paths 404.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
