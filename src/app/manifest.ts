import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chabad at Lehigh",
    short_name: "Chabad Lehigh",
    description: "Shabbat dinners, events and community for Lehigh students and friends.",
    start_url: "/",
    display: "standalone",
    background_color: "#fffaf2",
    theme_color: "#fffaf2",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
