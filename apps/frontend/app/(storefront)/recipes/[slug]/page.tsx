import type { Metadata } from "next";

import {
  getRecipeBySlug,
  listRecipeSlugs,
} from "@/features/recipes/api/server";
import { RecipeDetailView } from "@/features/recipes/components/recipe-detail-view";
import { buildMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await listRecipeSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const recipe = await getRecipeBySlug(slug);
  if (!recipe) return buildMetadata({ title: "دستور یافت نشد", index: false });
  return buildMetadata({
    title: recipe.meta_title ?? recipe.title,
    description:
      recipe.meta_description ??
      recipe.excerpt ??
      recipe.description ??
      undefined,
    path: `/recipes/${recipe.slug}`,
    type: "article",
    images: [recipe.og_image_url ?? recipe.image_url].filter(
      Boolean,
    ) as string[],
  });
}

export default function RecipeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <RecipeDetailView params={params} />;
}
