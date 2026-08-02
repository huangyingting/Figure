import type { Metadata } from "next";

import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "./globals.css";
import { Providers } from "@/app/providers";
import { getLocale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const title = locale === "zh-CN" ? "Figure · 可视化学习" : "Figure · Learn visually";
  const description = locale === "zh-CN"
    ? "创建、收藏并掌握 AI 生成的标注图解。"
    : "Create, collect, and master AI-generated annotated figures.";
  return {
    metadataBase: new URL((process.env.AUTH_URL || "http://localhost:3000").replace(/\/+$/, "")),
    title: { default: title, template: "%s · Figure" },
    description,
    openGraph: { title, description, siteName: "Figure", type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale} data-scroll-behavior="smooth">
      <body>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
