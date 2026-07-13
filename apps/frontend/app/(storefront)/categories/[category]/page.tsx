import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PackageOpen, ChevronLeft } from "lucide-react";

import { buildMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbLd, productListLd } from "@/lib/seo/jsonld";
import {
  getCategoryBySlug,
  listCategories,
} from "@/features/catalog/categories/api";
import { listProducts } from "@/features/catalog/products/api/public";
import { faNum } from "@/lib/products";
import { ProductCard } from "@/features/catalog/products/components/product-card";
import { Placeholder } from "@/features/dashboard/components/placeholder";

export const revalidate = 3600;

export async function generateStaticParams() {
  return (await listCategories()).flatMap((c) =>
    c.slug ? [{ category: c.slug }] : [],
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const cat = await getCategoryBySlug(category);
  if (!cat) return buildMetadata({ title: "دسته یافت نشد", index: false });
  return buildMetadata({
    title: cat.title,
    description: cat.description ?? `خرید ${cat.title} از مجموعهٔ منتخب رومرا.`,
    path: `/categories/${category}`,
  });
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const cat = await getCategoryBySlug(category);
  if (!cat) notFound();

  const { results, pagination } = await listProducts({
    category_id: cat.id,
    limit: 24,
  });

  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "خانه", path: "/" },
            { name: "فروشگاه", path: "/products" },
            { name: cat.title, path: `/categories/${category}` },
          ]),
          productListLd(cat.title, results),
        ]}
      />

      {/* Category hero */}
      <section className="cellar-glow border-b border-border/60">
        <div className="container-px mx-auto max-w-7xl py-12 sm:py-16">
          <nav
            aria-label="مسیر"
            className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
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
            <span className="font-medium text-foreground">{cat.title}</span>
          </nav>
          <p className="eyebrow mb-3">دسته‌بندی</p>
          <h1 className="section-title">{cat.title}</h1>
          {cat.description ? (
            <p className="mt-4 max-w-2xl text-muted-foreground">
              {cat.description}
            </p>
          ) : null}
          <p className="mt-4 text-sm text-muted-foreground">
            {`${faNum(pagination.total_items)} محصول در این دسته`}
          </p>
        </div>
      </section>

      <section className="container-px mx-auto max-w-7xl py-12 sm:py-14">
        {results.length ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <Placeholder
            icon={PackageOpen}
            title="محصولی در این دسته نیست"
            description="به‌زودی محصولاتی در این دسته اضافه می‌شود."
          />
        )}
      </section>
    </>
  );
}
