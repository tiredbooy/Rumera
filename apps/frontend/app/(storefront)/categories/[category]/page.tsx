import type { Metadata } from "next";

import {
  getCategoryBySlug,
  listCategories,
} from "@/features/catalog/categories/api";
import { CategoryDetailView } from "@/features/catalog/categories/components/category-detail-view";
import { buildMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

export async function generateStaticParams() {
  return (await listCategories()).flatMap((c) =>
    c.slug ? [{ category: c.slug }] : [],
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const cat = await getCategoryBySlug(category);
  if (!cat) return buildMetadata({ title: "دسته یافت نشد", index: false });
  return buildMetadata({
    title: cat.title,
    description: cat.description ?? `خرید ${cat.title} از مجموعهٔ منتخب رومرا.`,
    path: `/categories/${category}`,
  });
}

export default function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  return <CategoryDetailView params={params} />;
}
