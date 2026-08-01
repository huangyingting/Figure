import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Figure · Visual learning studio",
    short_name: "Figure",
    description: "Create, collect, and master AI-generated annotated figures.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f1e4",
    theme_color: "#23211b",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
