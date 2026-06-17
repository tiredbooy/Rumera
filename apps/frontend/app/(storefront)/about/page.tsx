import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowLeft,
  BadgeCheck,
  Sparkles,
  Truck,
  Headphones,
  ShieldCheck,
  HeartHandshake,
  Search,
  PackageCheck,
  Milestone,
} from "lucide-react"

import { buildMetadata } from "@/lib/seo/metadata"
import { JsonLd } from "@/components/json-ld"
import { breadcrumbLd, organizationLd } from "@/lib/seo/jsonld"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/motion/reveal"
import { SmartImage } from "@/components/smart-image"
import { faNum } from "@/lib/products"

export const revalidate = 86400

export const metadata: Metadata = buildMetadata({
  title: "دربارهٔ رومرا",
  description:
    "رومرا یک مقصد منتخب برای خرید آنلاین است — مجموعه‌ای گسترده با ضمانت اصالت، قیمت منصفانه و ارسالی مطمئن به سراسر کشور.",
  path: "/about",
})

const stats: [string, string][] = [
  ["+۱٬۲۰۰", "محصول منتخب"],
  ["+۸۰", "برند معتبر"],
  ["۴٫۹", "میانگین رضایت"],
  ["۳۲", "استان زیر پوشش"],
]

const values = [
  {
    icon: BadgeCheck,
    title: "اصالت، بی‌چون‌وچرا",
    desc: "هر محصول از برند یا واردکنندهٔ رسمی تأمین می‌شود؛ بدون واسطهٔ مشکوک.",
  },
  {
    icon: Sparkles,
    title: "انتخابی با وسواس",
    desc: "به‌جای انبوهِ بی‌پایان، مجموعه‌ای دست‌چین که واقعاً ارزش خرید دارد.",
  },
  {
    icon: Truck,
    title: "ارسال مطمئن",
    desc: "بسته‌بندی ایمن و تحویل سریع به سراسر کشور، با پیگیری لحظه‌به‌لحظه.",
  },
  {
    icon: Headphones,
    title: "پشتیبانی واقعی",
    desc: "تیمی که پیش و پس از خرید کنار شماست و پاسخ‌گوست.",
  },
]

const steps = [
  {
    icon: Search,
    title: "انتخاب می‌کنیم",
    desc: "برندها و محصولات را بر اساس کیفیت، اصالت و بازخورد مشتری گزینش می‌کنیم.",
  },
  {
    icon: ShieldCheck,
    title: "تأیید می‌کنیم",
    desc: "اصالت و سلامت هر کالا پیش از عرضه در فروشگاه بررسی می‌شود.",
  },
  {
    icon: PackageCheck,
    title: "به‌دستتان می‌رسانیم",
    desc: "سفارش با بسته‌بندی ایمن و سریع، درست به مقصد می‌رسد.",
  },
]

const timeline: { year: string; title: string; desc: string }[] = [
  {
    year: "۱۳۹۸",
    title: "آغاز با یک باور",
    desc: "رومرا با این ایده شکل گرفت که خریدِ چیزهای خوب باید آسان، مطمئن و لذت‌بخش باشد.",
  },
  {
    year: "۱۴۰۰",
    title: "گزینش برندها",
    desc: "همکاری مستقیم با برندها و واردکنندگان رسمی، تا اصالت هر کالا تضمین شود.",
  },
  {
    year: "۱۴۰۲",
    title: "گسترش به سراسر کشور",
    desc: "شبکهٔ ارسالِ مطمئن با بسته‌بندی ایمن، حالا ۳۲ استان را زیر پوشش می‌گیرد.",
  },
  {
    year: "امروز",
    title: "مجموعه‌ای دست‌چین",
    desc: "بیش از ۱٬۲۰۰ محصول منتخب از ۸۰ برند معتبر، با همان وسواسِ روز نخست.",
  },
]

export default function AboutPage() {
  return (
    <>
      <JsonLd
        data={[
          organizationLd(),
          breadcrumbLd([
            { name: "خانه", path: "/" },
            { name: "دربارهٔ ما", path: "/about" },
          ]),
        ]}
      />

      {/* Hero */}
      <section className="cellar-glow border-b border-border/60">
        <div className="container-px mx-auto grid max-w-7xl items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
          <Reveal>
            <p className="eyebrow mb-4">
              <Sparkles className="size-3.5" /> دربارهٔ رومرا
            </p>
            <h1 className="font-serif text-4xl leading-tight sm:text-5xl lg:text-6xl">
              یک مقصد، برای هر سلیقه و هر بهانه.
            </h1>
            <p className="mt-6 max-w-md text-lg text-muted-foreground">
              رومرا با یک باور ساده ساخته شد: خریدِ چیزهای خوب باید آسان، مطمئن و
              لذت‌بخش باشد. ما بهترین‌ها را از برندهای معتبر گرد هم می‌آوریم تا
              شما با خیال راحت انتخاب کنید.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" className="h-12 px-6 text-sm" asChild>
                <Link href="/products">
                  کاوش در فروشگاه <ArrowLeft />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-6 text-sm" asChild>
                <Link href="/journal">خواندن ژورنال</Link>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            {/* About hero image — recommended 1400×1050 (4:3). */}
            <div className="border-hairline relative aspect-[4/3] overflow-hidden rounded-[2rem] ring-1 ring-foreground/10">
              <SmartImage
                src="/images/about/rumera-team.jpg"
                alt="تیم رومرا"
                sizes="(max-width: 1024px) 100vw, 50vw"
                label="رومرا"
                priority
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-border/60 bg-card/30">
        <div className="container-px mx-auto grid max-w-7xl grid-cols-2 gap-8 py-12 lg:grid-cols-4">
          {stats.map(([value, label], i) => (
            <Reveal key={label} delay={i * 0.06}>
              <div className="text-center">
                <p className="font-serif text-4xl text-foil sm:text-5xl">{value}</p>
                <p className="mt-2 text-sm text-muted-foreground">{label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Mission */}
      <section className="container-px mx-auto grid max-w-7xl items-center gap-12 py-20 lg:grid-cols-2">
        <Reveal y={24}>
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
          <p className="eyebrow mb-4">
            <HeartHandshake className="size-3.5" /> مأموریت ما
          </p>
          <h2 className="font-serif text-3xl leading-tight sm:text-4xl">
            کیفیت و اعتماد، در هر سفارش.
          </h2>
          <p className="mt-5 text-muted-foreground">
            ما واسطه‌های اضافی را حذف کردیم تا کیفیت بالا با قیمتی منصفانه به دست
            شما برسد. هر برند پیش از راه‌یافتن به فروشگاه ارزیابی می‌شود و هر
            تجربهٔ خرید برای ما اهمیت دارد.
          </p>
          <p className="mt-4 text-muted-foreground">
            هدف ساده است: جایی که بتوانید با اطمینان خرید کنید و دوباره برگردید.
          </p>
        </Reveal>
      </section>

      {/* Story timeline */}
      <section className="border-t border-border/60">
        <div className="container-px mx-auto max-w-3xl py-20 lg:py-24">
          <Reveal>
            <p className="eyebrow mb-3">
              <Milestone className="size-3.5" /> مسیر ما
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl">داستان رومرا، گام به گام</h2>
          </Reveal>

          <ol className="relative mt-12 space-y-10 border-border ps-8 [border-inline-start-width:2px]">
            {timeline.map((item, i) => (
              <Reveal key={item.year} delay={Math.min(i, 4) * 0.06} y={16}>
                <li className="relative">
                  <span
                    aria-hidden
                    className="absolute top-1.5 size-3.5 rounded-full bg-primary ring-4 ring-background [inset-inline-start:-2.4375rem]"
                  />
                  <span className="font-serif text-2xl text-foil">{item.year}</span>
                  <h3 className="mt-1 font-serif text-xl">{item.title}</h3>
                  <p className="mt-2 text-muted-foreground">{item.desc}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Values */}
      <section className="border-y border-border/60 bg-card/30">
        <div className="container-px mx-auto max-w-7xl py-20">
          <Reveal>
            <p className="eyebrow mb-3">ارزش‌های ما</p>
            <h2 className="font-serif text-3xl sm:text-4xl">به چه چیزی پایبندیم</h2>
          </Reveal>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((v, i) => (
              <Reveal key={v.title} delay={Math.min(i, 4) * 0.05} y={16}>
                <div className="hover-lift border-hairline group/val h-full rounded-3xl bg-card p-6">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/10 transition-colors duration-300 group-hover/val:bg-primary group-hover/val:text-primary-foreground">
                    <v.icon className="size-5" />
                  </span>
                  <h3 className="mt-4 font-serif text-xl">{v.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{v.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container-px mx-auto max-w-7xl py-20">
        <Reveal>
          <p className="eyebrow mb-3">چطور کار می‌کنیم</p>
          <h2 className="font-serif text-3xl sm:text-4xl">از انتخاب تا تحویل</h2>
        </Reveal>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.07} y={16}>
              <div className="hover-lift border-hairline group/step relative h-full rounded-3xl bg-card p-7">
                <span className="font-serif text-5xl text-foil/30">{faNum(i + 1)}</span>
                <span className="mt-2 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/10 transition-colors duration-300 group-hover/step:bg-primary group-hover/step:text-primary-foreground">
                  <s.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-serif text-xl">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container-px mx-auto max-w-7xl pb-24">
        <Reveal y={24}>
          <div className="cellar-glow border-hairline shadow-e3 relative overflow-hidden rounded-[2.5rem] px-8 py-16 text-center ring-1 ring-foreground/10 sm:px-16 sm:py-20">
            <h2 className="mx-auto max-w-2xl font-serif text-3xl leading-tight sm:text-5xl">
              آماده‌اید با خیال راحت خرید کنید؟
            </h2>
            <p className="mx-auto mt-5 max-w-md text-muted-foreground">
              مجموعهٔ رومرا را کاوش کنید و تفاوتِ یک تجربهٔ خریدِ مطمئن را احساس
              کنید.
            </p>
            <div className="mt-8 flex justify-center">
              <Button size="lg" className="h-12 px-8 text-sm" asChild>
                <Link href="/products">
                  شروع خرید <ArrowLeft />
                </Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
