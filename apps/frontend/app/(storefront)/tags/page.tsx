import type { Metadata } from "next";

import { TagIndexView } from "@/features/catalog/tags/components/tag-index-view";
import type { TagPageSearchParams } from "@/features/catalog/tags/routing";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "برچسب‌ها",
  description:
    "محصولات منتخب رومرا را بر اساس برچسب‌های فصلی، کمیاب، هدیه و سبک‌های محبوب کاوش کنید.",
  path: "/tags",
});

export default function TagsPage({
  searchParams,
}: {
  searchParams: TagPageSearchParams;
}) {
  return <TagIndexView searchParams={searchParams} />;
}
