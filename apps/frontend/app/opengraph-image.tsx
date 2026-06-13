import { ImageResponse } from "next/og"

import { siteConfig } from "@/lib/site"

// Branded social-share card, generated at the edge. Used for OG + Twitter.
export const alt = siteConfig.title
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background:
            "radial-gradient(60% 80% at 50% -10%, #6b4f1e 0%, transparent 60%), radial-gradient(50% 60% at 90% 110%, #5a1f22 0%, transparent 60%), #221b14",
          color: "#f3ead9",
          fontFamily: "serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 34,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: "#e8c477",
          }}
        >
          Rumera
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 76, lineHeight: 1.05, maxWidth: 900 }}>
            Rare bottles, poured with intent.
          </div>
          <div
            style={{
              fontSize: 30,
              color: "#c9bca6",
              maxWidth: 820,
              fontFamily: "sans-serif",
              marginTop: 12,
            }}
          >
            A curated cellar of whisky, wine, champagne &amp; craft spirits —
            delivered cold and fast.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 24,
            color: "#9c8f78",
            fontFamily: "sans-serif",
          }}
        >
          <span>1,200+ rare labels · 38 countries</span>
          <span>rumera.com</span>
        </div>
      </div>
    ),
    { ...size }
  )
}
