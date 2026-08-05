import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { brandCopy, brandMarks } from "@/lib/brand";
import { loadOgFonts } from "@/lib/og/fonts";
import { siteConfig } from "@/lib/site";

// Persian social card with vendored Vazirmatn (public/fonts).
// Satori shapes Arabic glyphs but multi-clause bidi line layout is unreliable,
// so copy is kept to short right-aligned lines (HTML metadata still carries
// the full siteConfig description for crawlers).
export const alt = siteConfig.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Short OG lines proven to shape cleanly with Vazirmatn + Satori. */
const ogLines = {
  eyebrow: "سردابهٔ بطری‌های نایاب",
  headline: "ویسکی · شراب · شامپاین",
  sub: "انتخاب‌شده، اصل، خنک و سریع",
  footer: "فروشندگان منتخب · اصالت تضمینی",
} as const;

export default async function OpengraphImage() {
  const [fonts, logoBytes] = await Promise.all([
    loadOgFonts([400, 600]),
    readFile(
      join(process.cwd(), "public", brandMarks.onDark.png.src.replace(/^\//, "")),
    ),
  ]);
  const logoSrc = `data:image/png;base64,${logoBytes.toString("base64")}`;

  let host = "rumera.com";
  try {
    host = new URL(siteConfig.url).host || host;
  } catch {
    // keep default
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background:
            "radial-gradient(60% 80% at 50% -10%, #6b4f1e 0%, transparent 60%), radial-gradient(50% 60% at 90% 110%, #5a1f22 0%, transparent 60%), #221b14",
          color: "#f3ead9",
          fontFamily: "Vazirmatn",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            width={96}
            height={86}
            style={{ objectFit: "contain" }}
            alt=""
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              alignItems: "flex-end",
            }}
          >
            <span
              style={{
                fontSize: 56,
                fontWeight: 600,
                color: "#e8c477",
                lineHeight: 1,
              }}
            >
              {brandCopy.wordmarkFa}
            </span>
            <span style={{ fontSize: 22, color: "#c9bca6" }}>
              {ogLines.eyebrow}
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            width: "100%",
            alignItems: "flex-end",
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 600,
              lineHeight: 1.2,
              color: "#f3ead9",
              textAlign: "right",
            }}
          >
            {ogLines.headline}
          </div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 400,
              color: "#c9bca6",
              textAlign: "right",
            }}
          >
            {ogLines.sub}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            alignItems: "center",
            fontSize: 22,
            color: "#9c8f78",
          }}
        >
          <span style={{ fontFamily: "sans-serif" }}>{host}</span>
          <span>{ogLines.footer}</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts,
    },
  );
}
