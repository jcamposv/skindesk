import type { MetadataRoute } from "next";

/**
 * PWA manifest. Optimised for the clienta mobile experience (Add to Home
 * Screen). The `start_url` points at the role-router so the user lands on
 * `/clienta` automatically once authenticated.
 *
 * TODO: ship dedicated 192x192 and 512x512 PNGs (currently we lean on the
 * SVG and favicon which Chrome accepts but iOS doesn't render at full
 * fidelity).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SkinDesk",
    short_name: "SkinDesk",
    description:
      "SkinDesk · plataforma de cosmetología para profesionales y sus clientas.",
    lang: "es",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#5C6E6C",
    icons: [
      { src: "/logo.svg",     sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/favicon.ico",  sizes: "32x32 16x16", type: "image/x-icon" },
    ],
  };
}
