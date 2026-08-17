import type { Metadata } from "next";

import { ProductListView } from "@/features/catalog/products/components/product-list-view";
import {
  parseProductListRouteQuery,
  PRODUCT_LIST_SORT_OPTIONS,
  type ProductListSearchParamsRecord,
} from "@/features/catalog/products/list-routing";
import { buildMetadata } from "@/lib/seo/metadata";

const description =
  "کاوش در مجموعهٔ کامل رومرا — ویسکی، شراب، شامپاین و اسپیریت‌های نایاب، مستقیم از سازندگان.";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<ProductListSearchParamsRecord>;
}): Promise<Metadata> {
  const query = parseProductListRouteQuery(await searchParams);
  const isDefaultSort =
    query.sortBy === "created_at" && query.orderBy === "desc";
  const filtered =
    Boolean(query.search) ||
    Boolean(query.brand) ||
    !isDefaultSort ||
    query.page > 1;
  const sortLabel =
    PRODUCT_LIST_SORT_OPTIONS.find((option) => option.value === query.sortMode)
      ?.label ?? PRODUCT_LIST_SORT_OPTIONS[0].label;
  const title = query.search
    ? `جستجوی «${query.search}» در فروشگاه`
    : query.brand
      ? `فروشگاه بطری‌ها — ${query.brand}`
      : !isDefaultSort
        ? `${sortLabel} فروشگاه بطری‌ها`
        : query.page > 1
          ? `فروشگاه بطری‌ها، صفحهٔ ${query.page.toLocaleString("fa-IR")}`
          : "فروشگاه بطری‌ها";

  return buildMetadata({
    title,
    description,
    path: "/products",
    index: !filtered && !query.needsRedirect,
  });
}

export default function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<ProductListSearchParamsRecord>;
}) {
  return <ProductListView searchParams={searchParams} />;
}
