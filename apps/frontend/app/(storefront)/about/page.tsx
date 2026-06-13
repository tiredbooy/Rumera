import type { Metadata } from "next"
import Link from "next/link"

import { buildMetadata } from "@/lib/seo/metadata"
import { JsonLd } from "@/components/json-ld"
import { breadcrumbLd, organizationLd } from "@/lib/seo/jsonld"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/motion/reveal"

export const revalidate = 86400

export const metadata: Metadata = buildMetadata({
  title: "دربارهٔ رومرا",
  description:
    "رومرا، سردابه‌ای دیجیتال از بطری‌های نایاب — مستقیم از سازندگان، با وسواس انتخاب‌شده.",
  path: "/about",
})

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

      <section className="container-px mx-auto max-w-3xl py-16">
        <Reveal>
          <p className="eyebrow mb-3">داستان ما</p>
          <h1 className="font-serif text-5xl leading-tight sm:text-6xl">
            ما دنیا را می‌گردیم تا گیلاسِ شما نگردد.
          </h1>
        </Reveal>
        <div className="mt-8 space-y-5 text-lg leading-relaxed text-muted-foreground">
          <p>
            رومرا با یک دلخوریِ ساده آغاز شد: بهترین بطری‌ها هرگز از دروازهٔ
            تقطیرخانه بیرون نمی‌آمدند. پس ما با خودِ سازندگان رابطه ساختیم —
            تقطیرکنندگان مستقل، تولیدکنندگان خُرد و املاک خانوادگی — و بهترین
            محصولاتشان را مستقیم به شما می‌رسانیم.
          </p>
          <p>
            هر برچسب پیش از یافتنِ جایی در سردابه، توسط تیم ما چشیده و تأیید
            می‌شود. بدون پُرکننده، بدون واسطه، بدون مصالحه — فقط بطری‌هایی که به
            آن‌ها باور داریم.
          </p>
        </div>
        <div className="mt-10">
          <Button size="lg" asChild>
            <Link href="/products">کاوش در مجموعه</Link>
          </Button>
        </div>
      </section>
    </>
  )
}
