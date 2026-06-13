import type { Metadata } from "next"

import { buildMetadata } from "@/lib/seo/metadata"
import { JsonLd } from "@/components/json-ld"
import { faqLd, breadcrumbLd } from "@/lib/seo/jsonld"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export const revalidate = 86400

export const metadata: Metadata = buildMetadata({
  title: "پرسش‌های پرتکرار",
  description: "پاسخ پرسش‌های رایج دربارهٔ خرید، ارسال، اصالت و بازگشت کالا در رومرا.",
  path: "/faq",
})

const faqs = [
  {
    question: "رومرا چه محصولاتی عرضه می‌کند؟",
    answer:
      "رومرا مجموعه‌ای منتخب از ویسکی تک‌مالت، شراب دنیای قدیم، شامپاین تولیدکننده و اسپیریت‌های دست‌ساز را مستقیم از سازندگان عرضه می‌کند.",
  },
  {
    question: "چطور از اصالت بطری‌ها مطمئن شوم؟",
    answer:
      "هر بطری مستقیم از سازنده یا نمایندهٔ رسمی تهیه می‌شود و پیش از قرار گرفتن در سردابه، توسط تیم ما بررسی و تأیید می‌گردد. اصالت همهٔ محصولات تضمین‌شده است.",
  },
  {
    question: "ارسال چقدر طول می‌کشد و چگونه انجام می‌شود؟",
    answer:
      "ارسال با بسته‌بندی و کنترل دما انجام می‌شود تا بطری‌ها خنک و سالم به دست شما برسند. برای سفارش‌های بالای ۵٬۰۰۰٬۰۰۰ تومان ارسال رایگان است.",
  },
  {
    question: "امکان بازگشت کالا وجود دارد؟",
    answer:
      "در صورت آسیب‌دیدگی یا مغایرت، کالا با هماهنگی پشتیبانی قابل بازگشت یا تعویض است. جزئیات در صفحهٔ بازگشت کالا آمده است.",
  },
  {
    question: "برای خرید چه شرایط سنی لازم است؟",
    answer:
      "خرید تنها برای افراد در سن قانونی مجاز است؛ هنگام ورود به فروشگاه سن شما تأیید می‌شود. لطفاً مسئولانه بنوشید.",
  },
]

export default function FaqPage() {
  return (
    <>
      <JsonLd
        data={[
          faqLd(faqs.map((f) => ({ question: f.question, answer: f.answer }))),
          breadcrumbLd([
            { name: "خانه", path: "/" },
            { name: "پرسش‌های پرتکرار", path: "/faq" },
          ]),
        ]}
      />

      <section className="container-px mx-auto max-w-3xl py-16">
        <p className="eyebrow mb-3">راهنما</p>
        <h1 className="font-serif text-5xl">پرسش‌های پرتکرار</h1>
        <p className="mt-3 text-muted-foreground">
          پاسخ پرسش‌هایی که بیش از همه از ما می‌پرسید.
        </p>

        <Accordion type="single" collapsible className="mt-10">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-start font-medium">
                {f.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {f.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </>
  )
}
