import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ankikun",
    short_name: "Ankikun",
    description: "摩擦ゼロで続けられる英単語SRS",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfaf8",
    theme_color: "#4f46e5",
    orientation: "portrait",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
