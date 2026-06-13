import { ImageResponse } from "next/og"

// Generated app icon — a gold foil "R" on the cellar-dark background.
export const size = { width: 64, height: 64 }
export const contentType = "image/png"

export default function Icon() {
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
          color: "#e8c477",
          fontSize: 42,
          fontWeight: 700,
          fontFamily: "serif",
          borderRadius: 14,
        }}
      >
        R
      </div>
    ),
    { ...size }
  )
}
