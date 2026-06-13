import type { Metadata } from "next"
import Link from "next/link"
import { Clock, ArrowLeft } from "lucide-react"

import { buildMetadata } from "@/lib/seo/metadata"
import { JsonLd } from "@/components/json-ld"
import { breadcrumbLd } from "@/lib/seo/jsonld"
import { recipes } from "@/lib/recipes"
import { Reveal } from "@/components/motion/reveal"

export const revalidate = 86400

export const metadata: Metadata = buildMetadata({
  title: "دستورهای کوکتل",
  description: "دستورهای کلاسیک و مدرنِ کوکتل با اسپیریت‌های منتخب رومرا.",
  path: "/recipes",
})

export default function RecipesPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "خانه", path: "/" },
          { name: "دستورها", path: "/recipes" },
        ])}
      />

      <section className="container-px mx-auto max-w-7xl py-14">
        <Reveal>
          <p className="eyebrow mb-3">ژورنال</p>
          <h1 className="font-serif text-5xl">دستورهای کوکتل</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            از کلاسیک‌های بی‌زمان تا ترکیب‌های تازه — با بطری‌های مجموعهٔ ما.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe, i) => (
            <Reveal key={recipe.slug} delay={Math.min(i, 4) * 0.05} y={16}>
              <Link
                href={`/recipes/${recipe.slug}`}
                className="group/recipe border-hairline relative flex h-full flex-col overflow-hidden rounded-3xl bg-card p-6 ring-1 ring-foreground/5 transition-all hover:-translate-y-1 hover:ring-primary/30"
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-50 transition-opacity group-hover/recipe:opacity-80"
                  style={{ background: `radial-gradient(70% 60% at 100% 0%, ${recipe.hue}, transparent 60%)` }}
                />
                <div className="relative">
                  <span className="text-xs text-primary">{recipe.spirit}</span>
                  <h2 className="mt-1 font-serif text-2xl">{recipe.name}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{recipe.description}</p>
                </div>
                <div className="relative mt-5 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" /> {recipe.ingredients.length} جزء
                  </span>
                  <span className="inline-flex items-center gap-1 text-primary opacity-0 transition-opacity group-hover/recipe:opacity-100">
                    خواندن دستور <ArrowLeft className="size-3.5" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  )
}
