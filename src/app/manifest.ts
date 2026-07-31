import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Figure · Visual learning studio",
    short_name: "Figure",
    description: "Create, collect, and master AI-generated annotated figures.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f6f2",
    theme_color: "#17181d",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
