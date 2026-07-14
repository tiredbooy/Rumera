import type { Metadata } from "next";

import {
  ProductListView,
  type ProductListSearchParams,
} from "@/features/catalog/products/components/product-list-view";
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
  searchParams: Promise<ProductListSearchParams>;
}) {
  return <ProductListView searchParams={searchParams} />;
}
