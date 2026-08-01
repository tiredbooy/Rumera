import type { Metadata } from "next";

import {
  getRecipeBySlug,
  listRecipeSlugs,
} from "@/features/recipes/api/server";
import { RecipeDetailView } from "@/features/recipes/components/recipe-detail-view";
import { getSafeApiErrorContext } from "@/lib/api/error-semantics";
import { buildMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    const slugs = await listRecipeSlugs();
    return slugs.map((slug) => ({ slug }));
  } catch (error) {
    console.error(
      "generateStaticParams: failed to load recipe slugs",
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
  const recipe = await getRecipeBySlug(slug);
  if (!recipe)
    return buildMetadata({
      title: "دستور یافت نشد",
      path: `/recipes/${encodeURIComponent(slug)}`,
      index: false,
    });
  const tags = recipe.tags.map((tag) => tag.title);
  return buildMetadata({
    title: recipe.meta_title?.trim() || recipe.title,
    description:
      recipe.meta_description?.trim() ||
      recipe.excerpt?.trim() ||
      recipe.description?.trim() ||
      undefined,
    path:
      recipe.canonical_url?.trim() ||
      `/recipes/${encodeURIComponent(recipe.slug)}`,
    type: "article",
    images: [recipe.og_image_url ?? recipe.image_url].filter(
      Boolean,
    ) as string[],
    keywords: [...(recipe.meta_keywords ?? []), ...tags],
    article: {
      publishedTime: recipe.published_at ?? undefined,
      modifiedTime: recipe.updated_at,
      section: recipe.cocktail_type ?? undefined,
      tags,
    },
  });
}

export default function RecipeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <RecipeDetailView params={params} />;
}
