import type { Metadata } from "next";

import { ProductListView } from "@/features/catalog/products/components/product-list-view";
import type { ProductListSearchParamsRecord } from "@/features/catalog/products/list-routing";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "فروشگاه بطری‌ها",
  description:
    "کاوش در مجموعهٔ کامل رومرا — ویسکی، شراب، شامپاین و اسپیریت‌های نایاب، مستقیم از سازندگان.",
  path: "/products",
});

export default function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<ProductListSearchParamsRecord>;
}) {
  return <ProductListView searchParams={searchParams} />;
}
