import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EUIS Tickets",
    short_name: "EUIS Tickets",
    description: "Ticketing for Edinburgh University Indian Society events",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf7f0",
    theme_color: "#121f57",
    icons: [
      { src: "/logo-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/logo-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
