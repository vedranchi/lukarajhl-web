import type { MetadataRoute } from "next";
import { catalogueGeneratedAt, siteUrl } from "@/data/content";

/**
 * One public page. `lastModified` is the catalogue snapshot's timestamp: the
 * beats and kits are what actually change, and the scheduled refresh only
 * rewrites that file when the ranking moves (CLAUDE.md P4), so this date moves
 * when the page does.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: catalogueGeneratedAt,
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
