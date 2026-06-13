import type { Metadata } from "next";
import { Inter, Playfair_Display, Geist_Mono } from "next/font/google";
import "./globals.css";

import { cn } from "@/lib/utils";
import { Providers } from "@/app/providers";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AgeGate } from "@/components/age-gate";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Rumera — Rare Spirits, Wine & Champagne",
    template: "%s · Rumera",
  },
  description:
    "A curated cellar of rare whisky, old-world wine, grower champagne and craft spirits — delivered cold, fast, and beautifully.",
  keywords: [
    "whisky",
    "wine",
    "champagne",
    "spirits",
    "liquor delivery",
    "rare bottles",
  ],
  openGraph: {
    title: "Rumera — Rare Spirits, Wine & Champagne",
    description:
      "A curated cellar of rare whisky, old-world wine, grower champagne and craft spirits.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full antialiased",
        inter.variable,
        playfair.variable,
        geistMono.variable
      )}
    >
      <body className="flex min-h-full flex-col font-sans">
        <Providers>
          <SiteHeader />
          <main className="flex flex-1 flex-col">{children}</main>
          <SiteFooter />
          <AgeGate />
          <Toaster position="bottom-right" />
        </Providers>
      </body>
    </html>
  );
}
