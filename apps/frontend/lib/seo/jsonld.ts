/**
 * JSON-LD builders. Centralising structured data keeps rich-result markup
 * consistent and is the backbone of GEO (AI-search) visibility — assistants
 * read this graph to understand and cite the catalogue.
 *
 * Builders return plain objects; render them with <JsonLd /> (components/json-ld).
 */
import { siteConfig, absoluteUrl } from "@/lib/site";
import { type Product } from "@/lib/products";
import type {
  ProductDetail,
  ProductListItem,
} from "@/features/catalog/products/types";
import type { JournalDetail } from "@/features/journal/types";
import type { RecipeDetail } from "@/features/recipes/types";
import { extractContentSteps } from "@/lib/content/sanitize-html";

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    logo: absoluteUrl("/icon"),
    sameAs: Object.values(siteConfig.socials),
  };
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    inLanguage: "fa-IR",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: absoluteUrl("/search?q={search_term_string}"),
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function productLd(p: Product) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.note,
    brand: { "@type": "Brand", name: p.maker },
    url: absoluteUrl(`/products/${p.slug}`),
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: p.rating,
      reviewCount: p.reviews,
    },
    offers: {
      "@type": "Offer",
      price: p.price,
      priceCurrency: "IRT",
      url: absoluteUrl(`/products/${p.slug}`),
    },
  };
}

/** Product JSON-LD from a live API `ProductDetail`. Pass `rating` (from the
 * reviews summary) to emit AggregateRating, and `reviews` to emit individual
 * Review nodes — both power Google/AI review rich-results. */
export function productDetailLd(
  p: ProductDetail,
  rating?: { value: number; count: number },
  reviews?: {
    rating: number;
    title?: string;
    content?: string;
    created_at: string;
  }[],
) {
  const variants = (p.variants ?? []).filter(
    (variant) => variant.is_active && variant.price > 0,
  );
  const prices = variants.map((variant) => variant.price);
  const low = prices.length ? Math.min(...prices) : undefined;
  const high = prices.length ? Math.max(...prices) : undefined;
  const slug = p.slug?.trim();
  const productUrl = slug
    ? absoluteUrl(`/products/${encodeURIComponent(slug)}`)
    : undefined;
  const singleSku =
    variants.length === 1 ? variants[0]?.sku?.trim() || undefined : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    description: p.description ?? p.meta_description,
    ...(singleSku ? { sku: singleSku } : {}),
    mpn: p.code,
    ...(productUrl ? { url: productUrl } : {}),
    image: (p.images ?? []).map((img) => img.image_url),
    ...(p.country_of_origin ? { countryOfOrigin: p.country_of_origin } : {}),
    ...(rating && rating.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(rating.value.toFixed(1)),
            reviewCount: rating.count,
          },
        }
      : {}),
    ...(reviews && reviews.length
      ? {
          review: reviews.slice(0, 8).map((r) => ({
            "@type": "Review",
            reviewRating: {
              "@type": "Rating",
              ratingValue: r.rating,
              bestRating: 5,
            },
            ...(r.title ? { name: r.title } : {}),
            ...(r.content ? { reviewBody: r.content } : {}),
            datePublished: r.created_at,
          })),
        }
      : {}),
    offers:
      low !== undefined
        ? {
            "@type": "AggregateOffer",
            priceCurrency: "IRT",
            lowPrice: low,
            highPrice: high,
            offerCount: prices.length,
            ...(productUrl ? { url: productUrl } : {}),
            offers: variants.map((variant) => ({
              "@type": "Offer",
              price: variant.price,
              priceCurrency: "IRT",
              availability:
                (variant.available_stock ?? 0) > 0
                  ? "https://schema.org/InStock"
                  : "https://schema.org/OutOfStock",
              ...(variant.sku?.trim() ? { sku: variant.sku.trim() } : {}),
              ...(productUrl ? { url: productUrl } : {}),
            })),
          }
        : undefined,
  };
}

/** ItemList JSON-LD from live `ProductListItem`s (listing pages). */
export function productListLd(
  name: string,
  items: ProductListItem[],
  startPosition = 1,
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListElement: items.flatMap((product, index) => {
      const slug = product.slug?.trim();
      return slug
        ? [
            {
              "@type": "ListItem",
              position: startPosition + index,
              name: product.title,
              url: absoluteUrl(`/products/${encodeURIComponent(slug)}`),
            },
          ]
        : [];
    }),
  };
}

export function contentListLd(
  name: string,
  items: { name: string; path: string }[],
  startPosition = 1,
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: startPosition + index,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  };
}

export function journalArticleLd(post: JournalDetail) {
  const url = absoluteUrl(`/journal/${encodeURIComponent(post.slug)}`);
  const description =
    post.meta_description?.trim() || post.excerpt?.trim() || undefined;
  const categories = post.categories.map((category) => category.name);

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    ...(description ? { description } : {}),
    ...(post.image_url ? { image: [absoluteUrl(post.image_url)] } : {}),
    inLanguage: "fa-IR",
    ...(post.published_at ? { datePublished: post.published_at } : {}),
    dateModified: post.updated_at,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    ...(categories.length ? { articleSection: categories } : {}),
    ...(post.time_to_read > 0
      ? { timeRequired: `PT${post.time_to_read}M` }
      : {}),
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
    },
  };
}

function isoDuration(minutes: number): string | undefined {
  if (!Number.isFinite(minutes) || minutes <= 0) return undefined;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours && rest) return `PT${hours}H${rest}M`;
  return hours ? `PT${hours}H` : `PT${rest}M`;
}

export function recipeDetailLd(recipe: RecipeDetail) {
  const fallbackPath = `/recipes/${encodeURIComponent(recipe.slug)}`;
  const url = absoluteUrl(recipe.canonical_url?.trim() || fallbackPath);
  const description =
    recipe.meta_description?.trim() ||
    recipe.excerpt?.trim() ||
    recipe.description?.trim() ||
    undefined;
  const image = recipe.og_image_url ?? recipe.image_url;
  const instructions = extractContentSteps(recipe.content);
  const keywords = [
    ...(recipe.meta_keywords ?? []),
    ...recipe.tags.map((tag) => tag.title),
  ].filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipe.title,
    url,
    inLanguage: "fa-IR",
    ...(description ? { description } : {}),
    ...(image ? { image: [absoluteUrl(image)] } : {}),
    ...(recipe.published_at ? { datePublished: recipe.published_at } : {}),
    dateModified: recipe.updated_at,
    ...(recipe.servings > 0 ? { recipeYield: `${recipe.servings} نفر` } : {}),
    ...(recipe.cocktail_type ? { recipeCategory: recipe.cocktail_type } : {}),
    ...(keywords.length ? { keywords } : {}),
    ...(isoDuration(recipe.prep_time_minutes)
      ? { prepTime: isoDuration(recipe.prep_time_minutes) }
      : {}),
    ...(isoDuration(recipe.cook_time_minutes)
      ? { cookTime: isoDuration(recipe.cook_time_minutes) }
      : {}),
    ...(isoDuration(recipe.total_time_minutes)
      ? { totalTime: isoDuration(recipe.total_time_minutes) }
      : {}),
    ...(recipe.calories != null
      ? {
          nutrition: {
            "@type": "NutritionInformation",
            calories: `${recipe.calories} calories`,
          },
        }
      : {}),
    ...(recipe.ingredients.length
      ? {
          recipeIngredient: recipe.ingredients.map((ingredient) =>
            [ingredient.quantity, ingredient.unit, ingredient.ingredient_name]
              .filter(Boolean)
              .join(" "),
          ),
        }
      : {}),
    ...(instructions.length
      ? {
          recipeInstructions: instructions.map((text, index) => ({
            "@type": "HowToStep",
            position: index + 1,
            text,
          })),
        }
      : {}),
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function itemListLd(name: string, products: Product[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListElement: products.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: productLd(p),
    })),
  };
}

export function faqLd(items: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export function recipeLd(recipe: {
  name: string;
  description: string;
  slug: string;
  ingredients: string[];
  steps: string[];
  totalTime?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipe.name,
    description: recipe.description,
    url: absoluteUrl(`/recipes/${recipe.slug}`),
    inLanguage: "fa-IR",
    recipeIngredient: recipe.ingredients,
    ...(recipe.totalTime ? { totalTime: recipe.totalTime } : {}),
    recipeInstructions: recipe.steps.map((text, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      text,
    })),
  };
}
