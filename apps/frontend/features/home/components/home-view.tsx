import { TrendingUp } from "lucide-react";

import { BrandMarquee } from "@/features/catalog/brands/components/brand-marquee";
import { getFeaturedBrands } from "@/features/catalog/brands/api";
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

export async function HomeView() {
  const [heroSlides, trending, homeCategories, brands] = await Promise.all([
    listActiveHeroSlides(),
    getTrending({ limit: 8 }),
    getFeaturedCategories(),
    getFeaturedBrands(),
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

      <section className="border-b border-border/60 py-8">
        <div className="container-px mx-auto max-w-7xl">
          <p className="eyebrow mb-5 justify-center text-center">
            برندهای محبوب، گرد هم
          </p>
          <BrandMarquee items={brands} />
        </div>
      </section>

      <CategoryGrid categories={homeCategories} />
      <CatalogSection filterChips={filterChips} />

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
