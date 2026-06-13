import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { ShieldCheck, Truck } from "lucide-react"

import { buildMetadata } from "@/lib/seo/metadata"
import { JsonLd } from "@/components/json-ld"
import { productDetailLd, breadcrumbLd } from "@/lib/seo/jsonld"
import { getProductBySlug, allProductSlugs } from "@/lib/catalog/products"
import { faNum } from "@/lib/products"
import { Bottle } from "@/components/bottle"
import { ProductPurchasePanel } from "@/components/catalog/product-purchase-panel"

export const revalidate = 3600

export async function generateStaticParams() {
  return (await allProductSlugs()).map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) return buildMetadata({ title: "محصول یافت نشد", index: false })
  return buildMetadata({
    title: product.meta_title ?? product.title,
    description: product.meta_description ?? product.description,
    path: `/products/${product.slug}`,
    type: "article",
    images: product.images?.map((i) => i.image_url),
  })
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) notFound()

  const images = [...(product.images ?? [])].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order
  )
  const primary = images[0]

  return (
    <>
      <JsonLd
        data={[
          productDetailLd(product),
          breadcrumbLd([
            { name: "خانه", path: "/" },
            { name: "فروشگاه", path: "/products" },
            { name: product.title, path: `/products/${product.slug}` },
          ]),
        ]}
      />

      <section className="container-px mx-auto max-w-7xl py-12">
        <nav className="mb-8 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground">خانه</Link>
          <span>/</span>
          <Link href="/products" className="hover:text-foreground">فروشگاه</Link>
        </nav>

        <div className="grid gap-12 lg:grid-cols-2">
          {/* Visual */}
          <div className="cellar-glow border-hairline relative flex aspect-square items-center justify-center overflow-hidden rounded-[2rem] ring-1 ring-foreground/10">
            {primary ? (
              <Image
                src={primary.image_url}
                alt={primary.alt_text ?? product.title}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-contain p-10"
                priority
              />
            ) : (
              <Bottle product={{ id: product.id, maker: product.title }} className="relative h-[28rem]" />
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col">
            <h1 className="font-serif text-5xl leading-tight">{product.title}</h1>
            {product.country_of_origin ? (
              <p className="mt-2 text-muted-foreground">{product.country_of_origin}</p>
            ) : null}

            {product.description ? (
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                {product.description}
              </p>
            ) : null}

            {product.abv ? (
              <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-border/60 py-5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">درصد الکل</dt>
                  <dd>{faNum(product.abv)}٪</dd>
                </div>
              </dl>
            ) : null}

            <div className="mt-6">
              <ProductPurchasePanel product={product} />
            </div>

            <div className="mt-8 grid gap-3 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" /> اصالت تضمین‌شده، مستقیم از سازنده
              </p>
              <p className="flex items-center gap-2">
                <Truck className="size-4 text-primary" /> ارسال خنک و سریع به سراسر کشور
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
