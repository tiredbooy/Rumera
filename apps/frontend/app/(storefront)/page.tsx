import Link from "next/link"
import {
  ArrowLeft,
  Truck,
  ShieldCheck,
  Wallet,
  Headphones,
  Quote,
  Sparkles,
  Check,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ProductCard } from "@/components/product-card"
import { SmartImage } from "@/components/smart-image"
import { Reveal } from "@/components/motion/reveal"
import { BrandMarquee } from "@/components/brand-marquee"
import { HeroCarousel } from "@/components/home/hero-carousel"
import { HomeStructuredData } from "@/components/structured-data"
import { getHeroSlides } from "@/lib/home/hero"
import { featuredBrands } from "@/lib/home/brands"
import { categories, categoryFa, getFeatured } from "@/lib/products"

// Home is ISR — the hero slides are admin-managed and refetched periodically.
export const revalidate = 300

const perks = [
  {
    icon: Truck,
    title: "ارسال سریع و مطمئن",
    desc: "تحویل به سراسر کشور با بسته‌بندی ایمن",
  },
  {
    icon: ShieldCheck,
    title: "اصالت تضمین‌شده",
    desc: "مستقیم از برند و واردکنندهٔ رسمی",
  },
  {
    icon: Wallet,
    title: "پرداخت امن",
    desc: "درگاه امن بانکی و کیف پول رومرا",
  },
  {
    icon: Headphones,
    title: "پشتیبانی واقعی",
    desc: "همراه شما، پیش و پس از خرید",
  },
]

// Catalogue filter chips (Persian) — first is the active "all".
const filters = ["همه", "ویسکی", "شراب", "شامپاین", "اسپیریت"]

export default async function Home() {
  const heroSlides = await getHeroSlides()
  const featured = getFeatured()

  return (
    <>
      {/* SEO: Organization + WebSite + ItemList rich results (zero client JS) */}
      <HomeStructuredData />

      {/* ───────────────────────── Hero (dynamic slider) ───────────────────────── */}
      <HeroCarousel slides={heroSlides} />

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

      {/* ───────────────────────── Brand marquee ───────────────────────── */}
      <section className="border-b border-border/60 py-8">
        <div className="container-px mx-auto max-w-7xl">
          <p className="eyebrow mb-5 justify-center text-center">
            برندهای محبوب، گرد هم
          </p>
          <BrandMarquee items={featuredBrands} />
        </div>
      </section>

      {/* ───────────────────────── Categories ───────────────────────── */}
      <section id="categories" className="container-px mx-auto max-w-7xl py-20">
        <Reveal className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-3">خرید بر اساس دسته‌بندی</p>
            <h2 className="font-serif text-4xl sm:text-5xl">هر چه می‌خواهید، یک‌جا</h2>
          </div>
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/products">
              مشاهدهٔ همه <ArrowLeft />
            </Link>
          </Button>
        </Reveal>

        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {categories.map((cat, i) => {
            const isHero = i === 0
            return (
              <Reveal
                key={cat.name}
                delay={Math.min(i, 4) * 0.05}
                className={isHero ? "col-span-2 row-span-2" : undefined}
              >
                <Link
                  href={`/categories/${cat.name.toLowerCase()}`}
                  className={`group/cat border-hairline relative flex h-full flex-col justify-end overflow-hidden rounded-3xl ring-1 ring-foreground/5 transition-all hover:-translate-y-1 hover:shadow-xl hover:ring-primary/30 ${
                    isHero ? "min-h-72" : "min-h-40"
                  }`}
                >
                  {/* Category image (place 1200×1500 portrait assets at the documented path) */}
                  <div className="absolute inset-0 transition-transform duration-700 group-hover/cat:scale-105">
                    <SmartImage
                      src={`/images/categories/${cat.name.toLowerCase()}.jpg`}
                      alt={categoryFa[cat.name]}
                      sizes={isHero ? "(max-width: 1024px) 100vw, 50vw" : "(max-width: 1024px) 50vw, 25vw"}
                      monogram={categoryFa[cat.name].charAt(0)}
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                  <div className="relative p-5 text-white">
                    <h3 className="font-serif text-2xl sm:text-3xl">{categoryFa[cat.name]}</h3>
                    <p className="mt-1 text-sm text-white/75">{cat.tagline}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-sm text-primary opacity-0 transition-opacity group-hover/cat:opacity-100">
                      خرید {categoryFa[cat.name]} <ArrowLeft className="size-4" />
                    </span>
                  </div>
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
            <h2 className="font-serif text-4xl sm:text-5xl">منتخب فروشگاه</h2>
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

        <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {featured.map((product, i) => (
            <Reveal key={product.id} delay={Math.min(i, 4) * 0.05} y={20}>
              <ProductCard product={product} />
            </Reveal>
          ))}
        </div>

        <div className="mt-10 flex justify-center sm:hidden">
          <Button variant="outline" asChild>
            <Link href="/products">
              مشاهدهٔ همهٔ محصولات <ArrowLeft />
            </Link>
          </Button>
        </div>
      </section>

      {/* ───────────────────────── Story ───────────────────────── */}
      <section id="story" className="border-y border-border/60 bg-card/30">
        <div className="container-px mx-auto grid max-w-7xl items-center gap-12 py-20 lg:grid-cols-2">
          <Reveal y={24}>
            {/* Story image — recommended 1200×1200 (1:1), object-cover. */}
            <div className="border-hairline relative aspect-square overflow-hidden rounded-[2rem] ring-1 ring-foreground/10">
              <SmartImage
                src="/images/story/rumera-cellar.jpg"
                alt="انتخاب و کنترل کیفیت در رومرا"
                sizes="(max-width: 1024px) 100vw, 50vw"
                label="رومرا"
              />
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="eyebrow mb-4">داستان ما</p>
            <h2 className="font-serif text-4xl leading-tight sm:text-5xl">
              یک مقصد، برای هر سلیقه و هر بهانه.
            </h2>
            <p className="mt-5 text-muted-foreground">
              رومرا با یک باور ساده شروع شد: خرید چیزهای خوب نباید سخت باشد. ما
              بهترین‌ها را از برندها و سازندگان معتبر گرد هم آوردیم تا شما با
              خیال راحت، اصل و باکیفیت انتخاب کنید.
            </p>
            <p className="mt-4 text-muted-foreground">
              هر محصول پیش از راه‌یافتن به فروشگاه، از نظر اصالت و کیفیت بررسی
              می‌شود. بدون واسطهٔ اضافی، بدون مصالحه روی کیفیت.
            </p>
            <Button size="lg" className="mt-8 h-12 px-6 text-sm" asChild>
              <Link href="/about">
                بیشتر دربارهٔ رومرا <ArrowLeft />
              </Link>
            </Button>
          </Reveal>
        </div>
      </section>

      {/* ───────────────────────── Testimonial ───────────────────────── */}
      <section className="container-px mx-auto max-w-3xl py-20 text-center">
        <Reveal>
          <div className="border-hairline rounded-[2rem] bg-card/50 px-6 py-10 ring-1 ring-foreground/5 sm:px-12">
            <Quote className="mx-auto size-8 text-primary/40" />
            <blockquote className="mt-5 font-serif text-2xl leading-snug sm:text-3xl">
              «نزدیک‌ترین چیز به یک مشاور خرید همیشه‌همراه — انتخاب مطمئن، ارسال
              سریع و تجربه‌ای دلنشین، همه در یک اپلیکیشن.»
            </blockquote>
            <div className="mt-6 flex items-center justify-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary/15 font-serif text-lg text-primary">
                ن
              </span>
              <div className="text-start">
                <p className="text-sm font-medium">نیلوفر مرادی</p>
                <p className="text-xs text-muted-foreground">عضو از سال ۱۴۰۰</p>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ───────────────────────── Newsletter / signup ───────────────────────── */}
      <section className="container-px mx-auto max-w-7xl pb-24">
        <Reveal y={24}>
          <div className="cellar-glow border-hairline relative overflow-hidden rounded-[2.5rem] px-6 py-14 ring-1 ring-foreground/10 sm:px-16 sm:py-16">
            <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-2">
              <div className="text-center lg:text-start">
                <p className="eyebrow mb-4 justify-center lg:justify-start">
                  <Sparkles className="size-3.5" /> عضویت رایگان
                </p>
                <h2 className="font-serif text-3xl leading-tight sm:text-4xl">
                  اول از همه، از تازه‌ها باخبر شوید.
                </h2>
                <ul className="mx-auto mt-6 grid max-w-md gap-2.5 text-sm text-muted-foreground lg:mx-0">
                  {[
                    "دسترسی زودهنگام به عرضه‌های محدود",
                    "قیمت ویژهٔ اعضا و کدهای تخفیف اختصاصی",
                    "یک ارسال رایگان روی نخستین سفارش",
                  ].map((b) => (
                    <li key={b} className="flex items-center gap-2">
                      <Check className="size-4 shrink-0 text-primary" /> {b}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Visual signup form — wire to the newsletter endpoint when available. */}
              <form className="flex w-full flex-col gap-3 rounded-3xl bg-background/70 p-5 backdrop-blur-md sm:p-6">
                <label htmlFor="newsletter-email" className="text-sm font-medium">
                  ایمیل خود را وارد کنید
                </label>
                <Input
                  id="newsletter-email"
                  type="email"
                  inputMode="email"
                  dir="ltr"
                  placeholder="you@example.com"
                  className="h-12 text-start"
                  required
                />
                <Button size="lg" type="submit" className="h-12 text-sm">
                  عضویت در خبرنامهٔ رومرا <ArrowLeft />
                </Button>
                <p className="text-center text-[11px] text-muted-foreground">
                  با عضویت، شرایط استفاده و حریم خصوصی رومرا را می‌پذیرید.
                </p>
              </form>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
