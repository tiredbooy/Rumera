import { HeroCarousel } from "@/features/home/components/hero-carousel";
import { ForYouRail } from "@/features/home/components/for-you-rail";
import { RecommendationRail } from "@/features/catalog/components/recommendation-rail";
import { BrandMarquee } from "@/components/brand-marquee";
import { PerksSection } from "@/features/home/components/PerksSection";
import { CategoryGrid } from "@/features/home/components/CategoryGrid";
import { CatalogSection } from "@/features/home/components/CatalogSection";
import { StorySection } from "@/features/home/components/StorySection";
import { TestimonialSection } from "@/features/home/components/TestimonialSection";
import { NewsletterSection } from "@/features/home/components/NewsletterSection";
import { TrendingUp } from "lucide-react";

import { getHeroSlides } from "@/lib/home/hero";
import { getTrending } from "@/lib/catalog/recommendations";
import { getFeaturedBrands } from "@/lib/home/brands";
import { fetchFeaturedCategories } from "@/features/categories/api";

// Home is ISR — the hero slides are admin-managed and refetched periodically.
export const revalidate = 300;

export default async function Home() {
  const [heroSlides, trending, homeCategories, brands] = await Promise.all([
    getHeroSlides(),
    getTrending({ limit: 8 }),
    fetchFeaturedCategories(),
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
