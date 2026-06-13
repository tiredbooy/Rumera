import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PackageOpen } from "lucide-react"

import { buildMetadata } from "@/lib/seo/metadata"
import { JsonLd } from "@/components/json-ld"
import { breadcrumbLd, productListLd } from "@/lib/seo/jsonld"
import { listCategories, getCategoryBySlug } from "@/lib/catalog/categories"
import { listProducts } from "@/lib/catalog/products"
import { faNum } from "@/lib/products"
import { ProductCard } from "@/components/catalog/product-card"
import { Placeholder } from "@/components/dashboard/placeholder"

export const revalidate = 3600

export async function generateStaticParams() {
  return (await listCategories()).map((c) => ({ category: c.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>
}): Promise<Metadata> {
  const { category } = await params
  const cat = await getCategoryBySlug(category)
  if (!cat) return buildMetadata({ title: "دسته یافت نشد", index: false })
  return buildMetadata({
    title: cat.name,
    description: cat.description ?? `خرید ${cat.name} از مجموعهٔ منتخب رومرا.`,
    path: `/categories/${cat.slug}`,
  })
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category } = await params
  const cat = await getCategoryBySlug(category)
  if (!cat) notFound()

  const { results, pagination } = await listProducts({ category_id: cat.id, limit: 24 })

  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "خانه", path: "/" },
            { name: "فروشگاه", path: "/products" },
            { name: cat.name, path: `/categories/${cat.slug}` },
          ]),
          productListLd(cat.name, results),
        ]}
      />

      <section className="container-px mx-auto max-w-7xl py-14">
        <p className="eyebrow mb-3">دسته‌بندی</p>
        <h1 className="font-serif text-5xl">{cat.name}</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          {cat.description ?? `${faNum(pagination.total_items)} محصول در این دسته`}
        </p>

        {results.length ? (
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="mt-10">
            <Placeholder
              icon={PackageOpen}
              title="محصولی در این دسته نیست"
              description="به‌زودی محصولاتی در این دسته اضافه می‌شود."
            />
          </div>
        )}
      </section>
    </>
  )
}
