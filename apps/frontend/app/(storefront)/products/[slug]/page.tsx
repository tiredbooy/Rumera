import type { Metadata } from "next";

import {
  allProductSlugs,
  getProductBySlug,
} from "@/features/catalog/products/api/public";
import { ProductDetailView } from "@/features/catalog/products/components/product-detail-view";
import { getSafeApiErrorContext } from "@/lib/api/error-semantics";
import { buildMetadata } from "@/lib/seo/metadata";

export const revalidate = 60;

export async function generateStaticParams() {
  try {
    return (await allProductSlugs()).map((slug) => ({ slug }));
  } catch (error) {
    console.error(
      "generateStaticParams: failed to load product slugs",
      getSafeApiErrorContext(error),
    );
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const requestedPath = `/products/${encodeURIComponent(slug)}`;
  const product = await getProductBySlug(slug);
  if (!product) {
    return buildMetadata({
      title: "محصول یافت نشد",
      path: requestedPath,
      index: false,
      type: "website",
    });
  }

  const productSlug = product.slug?.trim();
  const images = product.images
    ?.map((image) => image.image_url)
    .filter(Boolean);

  return buildMetadata({
    title: product.meta_title ?? product.title,
    description: product.meta_description ?? product.description,
    path: productSlug
      ? `/products/${encodeURIComponent(productSlug)}`
      : requestedPath,
    type: "website",
    images: images?.length ? images : undefined,
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
