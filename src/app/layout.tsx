import type { Metadata } from "next";

import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "./globals.css";
import { Providers } from "@/app/providers";

export const metadata: Metadata = {
  metadataBase: new URL((process.env.AUTH_URL || "http://localhost:3000").replace(/\/+$/, "")),
  title: { default: "Figure · Learn visually", template: "%s · Figure" },
  description: "Create, collect, and master AI-generated annotated figures.",
  openGraph: {
    title: "Figure · Learn visually",
    description: "Create, collect, and master AI-generated annotated figures.",
    siteName: "Figure",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Figure · Learn visually",
    description: "Create, collect, and master AI-generated annotated figures.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
