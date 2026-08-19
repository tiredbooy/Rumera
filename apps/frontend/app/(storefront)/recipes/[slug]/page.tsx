import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";

import {
  getRecipeBySlug,
  listRecipeSlugs,
} from "@/features/recipes/api/server";
import { RecipeDetailView } from "@/features/recipes/components/recipe-detail-view";
import { publicRequest } from "@/lib/api/public";
import { getSafeApiErrorContext } from "@/lib/api/error-semantics";
import { RECIPE_CACHE_TAG } from "@/lib/cache-tags";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * A slug retired by a rename keeps its inbound links: the backend holds a
 * redirect record keyed on the old slug. Reached only after the live lookup
 * missed, so a live slug always outranks a record, and a lookup failure degrades
 * to the normal 404 rather than a 500.
 */
async function renamedRecipeSlug(slug: string): Promise<string | null> {
  try {
    const { slug: target } = await publicRequest<{ slug: string }>(
      `/recipes/${encodeURIComponent(slug)}/redirect`,
      {
        cache: "force-cache",
        next: { revalidate: 3600, tags: [RECIPE_CACHE_TAG] },
      },
    );
    return target?.trim() || null;
  } catch {
    return null;
  }
}

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

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // The detail fetch is memoised, so the happy path costs nothing extra here.
  // 308 rather than 301: it is the only permanent redirect a server component
  // can issue, and for a GET page crawlers treat the two identically — with the
  // bonus that 308 cannot silently turn a request into a GET.
  if (!(await getRecipeBySlug(slug))) {
    const target = await renamedRecipeSlug(slug);
    if (target && target !== slug) {
      permanentRedirect(`/recipes/${encodeURIComponent(target)}`);
    }
  }
  return <RecipeDetailView params={params} />;
}
