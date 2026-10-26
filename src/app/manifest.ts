import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dashboard",
    short_name: "Dashboard",
    description: "Bảng điều khiển cá nhân: lịch, deadline, điểm và công việc.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FFF6D6",
    theme_color: "#FFF6D6",
    lang: "vi",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
