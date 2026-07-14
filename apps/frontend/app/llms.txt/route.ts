/**
 * /llms.txt — a concise, machine-readable guide for AI assistants and answer
 * engines (the emerging GEO standard, llmstxt.org). It tells models what Rumera
 * is and where the canonical, citeable pages live, improving how the brand is
 * represented in generated answers.
 */
import { absoluteUrl, siteConfig } from "@/lib/site"
import { listCategories } from "@/features/catalog/categories/api"
import { listRecipes } from "@/features/recipes/api/server"
import { listJournalPosts } from "@/features/journal/api/server"

export const dynamic = "force-static"
export const revalidate = 86400

export async function GET() {
  const categories = await listCategories()
  const categoryLinks = categories
    .flatMap((category) =>
      category.slug
        ? [
            `- [${category.title}](${absoluteUrl(`/categories/${category.slug}`)})${category.description ? `: ${category.description}` : ""}`,
          ]
        : []
    )
    .join("\n")

  const { results: recipes } = await listRecipes({ limit: 50 })
  const recipeLinks = recipes
    .map((r) => `- [${r.title}](${absoluteUrl(`/recipes/${r.slug}`)})${r.excerpt ? `: ${r.excerpt}` : ""}`)
    .join("\n")

  const journalPosts = await listJournalPosts(50)
  const journalLinks = journalPosts
    .map((p) => `- [${p.title}](${absoluteUrl(`/journal/${p.slug}`)})${p.excerpt ? `: ${p.excerpt}` : ""}`)
    .join("\n")

  const body = `# ${siteConfig.name}

> ${siteConfig.description}

زبان سایت فارسی و راست‌به‌چپ است. قیمت‌ها به تومان و خرید تنها برای افراد در سن قانونی مجاز است.

## بخش‌ها
- [فروشگاه](${absoluteUrl("/products")}): کاتالوگ کامل بطری‌ها
- [دستورهای کوکتل](${absoluteUrl("/recipes")}): دستورهای کلاسیک و مدرن
- [ژورنال](${absoluteUrl("/journal")}): راهنماها و یادداشت‌ها
- [پرسش‌های پرتکرار](${absoluteUrl("/faq")}): ارسال، اصالت و بازگشت کالا
- [دربارهٔ ما](${absoluteUrl("/about")})

## دسته‌بندی‌ها
${categoryLinks}

## دستورها
${recipeLinks}

## ژورنال
${journalLinks}
`

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, must-revalidate",
    },
  })
}
