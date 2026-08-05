import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { brandMarks } from "@/lib/brand";

// Tab / PWA base icon — dark-field Rumera monogram on cellar plate.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default async function Icon() {
  const logoBytes = await readFile(
    join(process.cwd(), "public", brandMarks.onDark.png.src.replace(/^\//, "")),
  );
  const logoSrc = `data:image/png;base64,${logoBytes.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2b231c",
          borderRadius: 96,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          width={400}
          height={356}
          style={{ objectFit: "contain" }}
          alt=""
        />
      </div>
    ),
    { ...size },
  );
}
