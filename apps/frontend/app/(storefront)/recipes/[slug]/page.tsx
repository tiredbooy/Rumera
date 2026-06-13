import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Clock } from "lucide-react"

import { buildMetadata } from "@/lib/seo/metadata"
import { JsonLd } from "@/components/json-ld"
import { recipeLd, breadcrumbLd } from "@/lib/seo/jsonld"
import { recipes, getRecipe } from "@/lib/recipes"
import { faNum } from "@/lib/products"

export const revalidate = 86400

export function generateStaticParams() {
  return recipes.map((r) => ({ slug: r.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const recipe = getRecipe(slug)
  if (!recipe) return buildMetadata({ title: "دستور یافت نشد", index: false })
  return buildMetadata({
    title: recipe.name,
    description: recipe.description,
    path: `/recipes/${recipe.slug}`,
    type: "article",
  })
}

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const recipe = getRecipe(slug)
  if (!recipe) notFound()

  return (
    <>
      <JsonLd
        data={[
          recipeLd({
            name: recipe.name,
            description: recipe.description,
            slug: recipe.slug,
            ingredients: recipe.ingredients,
            steps: recipe.steps,
            totalTime: recipe.totalTime,
          }),
          breadcrumbLd([
            { name: "خانه", path: "/" },
            { name: "دستورها", path: "/recipes" },
            { name: recipe.name, path: `/recipes/${recipe.slug}` },
          ]),
        ]}
      />

      <section className="container-px mx-auto max-w-3xl py-16">
        <nav className="mb-8 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground">خانه</Link>
          <span>/</span>
          <Link href="/recipes" className="hover:text-foreground">دستورها</Link>
        </nav>

        <p className="eyebrow mb-3">{recipe.spirit}</p>
        <h1 className="font-serif text-5xl">{recipe.name}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{recipe.description}</p>

        <div className="mt-8 grid gap-8 sm:grid-cols-[1fr_1.4fr]">
          <div className="border-hairline rounded-2xl bg-card p-6 ring-1 ring-foreground/5">
            <h2 className="font-serif text-xl">مواد لازم</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {recipe.ingredients.map((ing, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  {ing}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-serif text-xl">طرز تهیه</h2>
            <ol className="mt-4 space-y-4">
              {recipe.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 font-serif text-sm text-primary">
                    {faNum(i + 1)}
                  </span>
                  <p className="pt-0.5 text-muted-foreground">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </>
  )
}
