import Link from "next/link"
import {
  ArrowRight,
  Truck,
  ShieldCheck,
  Sparkles,
  Leaf,
  Star,
  Quote,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ProductCard } from "@/components/product-card"
import { Bottle } from "@/components/bottle"
import { categories, getFeatured, products } from "@/lib/products"

const perks = [
  { icon: Truck, title: "Chilled overnight", desc: "Temperature-controlled delivery" },
  { icon: ShieldCheck, title: "Guaranteed authentic", desc: "Every bottle, sourced direct" },
  { icon: Sparkles, title: "Curated by sommeliers", desc: "Hand-picked, never algorithmic" },
  { icon: Leaf, title: "Carbon-neutral", desc: "Offset on every order" },
]

export default function Home() {
  const featured = getFeatured()
  const hero = products[0]

  return (
    <>
      {/* ───────────────────────── Hero ───────────────────────── */}
      <section className="cellar-glow relative overflow-hidden border-b border-border/60">
        <div className="container-px mx-auto grid max-w-7xl items-center gap-12 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <div className="flex flex-col items-start">
            <p className="eyebrow mb-5">
              <Sparkles className="size-3.5" /> The cellar, reimagined
            </p>
            <h1 className="font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Rare bottles,
              <br />
              <span className="text-foil">poured with intent.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg text-muted-foreground">
              A curated collection of single malts, old-world wine and grower
              champagne — sourced direct from the makers and delivered to your
              door, cold and fast.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" className="h-12 px-6 text-sm" asChild>
                <Link href="#catalog">
                  Shop the collection <ArrowRight />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-6 text-sm"
                asChild
              >
                <Link href="#story">Discover Rumera</Link>
              </Button>
            </div>
            <dl className="mt-12 grid grid-cols-3 gap-8 border-t border-border/60 pt-8">
              {[
                ["1,200+", "rare labels"],
                ["38", "countries"],
                ["4.9★", "from 12k reviews"],
              ].map(([stat, label]) => (
                <div key={label}>
                  <dt className="font-serif text-3xl text-foil">{stat}</dt>
                  <dd className="mt-1 text-xs uppercase tracking-[0.15em] text-muted-foreground">
                    {label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Hero bottle showcase */}
          <div className="relative">
            <div className="border-hairline relative mx-auto flex aspect-4/5 max-w-md items-end justify-center overflow-hidden rounded-[2rem] bg-gradient-to-b from-card to-background ring-1 ring-foreground/10">
              <div
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(70% 50% at 50% 110%, ${hero.hue[0]}, transparent 65%)`,
                }}
              />
              <Badge className="absolute left-6 top-6 bg-gold text-gold-foreground">
                Editor&apos;s pick
              </Badge>
              <Bottle product={hero} className="relative mb-0 h-[26rem]" />
              <div className="border-hairline absolute bottom-6 left-6 right-6 flex items-center justify-between rounded-2xl bg-background/70 p-4 backdrop-blur-md">
                <div>
                  <p className="font-serif text-lg leading-tight">{hero.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {hero.origin} · {hero.abv}% ABV
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-sm text-primary">
                  <Star className="size-3.5 fill-primary" /> {hero.rating}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────── Perks ───────────────────────── */}
      <section className="border-b border-border/60 bg-card/30">
        <div className="container-px mx-auto grid max-w-7xl gap-6 py-10 sm:grid-cols-2 lg:grid-cols-4">
          {perks.map((perk) => (
            <div key={perk.title} className="flex items-center gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <perk.icon className="size-5" />
              </span>
              <div>
                <p className="text-sm font-medium">{perk.title}</p>
                <p className="text-xs text-muted-foreground">{perk.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────────────────── Categories ───────────────────────── */}
      <section id="categories" className="container-px mx-auto max-w-7xl py-20">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-3">Browse by craft</p>
            <h2 className="font-serif text-4xl tracking-tight">Explore the cellar</h2>
          </div>
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="#catalog">
              View all <ArrowRight />
            </Link>
          </Button>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {categories.map((cat, i) => {
            const sample = products.find((p) => p.category === cat.name) ?? products[0]
            return (
              <Link
                key={cat.name}
                href="#catalog"
                className={`group/cat border-hairline relative flex flex-col justify-between overflow-hidden rounded-3xl bg-card p-6 ring-1 ring-foreground/5 transition-all hover:-translate-y-1 hover:ring-primary/30 ${
                  i === 0 ? "col-span-2 row-span-2 min-h-72" : "min-h-36"
                }`}
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-60 transition-opacity group-hover/cat:opacity-100"
                  style={{
                    background: `radial-gradient(80% 70% at 100% 100%, ${sample.hue[0]}, transparent 60%)`,
                  }}
                />
                <div className="relative">
                  <h3 className="font-serif text-2xl">{cat.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{cat.tagline}</p>
                </div>
                <span className="relative mt-4 inline-flex items-center gap-1 text-sm text-primary opacity-0 transition-opacity group-hover/cat:opacity-100">
                  Shop {cat.name} <ArrowRight className="size-4" />
                </span>
                {i === 0 ? (
                  <Bottle
                    product={sample}
                    className="absolute -bottom-6 right-2 h-56 opacity-90"
                  />
                ) : null}
              </Link>
            )
          })}
        </div>
      </section>

      {/* ───────────────────────── Catalog ───────────────────────── */}
      <section id="catalog" className="container-px mx-auto max-w-7xl pb-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-3">Just landed</p>
            <h2 className="font-serif text-4xl tracking-tight">Featured bottles</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {["All", "Whisky", "Wine", "Champagne", "Spirits"].map((f, i) => (
              <Button
                key={f}
                size="sm"
                variant={i === 0 ? "default" : "outline"}
                className="rounded-full"
              >
                {f}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* ───────────────────────── Story ───────────────────────── */}
      <section id="story" className="border-y border-border/60 bg-card/30">
        <div className="container-px mx-auto grid max-w-7xl items-center gap-12 py-20 lg:grid-cols-2">
          <div className="cellar-glow border-hairline relative flex aspect-square items-center justify-center overflow-hidden rounded-[2rem] ring-1 ring-foreground/10">
            <div className="flex items-end gap-3">
              {products.slice(2, 6).map((p, i) => (
                <Bottle
                  key={p.id}
                  product={p}
                  className={`h-48 ${i % 2 ? "h-56" : "h-44"}`}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="eyebrow mb-4">Our story</p>
            <h2 className="font-serif text-4xl leading-tight tracking-tight sm:text-5xl">
              We travel the world so your glass doesn&apos;t have to.
            </h2>
            <p className="mt-5 text-muted-foreground">
              Rumera began with a simple frustration: the best bottles never made
              it past the distillery gates. So we built relationships with the
              makers themselves — independent distillers, grower-producers and
              family estates — and bring their finest releases straight to you.
            </p>
            <p className="mt-4 text-muted-foreground">
              Every label is tasted and approved by our team before it earns a
              place in the cellar. No fillers, no middlemen, no compromise.
            </p>
            <Button size="lg" className="mt-8 h-12 px-6 text-sm" asChild>
              <Link href="#catalog">
                Start exploring <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ───────────────────────── Testimonial ───────────────────────── */}
      <section className="container-px mx-auto max-w-4xl py-24 text-center">
        <Quote className="mx-auto size-10 text-primary/40" />
        <blockquote className="mt-6 font-serif text-3xl leading-snug tracking-tight sm:text-4xl">
          “The closest thing to having a sommelier, a whisky buyer and a
          concierge — all in one beautiful little app.”
        </blockquote>
        <div className="mt-8 flex items-center justify-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/15 font-serif text-primary">
            E
          </span>
          <div className="text-left">
            <p className="text-sm font-medium">Elena Marchetti</p>
            <p className="text-xs text-muted-foreground">Member since 2021</p>
          </div>
        </div>
      </section>

      {/* ───────────────────────── Final CTA ───────────────────────── */}
      <section className="container-px mx-auto max-w-7xl pb-24">
        <div className="cellar-glow border-hairline relative overflow-hidden rounded-[2.5rem] px-8 py-16 text-center ring-1 ring-foreground/10 sm:px-16 sm:py-20">
          <p className="eyebrow mb-4 justify-center">Become a member</p>
          <h2 className="mx-auto max-w-2xl font-serif text-4xl leading-tight tracking-tight sm:text-5xl">
            Get first pour on rare releases.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-muted-foreground">
            Members unlock allocation drops, member-only pricing and a complimentary
            chilled delivery on every order.
          </p>
          <div className="mt-8 flex justify-center">
            <Button size="lg" className="h-12 px-8 text-sm" asChild>
              <Link href="#catalog">
                Join Rumera free <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
