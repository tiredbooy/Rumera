import type { MetadataRoute } from "next"

import { siteConfig } from "@/lib/site"

/**
 * Web App Manifest served at /manifest.webmanifest. Makes the storefront
 * installable and gives Lighthouse/PWA audits the metadata they look for.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.title,
    short_name: siteConfig.name,
    description: siteConfig.description,
    start_url: "/",
    display: "standalone",
    background_color: "#2b231c",
    theme_color: "#2b231c",
    categories: ["shopping", "food", "lifestyle"],
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
    ],
  }
}
