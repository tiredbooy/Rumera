import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ChevronLeft,
  ShieldCheck,
  Truck,
  Wallet,
  Sparkles,
  ArrowLeft,
} from "lucide-react"

import { buildMetadata } from "@/lib/seo/metadata"
import { JsonLd } from "@/components/json-ld"
import { productDetailLd, breadcrumbLd } from "@/lib/seo/jsonld"
import {
  getProductBySlug,
  allProductSlugs,
  listProducts,
} from "@/lib/catalog/products"
import { faNum } from "@/lib/products"
import { Bottle } from "@/components/bottle"
import { Reveal } from "@/components/motion/reveal"
import { ProductGallery } from "@/components/catalog/product-gallery"
import { ProductPurchasePanel } from "@/components/catalog/product-purchase-panel"
import { ProductCard } from "@/components/catalog/product-card"

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

// Trust signals shown beneath the buy box — the spirits-retail reassurance trio.
const TRUST = [
  { icon: ShieldCheck, title: "اصالت تضمین‌شده", desc: "مستقیم از سازندهٔ رسمی" },
  { icon: Truck, title: "ارسال خنک و سریع", desc: "بسته‌بندی ایمن، سراسر کشور" },
  { icon: Wallet, title: "پرداخت امن", desc: "درگاه بانکی و کیف پول" },
]

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

  // Same-category recommendations for the "you may also like" rail.
  const related = product.category_id
    ? (await listProducts({ category_id: product.category_id, limit: 5 })).results
        .filter((p) => p.id !== product.id)
        .slice(0, 4)
    : []

  // Specs table — only render rows we actually have.
  const specs: { label: string; value: string }[] = [
    product.abv != null ? { label: "درصد الکل", value: `${faNum(product.abv)}٪` } : null,
    product.country_of_origin
      ? { label: "کشور مبدأ", value: product.country_of_origin }
      : null,
    product.weight != null ? { label: "وزن", value: `${faNum(product.weight)} گرم` } : null,
    product.code ? { label: "کد محصول", value: product.code } : null,
  ].filter(Boolean) as { label: string; value: string }[]

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

      <section className="container-px mx-auto max-w-7xl py-10 sm:py-12">
        {/* Breadcrumb */}
        <nav
          aria-label="مسیر"
          className="mb-8 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Link href="/" className="transition-colors hover:text-foreground">خانه</Link>
          <ChevronLeft className="size-3.5 opacity-50" />
          <Link href="/products" className="transition-colors hover:text-foreground">فروشگاه</Link>
          <ChevronLeft className="size-3.5 opacity-50" />
          <span className="truncate font-medium text-foreground">{product.title}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
          {/* Visual */}
          <ProductGallery
            images={images}
            title={product.title}
            fallback={
              <Bottle product={{ id: product.id, maker: product.title }} className="relative h-[28rem]" />
            }
          />

          {/* Info — sticks within view as the gallery scrolls past on desktop */}
          <div className="flex flex-col lg:sticky lg:top-24 lg:self-start">
            {product.country_of_origin ? (
              <p className="eyebrow mb-3">{product.country_of_origin}</p>
            ) : null}
            <h1 className="font-serif text-4xl leading-tight sm:text-5xl">{product.title}</h1>

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
              <p className="mt-6 leading-relaxed text-muted-foreground">{product.description}</p>
            ) : null}

            {/* Purchase panel */}
            <div className="mt-7 rounded-3xl border border-border/60 bg-card/50 p-5 sm:p-6">
              <ProductPurchasePanel product={product} />
            </div>

            {/* Specs */}
            {specs.length ? (
              <dl className="mt-7 grid grid-cols-1 gap-x-8 gap-y-3 border-t border-border/60 pt-6 text-sm sm:grid-cols-2">
                {specs.map((s) => (
                  <div key={s.label} className="flex items-center justify-between gap-3">
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
                  className="flex items-center gap-3 rounded-2xl bg-secondary/40 p-3 sm:flex-col sm:items-start sm:gap-1.5 sm:p-4"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <t.icon className="size-4.5" />
                  </span>
                  <div className="leading-tight">
                    <p className="text-xs font-semibold">{t.title}</p>
                    <p className="text-[11px] text-muted-foreground">{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* You may also like */}
      {related.length ? (
        <section className="border-t border-border/60 bg-card/30">
          <div className="container-px mx-auto max-w-7xl py-16 sm:py-20">
            <Reveal className="flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow mb-3">
                  <Sparkles className="size-3.5" /> هم‌سلیقه با این
                </p>
                <h2 className="font-serif text-3xl sm:text-4xl">شاید این‌ها را هم بپسندید</h2>
              </div>
            </Reveal>
            <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
              {related.map((p, i) => (
                <Reveal key={p.id} delay={Math.min(i, 4) * 0.05} y={20}>
                  <ProductCard product={p} />
                </Reveal>
              ))}
            </div>
            <div className="mt-10 flex justify-center">
              <Link
                href="/products"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-foreground"
              >
                مشاهدهٔ همهٔ محصولات <ArrowLeft className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      ) : null}
    </>
  )
}
