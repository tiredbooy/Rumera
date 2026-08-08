import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Globe2, Tag } from "lucide-react";

import { listBrands } from "@/features/catalog/brands/api";
import { productListBrandHref } from "@/features/catalog/products/list-routing";
import { Placeholder } from "@/features/dashboard/components/placeholder";
import { StorefrontMedia } from "@/components/storefront-media";
import { buildMetadata } from "@/lib/seo/metadata";
import { faNum } from "@/lib/products";
import { cn } from "@/lib/utils";

export const metadata: Metadata = buildMetadata({
  title: "برندها",
  description: "مرور برندهای رومرا و رفتن مستقیم به محصولات هر برند.",
  path: "/brands",
});

export default async function BrandsIndexPage() {
  let brands: Awaited<ReturnType<typeof listBrands>>["results"] = [];
  let loadError = false;
  try {
    const page = await listBrands({
      limit: 100,
      sortBy: "title",
      orderBy: "asc",
    });
    brands = page.results ?? [];
  } catch {
    loadError = true;
  }

  return (
    <section className="container-px mx-auto w-full max-w-7xl py-12 sm:py-16">
      <header className="max-w-2xl">
        <p className="eyebrow mb-3">کاتالوگ</p>
        <h1 className="font-serif text-4xl leading-tight sm:text-5xl">برندها</h1>
        <p className="mt-3 text-muted-foreground sm:text-lg">
          {loadError
            ? "فعلاً فهرست برندها در دسترس نیست."
            : brands.length
              ? `${faNum(brands.length)} برند منتخب — برای دیدن محصولات هر برند را انتخاب کنید.`
              : "هنوز برندی برای نمایش ثبت نشده است."}
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/products"
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-e1 transition-opacity hover:opacity-90"
          >
            همهٔ محصولات
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border bg-card px-5 text-sm font-medium text-foreground transition-colors hover:bg-accent/50"
          >
            بازگشت به خانه
          </Link>
        </div>
      </header>

      {loadError ? (
        <div className="mt-12">
          <Placeholder
            icon={Tag}
            title="بارگذاری برندها ناموفق بود"
            description="بعداً دوباره تلاش کنید یا از فهرست محصولات استفاده کنید."
          />
        </div>
      ) : brands.length === 0 ? (
        <div className="mt-12">
          <Placeholder
            icon={Tag}
            title="برندی نیست"
            description="پس از افزودن برند در پنل مدیریت، اینجا فهرست می‌شوند."
          />
        </div>
      ) : (
        <ul
          className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4"
          aria-label="فهرست برندها"
        >
          {brands.map((brand) => {
            const monogram = brand.title.trim().charAt(0) || "ب";
            const meta = [
              brand.country?.trim(),
              brand.founded_year
                ? `تأسیس ${brand.founded_year.toLocaleString("fa-IR", { useGrouping: false })}`
                : undefined,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <li key={brand.id} className="min-w-0">
                <Link
                  href={productListBrandHref(brand.slug)}
                  className={cn(
                    "group/brand border-hairline shadow-e1 flex h-full min-h-28 flex-col overflow-hidden rounded-3xl bg-card ring-1 ring-foreground/5",
                    "transition-[transform,box-shadow,border-color] duration-300 ease-cellar",
                    "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-e3",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    "motion-reduce:transform-none motion-reduce:transition-none",
                  )}
                  aria-label={`محصولات برند ${brand.title}`}
                >
                  <div className="relative aspect-[16/9] overflow-hidden bg-secondary">
                    <StorefrontMedia
                      slot="brand-tile"
                      src={brand.image_url}
                      alt={brand.title}
                      monogram={monogram}
                      className="transition-transform duration-300 ease-cellar group-hover/brand:scale-[1.03] motion-reduce:transform-none motion-reduce:transition-none"
                    />
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background/70 to-transparent"
                    />
                  </div>

                  <div className="flex flex-1 flex-col gap-2 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="min-w-0 font-serif text-xl leading-snug transition-colors group-hover/brand:text-primary">
                        {brand.title}
                      </h2>
                      <span className="mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/80 text-primary shadow-e1">
                        <ArrowLeft
                          className="size-4 transition-transform duration-200 group-hover/brand:-translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none"
                          aria-hidden
                        />
                      </span>
                    </div>

                    {meta ? (
                      <p className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                        <Globe2 className="size-3.5 shrink-0 opacity-70" aria-hidden />
                        <span className="truncate">{meta}</span>
                      </p>
                    ) : null}

                    {brand.description?.trim() ? (
                      <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                        {brand.description.trim()}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        مشاهدهٔ محصولات این برند
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
