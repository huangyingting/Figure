import type { MetadataRoute } from "next";

import { getLocale } from "@/lib/i18n";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const locale = await getLocale();
  return {
    name: locale === "zh-CN" ? "Figure · 可视化学习工作室" : "Figure · Visual learning studio",
    short_name: "Figure",
    description: locale === "zh-CN"
      ? "创建、收藏并掌握 AI 生成的标注图解。"
      : "Create, collect, and master AI-generated annotated figures.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f1e4",
    theme_color: "#23211b",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
