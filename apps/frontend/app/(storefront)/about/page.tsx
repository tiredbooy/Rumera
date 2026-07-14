import type { Metadata } from "next";

import { AboutView } from "@/features/storefront/about/components/about-view";
import { buildMetadata } from "@/lib/seo/metadata";

export const revalidate = 86400;

export const metadata: Metadata = buildMetadata({
  title: "دربارهٔ رومرا",
  description:
    "رومرا یک مقصد منتخب برای خرید آنلاین است — مجموعه‌ای گسترده با ضمانت اصالت، قیمت منصفانه و ارسالی مطمئن به سراسر کشور.",
  path: "/about",
});

export default function AboutPage() {
  return <AboutView />;
}
