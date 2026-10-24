import type { MetadataRoute } from "next";

import { getApplicationConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/library", "/collections", "/credits", "/studio", "/signin", "/register"],
    },
    sitemap: `${getApplicationConfig().siteUrl}/sitemap.xml`,
  };
}
