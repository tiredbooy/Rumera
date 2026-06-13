import type { Metadata } from "next"

import { buildMetadata } from "@/lib/seo/metadata"
import { listProducts } from "@/lib/catalog/products"
import { faNum } from "@/lib/products"
import { ProductCard } from "@/components/catalog/product-card"

export const metadata: Metadata = buildMetadata({ title: "جستجو", path: "/search", index: false })

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q = "" } = await searchParams
  const query = q.trim()
  const { results } = query ? await listProducts({ search: query, limit: 24 }) : { results: [] }

  return (
    <section className="container-px mx-auto max-w-7xl py-14">
      <h1 className="font-serif text-4xl">جستجو</h1>
      {query ? (
        <p className="mt-2 text-muted-foreground">
          {`${faNum(results.length)} نتیجه برای «${query}»`}
        </p>
      ) : (
        <p className="mt-2 text-muted-foreground">عبارتی برای جستجو وارد کنید.</p>
      )}

      {results.length ? (
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : null}
    </section>
  )
}
