import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  ShieldCheck,
  Truck,
  Wallet,
  Sparkles,
  Layers,
} from "lucide-react";

import { buildMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/json-ld";
import { productDetailLd, breadcrumbLd } from "@/lib/seo/jsonld";
import { getProductBySlug, allProductSlugs } from "@/lib/catalog/products";
import {
  getSimilar,
  getFrequentlyBoughtTogether,
} from "@/lib/catalog/recommendations";
import { getReviewSummary, listReviews } from "@/lib/catalog/reviews";
import { faNum } from "@/lib/products";
import { Bottle } from "@/components/bottle";
import { ProductGallery } from "@/features/catalog/components/product-gallery";
import { ProductPurchasePanel } from "@/features/catalog/components/product-purchase-panel";
import { RecommendationRail } from "@/features/catalog/components/recommendation-rail";
import { RecentlyViewedRail } from "@/features/catalog/components/recently-viewed-rail";
import { ReviewsSection } from "@/features/catalog/components/reviews-section";

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

// Trust signals shown beneath the buy box — the spirits-retail reassurance trio.
const TRUST = [
  {
    icon: ShieldCheck,
    title: "اصالت تضمین‌شده",
    desc: "مستقیم از سازندهٔ رسمی",
  },
  {
    icon: Truck,
    title: "ارسال خنک و سریع",
    desc: "بسته‌بندی ایمن، سراسر کشور",
  },
  { icon: Wallet, title: "پرداخت امن", desc: "درگاه بانکی و کیف پول" },
];

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const images = [...(product.images ?? [])].sort(
    (a, b) =>
      Number(b.is_primary) - Number(a.is_primary) ||
      a.sort_order - b.sort_order,
  );

  // Surface the recommendation engine + reviews (all error-safe → empty on failure).
  const [similar, fbtRaw, reviewSummary, reviewsPage] = await Promise.all([
    getSimilar(product.id, { limit: 8 }),
    getFrequentlyBoughtTogether(product.id, { limit: 4 }),
    getReviewSummary(product.id),
    listReviews(product.id, { limit: 8 }),
  ]);
  // FBT falls back to "similar" server-side — drop overlaps so the rails differ.
  const fbt = fbtRaw.filter(
    (f) => !similar.some((s) => s.product_id === f.product_id),
  );

  // For the recently-viewed memory.
  const variantPrices = (product.variants ?? [])
    .map((v) => v.price)
    .filter((n) => n > 0);
  const minPrice = variantPrices.length
    ? Math.min(...variantPrices)
    : undefined;

  // Best whole-percent saving across active variants → gallery ribbon.
  const galleryDiscount = (product.variants ?? [])
    .filter(
      (v) => v.is_active && v.compare_at_price && v.compare_at_price > v.price,
    )
    .reduce((best, v) => {
      const pct = Math.round(
        ((v.compare_at_price! - v.price) / v.compare_at_price!) * 100,
      );
      return Math.max(best, pct);
    }, 0);

  // Specs table — only render rows we actually have.
  const specs: { label: string; value: string }[] = [
    product.abv != null
      ? { label: "درصد الکل", value: `${faNum(product.abv)}٪` }
      : null,
    product.country_of_origin
      ? { label: "کشور مبدأ", value: product.country_of_origin }
      : null,
    product.weight != null
      ? { label: "وزن", value: `${faNum(product.weight)} گرم` }
      : null,
    product.code ? { label: "کد محصول", value: product.code } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <>
      <JsonLd
        data={[
          productDetailLd(
            product,
            reviewSummary
              ? {
                  value: reviewSummary.average_rating,
                  count: reviewSummary.total_reviews,
                }
              : undefined,
            reviewsPage.results.map((r) => ({
              rating: r.rating,
              title: r.title,
              content: r.content,
              author: r.user_full_name || undefined,
              created_at: r.created_at,
            })),
          ),
          breadcrumbLd([
            { name: "خانه", path: "/" },
            { name: "فروشگاه", path: "/products" },
            { name: product.title, path: `/products/${product.slug}` },
          ]),
        ]}
      />

      <section className="container-px mx-auto max-w-7xl py-10 sm:py-12">
        {/* Breadcrumb */}
        <nav
          aria-label="مسیر"
          className="mb-8 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Link href="/" className="transition-colors hover:text-foreground">
            خانه
          </Link>
          <ChevronLeft className="size-3.5 opacity-50" />
          <Link
            href="/products"
            className="transition-colors hover:text-foreground"
          >
            فروشگاه
          </Link>
          <ChevronLeft className="size-3.5 opacity-50" />
          <span className="truncate font-medium text-foreground">
            {product.title}
          </span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
          {/* Visual */}
          <ProductGallery
            images={images}
            title={product.title}
            discount={galleryDiscount}
            fallback={
              <Bottle
                product={{ id: product.id, maker: product.title }}
                className="relative h-[28rem]"
              />
            }
          />

          {/* Info — sticks within view as the gallery scrolls past on desktop */}
          <div className="flex flex-col lg:sticky lg:top-24 lg:self-start">
            {product.country_of_origin ? (
              <p className="eyebrow mb-3">{product.country_of_origin}</p>
            ) : null}
            <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
              {product.title}
            </h1>

            {reviewSummary && reviewSummary.total_reviews > 0 ? (
              <Link
                href="#reviews"
                className="mt-3 inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <span className="font-medium text-primary">
                  ★ {faNum(Number(reviewSummary.average_rating.toFixed(1)))}
                </span>
                ({faNum(reviewSummary.total_reviews)} نظر)
              </Link>
            ) : null}

            {product.tags && product.tags.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {product.tags.map((t) => (
                  <span
                    key={t.id}
                    className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
                  >
                    {t.title}
                  </span>
                ))}
              </div>
            ) : null}

            {product.description ? (
              <p className="mt-6 leading-relaxed text-muted-foreground">
                {product.description}
              </p>
            ) : null}

            {/* Purchase panel (owns variant selection + wishlist) */}
            <div className="shadow-e2 relative mt-7 overflow-hidden rounded-3xl border border-border/60 bg-card/60 p-5 backdrop-blur-sm sm:p-6">
              <div aria-hidden className="rule-gold absolute inset-x-6 top-0" />
              <ProductPurchasePanel product={product} />
            </div>

            {/* Specs */}
            {specs.length ? (
              <dl className="mt-7 grid grid-cols-1 gap-x-8 gap-y-3 border-t border-border/60 pt-6 text-sm sm:grid-cols-2">
                {specs.map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center justify-between gap-3"
                  >
                    <dt className="text-muted-foreground">{s.label}</dt>
                    <dd className="font-medium">{s.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {/* Trust row */}
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {TRUST.map((t) => (
                <div
                  key={t.title}
                  className="flex items-center gap-3 rounded-2xl border border-border/50 bg-secondary/40 p-3 transition-colors hover:border-primary/30 sm:flex-col sm:items-start sm:gap-1.5 sm:p-4"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10">
                    <t.icon className="size-4.5" />
                  </span>
                  <div className="leading-tight">
                    <p className="text-xs font-semibold">{t.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Reviews */}
      <div
        id="reviews"
        className="border-t border-border/60 bg-card/30 scroll-mt-24"
      >
        <ReviewsSection
          productId={product.id}
          summary={reviewSummary}
          initialReviews={reviewsPage.results}
          initialHasNext={reviewsPage.pagination.has_next}
        />
      </div>

      {/* Frequently bought together */}
      {fbt.length ? (
        <RecommendationRail
          items={fbt}
          eyebrow="تکمیل سبد"
          title="اغلب با هم خریده می‌شوند"
          icon={Layers}
          className="container-px mx-auto max-w-7xl py-16 sm:py-20"
        />
      ) : null}

      {/* Similar products */}
      {similar.length ? (
        <div className="border-t border-border/60 bg-card/30">
          <RecommendationRail
            items={similar.slice(0, 4)}
            eyebrow="هم‌سلیقه با این"
            title="شاید این‌ها را هم بپسندید"
            icon={Sparkles}
            className="container-px mx-auto max-w-7xl py-16 sm:py-20"
          />
        </div>
      ) : null}

      {/* Recently viewed (records this product) */}
      <RecentlyViewedRail
        current={{
          slug: product.slug,
          title: product.title,
          image: images[0]?.image_url,
          price: minPrice,
        }}
        currentProductId={product.id}
        className="container-px mx-auto max-w-7xl py-12"
      />

      {/* Spacer so the sticky mobile buy-bar never covers page-end content. */}
      <div aria-hidden className="h-24 lg:hidden" />
    </>
  );
}
