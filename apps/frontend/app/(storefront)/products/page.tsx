import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, ArrowLeft, PackageOpen } from "lucide-react"

import { buildMetadata } from "@/lib/seo/metadata"
import { JsonLd } from "@/components/json-ld"
import { breadcrumbLd, productListLd } from "@/lib/seo/jsonld"
import { buildQuery } from "@/lib/api/qs"
import { listProducts } from "@/lib/catalog/products"
import { listCategories } from "@/lib/catalog/categories"
import { faNum } from "@/lib/products"
import { Button } from "@/components/ui/button"
import { ProductCard } from "@/components/catalog/product-card"
import { Placeholder } from "@/components/dashboard/placeholder"

export const metadata: Metadata = buildMetadata({
  title: "فروشگاه بطری‌ها",
  description:
    "کاوش در مجموعهٔ کامل رومرا — ویسکی، شراب، شامپاین و اسپیریت‌های نایاب، مستقیم از سازندگان.",
  path: "/products",
})

type SP = { page?: string; search?: string; sortBy?: string }

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SP>
}) {
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page) || 1)
  const search = sp.search?.trim() || undefined

  const [data, categories] = await Promise.all([
    listProducts({ page, limit: 12, search, sortBy: sp.sortBy }),
    listCategories(),
  ])
  const { results, pagination } = data

  const pageHref = (p: number) => `/products${buildQuery({ page: p, search, sortBy: sp.sortBy })}`

  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "خانه", path: "/" },
            { name: "فروشگاه", path: "/products" },
          ]),
          productListLd("همهٔ بطری‌ها", results),
        ]}
      />

      <section className="container-px mx-auto max-w-7xl py-14">
        <p className="eyebrow mb-3">کاتالوگ کامل</p>
        <h1 className="font-serif text-5xl">فروشگاه بطری‌ها</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          {`${faNum(pagination.total_items)} برچسب منتخب — بر اساس دسته مرور کنید یا همه را ببینید.`}
        </p>

        {categories.length ? (
          <div className="mt-8 flex flex-wrap gap-2">
            <span className="rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground">
              همه
            </span>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/categories/${c.slug}`}
                className="rounded-full border border-border px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {c.name}
              </Link>
            ))}
          </div>
        ) : null}

        {results.length ? (
          <>
            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {results.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {pagination.total_pages > 1 ? (
              <div className="mt-12 flex items-center justify-center gap-3">
                <Button variant="outline" size="sm" disabled={!pagination.has_prev} asChild={pagination.has_prev}>
                  {pagination.has_prev ? (
                    <Link href={pageHref(page - 1)}>
                      <ArrowRight className="size-4" /> قبلی
                    </Link>
                  ) : (
                    <span>
                      <ArrowRight className="size-4" /> قبلی
                    </span>
                  )}
                </Button>
                <span className="text-sm text-muted-foreground">
                  صفحهٔ {faNum(pagination.page)} از {faNum(pagination.total_pages)}
                </span>
                <Button variant="outline" size="sm" disabled={!pagination.has_next} asChild={pagination.has_next}>
                  {pagination.has_next ? (
                    <Link href={pageHref(page + 1)}>
                      بعدی <ArrowLeft className="size-4" />
                    </Link>
                  ) : (
                    <span>
                      بعدی <ArrowLeft className="size-4" />
                    </span>
                  )}
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="mt-10">
            <Placeholder
              icon={PackageOpen}
              title="محصولی برای نمایش نیست"
              description="در حال حاضر محصولی یافت نشد. اگر سرویس در دسترس نیست، بعداً دوباره تلاش کنید."
            />
          </div>
        )}
      </section>
    </>
  )
}
