import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "思迹 - 记录思想的轨迹",
    short_name: "思迹",
    description: "AI思想传承助手 — 记录思想的轨迹",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f6f3",
    theme_color: "#4f46e5",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
