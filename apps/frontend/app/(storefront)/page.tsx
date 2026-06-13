import Link from "next/link"
import {
  ArrowLeft,
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
import { Reveal } from "@/components/motion/reveal"
import { BrandMarquee } from "@/components/brand-marquee"
import { HomeStructuredData } from "@/components/structured-data"
import { categories, categoryFa, faNum, getFeatured, products } from "@/lib/products"

const perks = [
  { icon: Truck, title: "ارسال خنک یک‌شبه", desc: "تحویل با کنترل کامل دما" },
  { icon: ShieldCheck, title: "اصالت تضمین‌شده", desc: "هر بطری، مستقیم از سازنده" },
  { icon: Sparkles, title: "منتخب سومِلیه‌ها", desc: "دست‌چین، نه الگوریتمی" },
  { icon: Leaf, title: "بدون ردپای کربن", desc: "جبران کربن در هر سفارش" },
]

// Unique makers power the trust marquee — derived so it never drifts from the catalogue.
const makers = Array.from(new Set(products.map((p) => p.maker)))

// Catalogue filter chips (Persian) — first is the active "all".
const filters = ["همه", "ویسکی", "شراب", "شامپاین", "اسپیریت"]

export default function Home() {
  const featured = getFeatured()
  const hero = products[0]

  return (
    <>
      {/* SEO: Organization + WebSite + ItemList rich results (zero client JS) */}
      <HomeStructuredData />

      {/* ───────────────────────── Hero ───────────────────────── */}
      <section className="cellar-glow relative overflow-hidden border-b border-border/60">
        <div className="container-px mx-auto grid max-w-7xl items-center gap-12 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <div className="flex flex-col items-start">
            <p className="eyebrow mb-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
              <Sparkles className="size-3.5" /> سردابه، بازآفرینی‌شده
            </p>
            {/* Hero copy is intentionally NOT JS-animated so it paints instantly (fast LCP). */}
            <h1 className="font-serif text-6xl leading-[1.05] sm:text-7xl lg:text-8xl">
              بطری‌های نایاب،
              <br />
              <span className="text-foil">با وسواس برگزیده.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg text-muted-foreground">
              مجموعه‌ای منتخب از تک‌مالت‌ها، شراب‌های دنیای قدیم و شامپاین
              تولیدکننده — مستقیم از سازندگان تهیه و خنک و سریع به درِ خانهٔ شما
              می‌رسد.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" className="h-12 px-6 text-sm" asChild>
                <Link href="#catalog">
                  خرید از مجموعه <ArrowLeft />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-6 text-sm"
                asChild
              >
                <Link href="#story">آشنایی با رومرا</Link>
              </Button>
            </div>
            <dl className="mt-12 grid grid-cols-3 gap-8 border-t border-border/60 pt-8">
              {[
                ["+۱٬۲۰۰", "برچسب کمیاب"],
                ["۳۸", "کشور"],
                ["★۴٫۹", "از ۱۲ هزار نظر"],
              ].map(([stat, label]) => (
                <div key={label}>
                  <dt className="font-serif text-4xl text-foil">{stat}</dt>
                  <dd className="mt-1 text-xs text-muted-foreground">{label}</dd>
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
              <Badge className="absolute start-6 top-6 bg-gold text-gold-foreground">
                انتخاب سردبیر
              </Badge>
              <Bottle product={hero} className="relative mb-0 h-[26rem]" />
              <div className="border-hairline absolute bottom-6 left-6 right-6 flex items-center justify-between rounded-2xl bg-background/70 p-4 backdrop-blur-md">
                <div>
                  <p className="font-serif text-xl leading-tight">{hero.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {hero.origin} · {faNum(hero.abv)}٪ الکل
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-sm text-primary">
                  <Star className="size-3.5 fill-primary" /> {faNum(hero.rating)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────── Perks ───────────────────────── */}
      <section className="border-b border-border/60 bg-card/30">
        <div className="container-px mx-auto grid max-w-7xl gap-6 py-10 sm:grid-cols-2 lg:grid-cols-4">
          {perks.map((perk, i) => (
            <Reveal key={perk.title} delay={i * 0.06} y={12}>
              <div className="flex items-center gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <perk.icon className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-medium">{perk.title}</p>
                  <p className="text-xs text-muted-foreground">{perk.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ───────────────────────── Maker marquee ───────────────────────── */}
      <section className="border-b border-border/60 py-8">
        <div className="container-px mx-auto max-w-7xl">
          <p className="eyebrow mb-5 justify-center text-center">
            مستقیم از سازندگان
          </p>
          <BrandMarquee items={makers} />
        </div>
      </section>

      {/* ───────────────────────── Categories ───────────────────────── */}
      <section id="categories" className="container-px mx-auto max-w-7xl py-20">
        <Reveal className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-3">مرور بر اساس هنرِ ساخت</p>
            <h2 className="font-serif text-5xl">سردابه را کاوش کنید</h2>
          </div>
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="#catalog">
              مشاهدهٔ همه <ArrowLeft />
            </Link>
          </Button>
        </Reveal>

        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {categories.map((cat, i) => {
            const sample = products.find((p) => p.category === cat.name) ?? products[0]
            return (
              <Reveal
                key={cat.name}
                delay={Math.min(i, 4) * 0.05}
                className={i === 0 ? "col-span-2 row-span-2" : undefined}
              >
                <Link
                  href="#catalog"
                  className={`group/cat border-hairline relative flex h-full flex-col justify-between overflow-hidden rounded-3xl bg-card p-6 ring-1 ring-foreground/5 transition-all hover:-translate-y-1 hover:ring-primary/30 ${
                    i === 0 ? "min-h-72" : "min-h-36"
                  }`}
                >
                  <div
                    className="pointer-events-none absolute inset-0 opacity-60 transition-opacity group-hover/cat:opacity-100"
                    style={{
                      background: `radial-gradient(80% 70% at 0% 100%, ${sample.hue[0]}, transparent 60%)`,
                    }}
                  />
                  <div className="relative">
                    <h3 className="font-serif text-3xl">{categoryFa[cat.name]}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{cat.tagline}</p>
                  </div>
                  <span className="relative mt-4 inline-flex items-center gap-1 text-sm text-primary opacity-0 transition-opacity group-hover/cat:opacity-100">
                    خرید {categoryFa[cat.name]} <ArrowLeft className="size-4" />
                  </span>
                  {i === 0 ? (
                    <Bottle
                      product={sample}
                      className="absolute -bottom-6 end-2 h-56 opacity-90"
                    />
                  ) : null}
                </Link>
              </Reveal>
            )
          })}
        </div>
      </section>

      {/* ───────────────────────── Catalog ───────────────────────── */}
      <section id="catalog" className="container-px mx-auto max-w-7xl pb-20">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-3">تازه رسیده</p>
            <h2 className="font-serif text-5xl">بطری‌های منتخب</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {filters.map((f, i) => (
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
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((product, i) => (
            <Reveal key={product.id} delay={Math.min(i, 4) * 0.05} y={20}>
              <ProductCard product={product} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ───────────────────────── Story ───────────────────────── */}
      <section id="story" className="border-y border-border/60 bg-card/30">
        <div className="container-px mx-auto grid max-w-7xl items-center gap-12 py-20 lg:grid-cols-2">
          <Reveal y={24}>
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
          </Reveal>
          <Reveal delay={0.1}>
            <p className="eyebrow mb-4">داستان ما</p>
            <h2 className="font-serif text-5xl leading-tight sm:text-6xl">
              ما دنیا را می‌گردیم تا گیلاسِ شما نگردد.
            </h2>
            <p className="mt-5 text-muted-foreground">
              رومرا با یک دلخوریِ ساده آغاز شد: بهترین بطری‌ها هرگز از دروازهٔ
              تقطیرخانه بیرون نمی‌آمدند. پس ما با خودِ سازندگان رابطه ساختیم —
              تقطیرکنندگان مستقل، تولیدکنندگان خُرد و املاک خانوادگی — و بهترین
              محصولاتشان را مستقیم به شما می‌رسانیم.
            </p>
            <p className="mt-4 text-muted-foreground">
              هر برچسب پیش از یافتنِ جایی در سردابه، توسط تیم ما چشیده و تأیید
              می‌شود. بدون پُرکننده، بدون واسطه، بدون مصالحه.
            </p>
            <Button size="lg" className="mt-8 h-12 px-6 text-sm" asChild>
              <Link href="#catalog">
                شروع کاوش <ArrowLeft />
              </Link>
            </Button>
          </Reveal>
        </div>
      </section>

      {/* ───────────────────────── Testimonial ───────────────────────── */}
      <section className="container-px mx-auto max-w-4xl py-24 text-center">
        <Reveal>
          <Quote className="mx-auto size-10 text-primary/40" />
          <blockquote className="mt-6 font-serif text-4xl leading-snug sm:text-5xl">
            «نزدیک‌ترین چیز به داشتنِ یک سومِلیه، یک خریدارِ ویسکی و یک کنسیِرژ —
            همه در یک اپلیکیشنِ زیبای کوچک.»
          </blockquote>
          <div className="mt-8 flex items-center justify-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary/15 font-serif text-lg text-primary">
              ن
            </span>
            <div className="text-start">
              <p className="text-sm font-medium">نیلوفر مرادی</p>
              <p className="text-xs text-muted-foreground">عضو از سال ۱۴۰۰</p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ───────────────────────── Final CTA ───────────────────────── */}
      <section className="container-px mx-auto max-w-7xl pb-24">
        <Reveal y={24}>
          <div className="cellar-glow border-hairline relative overflow-hidden rounded-[2.5rem] px-8 py-16 text-center ring-1 ring-foreground/10 sm:px-16 sm:py-20">
            <p className="eyebrow mb-4 justify-center">عضو شوید</p>
            <h2 className="mx-auto max-w-2xl font-serif text-5xl leading-tight sm:text-6xl">
              نخستین جرعه از عرضه‌های نایاب، از آنِ شما.
            </h2>
            <p className="mx-auto mt-5 max-w-md text-muted-foreground">
              اعضا به عرضه‌های محدود، قیمت ویژهٔ اعضا و یک ارسالِ خنکِ رایگان روی
              هر سفارش دسترسی دارند.
            </p>
            <div className="mt-8 flex justify-center">
              <Button size="lg" className="h-12 px-8 text-sm" asChild>
                <Link href="#catalog">
                  عضویت رایگان در رومرا <ArrowLeft />
                </Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
