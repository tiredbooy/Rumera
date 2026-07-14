import type { Metadata } from "next";

import {
  allProductSlugs,
  getProductBySlug,
} from "@/features/catalog/products/api/public";
import { ProductDetailView } from "@/features/catalog/products/components/product-detail-view";
import { buildMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

export async function generateStaticParams() {
  return (await allProductSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return buildMetadata({ title: "محصول یافت نشد", index: false });
  return buildMetadata({
    title: product.meta_title ?? product.title,
    description: product.meta_description ?? product.description,
    path: `/products/${product.slug}`,
    type: "article",
    images: product.images?.map((i) => i.image_url),
    keywords: [
      product.title,
      ...(product.country_of_origin ? [product.country_of_origin] : []),
      ...(product.tags?.map((t) => t.title) ?? []),
      ...(product.meta_tags ?? []),
    ],
  });
}

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <ProductDetailView params={params} />;
}
