import type { MetadataRoute } from "next";

import { prisma } from "@/lib/prisma";

function baseUrl(): string {
  return (process.env.AUTH_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = baseUrl();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/discover`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/studio`, changeFrequency: "monthly", priority: 0.6 },
  ];

  const figures = await prisma.figure
    .findMany({ where: { isPublic: true }, orderBy: { updatedAt: "desc" }, take: 1000, select: { id: true, updatedAt: true } })
    .catch(() => []);

  return [
    ...staticRoutes,
    ...figures.map((figure) => ({
      url: `${base}/figures/${figure.id}`,
      lastModified: figure.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
