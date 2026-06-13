/**
 * /llms.txt — a concise, machine-readable guide for AI assistants and answer
 * engines (the emerging GEO standard, llmstxt.org). It tells models what Rumera
 * is and where the canonical, citeable pages live, improving how the brand is
 * represented in generated answers.
 */
import { absoluteUrl, siteConfig } from "@/lib/site"
import { categories, categoryFa } from "@/lib/products"
import { recipes } from "@/lib/recipes"
import { journalPosts } from "@/lib/journal"

export const dynamic = "force-static"
export const revalidate = 86400

export function GET() {
  const categoryLinks = categories
    .map((c) => `- [${categoryFa[c.name]}](${absoluteUrl(`/categories/${c.name.toLowerCase()}`)}): ${c.tagline}`)
    .join("\n")

  const recipeLinks = recipes
    .map((r) => `- [${r.name}](${absoluteUrl(`/recipes/${r.slug}`)}): ${r.description}`)
    .join("\n")

  const journalLinks = journalPosts
    .map((p) => `- [${p.title}](${absoluteUrl(`/journal/${p.slug}`)}): ${p.excerpt}`)
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
