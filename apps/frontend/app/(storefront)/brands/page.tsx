import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Tag } from "lucide-react";

import { listBrands } from "@/features/catalog/brands/api";
import { productListBrandHref } from "@/features/catalog/products/list-routing";
import { Placeholder } from "@/features/dashboard/components/placeholder";
import { buildMetadata } from "@/lib/seo/metadata";
import { faNum } from "@/lib/products";

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
    <section className="container-px mx-auto w-full max-w-7xl py-14">
      <p className="eyebrow mb-3">کاتالوگ</p>
      <h1 className="font-serif text-5xl">برندها</h1>
      <p className="mt-3 max-w-xl text-muted-foreground">
        {loadError
          ? "فعلاً فهرست برندها در دسترس نیست."
          : brands.length
            ? `${faNum(brands.length)} برند — برای دیدن محصولات هر برند را انتخاب کنید.`
            : "هنوز برندی برای نمایش ثبت نشده است."}
      </p>

      <div className="mt-6">
        <Link
          href="/products"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        >
          همهٔ محصولات
          <ArrowLeft className="size-4" aria-hidden />
        </Link>
      </div>

      {loadError ? (
        <div className="mt-10">
          <Placeholder
            icon={Tag}
            title="بارگذاری برندها ناموفق بود"
            description="بعداً دوباره تلاش کنید یا از فهرست محصولات استفاده کنید."
          />
        </div>
      ) : brands.length === 0 ? (
        <div className="mt-10">
          <Placeholder
            icon={Tag}
            title="برندی نیست"
            description="پس از افزودن برند در پنل مدیریت، اینجا فهرست می‌شوند."
          />
        </div>
      ) : (
        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => (
            <li key={brand.id}>
              <Link
                href={productListBrandHref(brand.id)}
                className="border-hairline flex min-h-16 items-center justify-between gap-3 rounded-2xl bg-card px-5 py-4 ring-1 ring-foreground/5 transition-colors hover:border-primary/30 hover:bg-accent/40"
              >
                <span className="font-serif text-lg">{brand.title}</span>
                <ArrowLeft
                  className="size-4 shrink-0 text-primary"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
