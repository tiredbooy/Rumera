import type { Metadata, Viewport } from "next";
import { Vazirmatn, Markazi_Text, Geist_Mono } from "next/font/google";
import "./globals.css";

import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/site";
import { Providers } from "@/app/providers";
import { Toaster } from "@/components/ui/sonner";

// Vazirmatn — the de-facto modern Persian UI typeface (clean, fully hinted for
// fa/ar). Powers all body + UI copy.
const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-sans",
  display: "swap",
});

// Markazi Text — an elegant Persian serif used purely for large display
// headings and the wordmark, giving the cellar its editorial, luxe character.
const markazi = Markazi_Text({
  subsets: ["arabic", "latin"],
  variable: "--font-serif",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.title,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [...siteConfig.keywords],
  authors: [{ name: siteConfig.name, url: siteConfig.url }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  alternates: {
    canonical: "/",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: siteConfig.title,
    description: siteConfig.description,
    type: "website",
    url: siteConfig.url,
    siteName: siteConfig.name,
    locale: siteConfig.locale,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    creator: siteConfig.twitter,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "shopping",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#2b231c" },
  ],
  colorScheme: "dark light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fa"
      dir="rtl"
      suppressHydrationWarning
      className={cn(
        "h-full antialiased",
        vazirmatn.variable,
        markazi.variable,
        geistMono.variable
      )}
    >
      <body className="flex min-h-full flex-col font-sans">
        <Providers>
          {children}
          <Toaster position="bottom-left" dir="rtl" />
        </Providers>
      </body>
    </html>
  );
}
