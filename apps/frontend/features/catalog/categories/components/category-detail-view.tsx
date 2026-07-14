import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, PackageOpen } from "lucide-react";

import { JsonLd } from "@/components/json-ld";
import { getCategoryBySlug } from "@/features/catalog/categories/api";
import { listProducts } from "@/features/catalog/products/api/public";
import { ProductCard } from "@/features/catalog/products/components/product-card";
import { Placeholder } from "@/features/dashboard/components/placeholder";
import { faNum } from "@/lib/products";
import { breadcrumbLd, productListLd } from "@/lib/seo/jsonld";

type CategoryDetailViewProps = {
  params: Promise<{ category: string }>;
};

export async function CategoryDetailView({
  params,
}: CategoryDetailViewProps) {
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
