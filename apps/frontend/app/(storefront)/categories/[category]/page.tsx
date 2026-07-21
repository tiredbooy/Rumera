import type { Metadata } from "next";

import {
  allCategorySlugs,
  getCategoryBySlug,
} from "@/features/catalog/categories/api";
import { CategoryDetailView } from "@/features/catalog/categories/components/category-detail-view";
import {
  categoryPageHref,
  categoryPath,
  getCategorySortLabel,
  parseCategoryRouteQuery,
  type CategoryPageSearchParams,
} from "@/features/catalog/categories/routing";
import { getSafeApiErrorContext } from "@/lib/api/error-semantics";
import { faNum } from "@/lib/products";
import { buildMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    return (await allCategorySlugs()).map((category) => ({ category }));
  } catch (error) {
    console.error(
      "generateStaticParams: failed to load category slugs",
      getSafeApiErrorContext(error),
    );
    return [];
  }
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: CategoryPageSearchParams;
}): Promise<Metadata> {
  const [{ category }, rawSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const requestedPath = categoryPath(category);
  const cat = await getCategoryBySlug(category);
  if (!cat) {
    return buildMetadata({
      title: "دسته یافت نشد",
      path: requestedPath,
      index: false,
    });
  }

  const query = parseCategoryRouteQuery(rawSearchParams);
  const canonicalSlug = cat.slug?.trim() || category;
  const basePath = categoryPath(canonicalSlug);
  const isQueryVariant =
    Boolean(query.q) || query.sort !== "newest" || query.needsRedirect;
  const path =
    !isQueryVariant && query.page > 1
      ? categoryPageHref(basePath, query, query.page)
      : basePath;
  const title = query.q
    ? `جست‌وجوی «${query.q}» در ${cat.title}`
    : query.sort !== "newest"
      ? `${cat.title} - ${getCategorySortLabel(query.sort)}`
      : query.page > 1
        ? `${cat.title} - صفحهٔ ${faNum(query.page)}`
        : cat.title;
  const categoryImage = cat.image_url?.trim();

  return buildMetadata({
    title,
    description: cat.description ?? `خرید ${cat.title} از مجموعهٔ منتخب رومرا.`,
    path,
    index: !isQueryVariant,
    images: categoryImage ? [categoryImage] : undefined,
    keywords: [cat.title],
  });
}

export default function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: CategoryPageSearchParams;
}) {
  return <CategoryDetailView params={params} searchParams={searchParams} />;
}
