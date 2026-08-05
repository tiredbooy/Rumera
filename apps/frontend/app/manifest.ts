import type { MetadataRoute } from "next";

import { brandPaths } from "@/lib/brand";
import { PWA_SHORTCUTS, PWA_THEME } from "@/lib/pwa/config";
import { siteConfig } from "@/lib/site";

/**
 * Web App Manifest — install identity for Android/desktop and PWA audits.
 * Icons include generated app icons + canonical brand assets.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: siteConfig.title,
    short_name: siteConfig.name,
    description: siteConfig.description,
    lang: "fa",
    dir: "rtl",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "browser"],
    orientation: "any",
    background_color: PWA_THEME.backgroundColor,
    theme_color: PWA_THEME.themeColorDark,
    categories: ["shopping", "food", "lifestyle"],
    prefer_related_applications: false,
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: brandPaths.iconPng,
        sizes: "435x388",
        type: "image/png",
        purpose: "any",
      },
      {
        src: brandPaths.iconSvg,
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    shortcuts: PWA_SHORTCUTS.map((item) => ({
      name: item.name,
      short_name: item.short_name,
      description: item.description,
      url: item.url,
      icons: [
        {
          src: brandPaths.iconPng,
          sizes: "435x388",
          type: "image/png",
        },
      ],
    })),
  };
}
