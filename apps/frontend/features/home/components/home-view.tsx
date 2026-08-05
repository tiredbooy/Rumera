import { TrendingUp } from "lucide-react";

import { BrandMarquee } from "@/features/catalog/brands/components/brand-marquee";
import { getFeaturedBrands } from "@/features/catalog/brands/api";
import { listProducts } from "@/features/catalog/products/api/public";
import { RecommendationRail } from "@/features/catalog/products/components/recommendation-rail";
import { getFeaturedCategories } from "@/features/catalog/categories/api";
import { listActiveHeroSlides } from "@/features/hero-slides/api/server";
import { getTrending } from "@/features/recommendations/api";
import { CatalogSection } from "@/features/home/components/CatalogSection";
import { CategoryGrid } from "@/features/home/components/CategoryGrid";
import { ForYouRail } from "@/features/home/components/for-you-rail";
import { HeroCarousel } from "@/features/home/components/hero-carousel";
import { NewsletterSection } from "@/features/home/components/NewsletterSection";
import { PerksSection } from "@/features/home/components/PerksSection";
import { StorySection } from "@/features/home/components/StorySection";
import { TestimonialSection } from "@/features/home/components/TestimonialSection";

/** Soft-fail a home surface so SSG/ISR never hard-crashes when the API is down. */
async function settleHome<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    console.error("HomeView: surface fetch failed", error);
    return fallback;
  }
}

export async function HomeView() {
  // Each surface degrades independently: build/prerender and partial outages
  // must not take down the entire homepage.
  const [heroSlides, trending, homeCategories, brands, catalogue] =
    await Promise.all([
      listActiveHeroSlides(),
      getTrending({ limit: 8 }),
      settleHome(getFeaturedCategories(), []),
      getFeaturedBrands(),
      settleHome(listProducts({ page: 1, limit: 8 }), {
        results: [],
        pagination: {
          page: 1,
          limit: 8,
          total_items: 0,
          total_pages: 0,
          has_next: false,
          has_prev: false,
        },
      }),
    ]);

  const filterChips = [
    { key: "all", label: "همه", href: "/products" },
    ...homeCategories.slice(0, 4).map((c) => ({
      key: String(c.id),
      label: c.title,
      href: `/categories/${c.slug}`,
    })),
  ];

  return (
    <>
      <h1 className="sr-only">فروشگاه رومرا</h1>
      <HeroCarousel slides={heroSlides} />
      <PerksSection />
      <ForYouRail />

      <section
        id="brands"
        aria-labelledby="home-brands-title"
        className="scroll-mt-24 border-b border-border/60 py-8"
      >
        <div className="container-px mx-auto max-w-7xl">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow mb-2">برندها</p>
              <h2
                id="home-brands-title"
                className="font-serif text-2xl sm:text-3xl"
              >
                برندهای محبوب، گرد هم
              </h2>
            </div>
            <a
              href="/brands"
              className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              همهٔ برندها
            </a>
          </div>
          <BrandMarquee items={brands} />
        </div>
      </section>

      <CategoryGrid categories={homeCategories} />
      <CatalogSection
        filterChips={filterChips}
        products={catalogue.results ?? []}
      />

      {trending.length ? (
        <section className="border-y border-border/60 bg-card/30">
          <RecommendationRail
            items={trending}
            eyebrow="پرطرفدارِ این روزها"
            title="پرفروش‌ها و پرطرفدارها"
            icon={TrendingUp}
            className="container-px mx-auto max-w-7xl py-20"
          />
        </section>
      ) : null}

      <StorySection />
      <TestimonialSection />
      <NewsletterSection />
    </>
  );
}
