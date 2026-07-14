import type { Metadata } from "next";

import { FaqView } from "@/features/storefront/faq/components/faq-view";
import { buildMetadata } from "@/lib/seo/metadata";

export const revalidate = 86400;

export const metadata: Metadata = buildMetadata({
  title: "پرسش‌های پرتکرار",
  description:
    "پاسخ پرسش‌های رایج دربارهٔ خرید، ارسال، اصالت و بازگشت کالا در رومرا.",
  path: "/faq",
});

export default function FaqPage() {
  return <FaqView />;
}
