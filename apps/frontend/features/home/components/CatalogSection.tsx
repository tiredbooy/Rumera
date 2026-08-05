import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ProductListItem } from "@/features/catalog/products/types";
import { CatalogProductRail } from "@/features/home/components/catalog-product-rail";
import { Reveal } from "@/features/motion/components/reveal";
import { faNum } from "@/lib/products";

interface FilterChip {
  key: string;
  label: string;
  href: string;
}

interface CatalogSectionProps {
  filterChips: FilterChip[];
  products: ProductListItem[];
}

/**
 * Homepage catalogue strip — real ProductCards in a horizontal Swiper rail.
 * Chips deep-link into category/product routes; “all products” stays primary.
 */
export function CatalogSection({ filterChips, products }: CatalogSectionProps) {
  return (
    <section
      id="catalog"
      aria-labelledby="home-catalog-title"
      className="container-px mx-auto max-w-7xl pb-20"
    >
      <Reveal className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-3">تازه رسیده</p>
          <h2
            id="home-catalog-title"
            className="font-serif text-4xl sm:text-5xl"
          >
            منتخب فروشگاه
          </h2>
          {products.length > 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {faNum(products.length)} محصول برای شروع خرید
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filterChips.map((f, i) => (
            <Button
              key={f.key}
              size="sm"
              variant={i === 0 ? "default" : "outline"}
              className="h-10 rounded-full"
              asChild
            >
              <Link href={f.href}>{f.label}</Link>
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="hidden h-10 rounded-full sm:inline-flex"
            asChild
          >
            <Link href="/products">
              همهٔ محصولات
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="hidden h-10 rounded-full text-primary sm:inline-flex"
            asChild
          >
            <Link href="/brands">برندها</Link>
          </Button>
        </div>
      </Reveal>

      {products.length > 0 ? (
        <CatalogProductRail products={products} />
      ) : (
        <div className="border-hairline mt-10 flex flex-col items-center gap-3 rounded-3xl bg-card/40 px-6 py-16 text-center ring-1 ring-foreground/[0.04]">
          <p className="font-serif text-xl">هنوز محصول منتخبی نمایش داده نمی‌شود</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            پس از افزودن محصولات فعال، اینجا کارت‌های فروشگاهی با قیمت و موجودی
            واقعی ظاهر می‌شوند.
          </p>
          <Button variant="outline" asChild className="mt-2">
            <Link href="/products">رفتن به کاتالوگ</Link>
          </Button>
        </div>
      )}

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Button variant="default" asChild className="h-11 rounded-full px-5">
          <Link href="/products">
            مشاهدهٔ همهٔ محصولات
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
        </Button>
        <Button variant="outline" asChild className="h-11 rounded-full px-5">
          <Link href="/brands">انتخاب برند</Link>
        </Button>
      </div>
    </section>
  );
}
