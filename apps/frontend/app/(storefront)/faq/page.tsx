import type { Metadata } from "next"
import Link from "next/link"
import {
  HelpCircle,
  ShoppingBag,
  Truck,
  RotateCcw,
  BadgeCheck,
  UserRound,
  Headphones,
  MessageCircle,
} from "lucide-react"

import { buildMetadata } from "@/lib/seo/metadata"
import { JsonLd } from "@/components/json-ld"
import { faqLd, breadcrumbLd } from "@/lib/seo/jsonld"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/motion/reveal"
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

type Faq = { question: string; answer: string }
type FaqGroup = {
  id: string
  title: string
  desc: string
  icon: typeof HelpCircle
  items: Faq[]
}

const groups: FaqGroup[] = [
  {
    id: "orders",
    title: "سفارش و پرداخت",
    desc: "ثبت سفارش، روش‌های پرداخت و شرایط خرید",
    icon: ShoppingBag,
    items: [
      {
        question: "رومرا چه محصولاتی عرضه می‌کند؟",
        answer:
          "رومرا مجموعه‌ای منتخب از ویسکی تک‌مالت، شراب دنیای قدیم، شامپاین تولیدکننده و اسپیریت‌های دست‌ساز را مستقیم از سازندگان عرضه می‌کند.",
      },
      {
        question: "برای خرید چه شرایط سنی لازم است؟",
        answer:
          "خرید تنها برای افراد در سن قانونی مجاز است؛ هنگام ورود به فروشگاه سن شما تأیید می‌شود. لطفاً مسئولانه بنوشید.",
      },
    ],
  },
  {
    id: "shipping",
    title: "ارسال و تحویل",
    desc: "زمان‌بندی، هزینه و نحوهٔ بسته‌بندی سفارش",
    icon: Truck,
    items: [
      {
        question: "ارسال چقدر طول می‌کشد و چگونه انجام می‌شود؟",
        answer:
          "ارسال با بسته‌بندی و کنترل دما انجام می‌شود تا بطری‌ها خنک و سالم به دست شما برسند. برای سفارش‌های بالای ۵٬۰۰۰٬۰۰۰ تومان ارسال رایگان است.",
      },
    ],
  },
  {
    id: "returns",
    title: "بازگشت و تعویض",
    desc: "شرایط مرجوعی و رسیدگی به مغایرت‌ها",
    icon: RotateCcw,
    items: [
      {
        question: "امکان بازگشت کالا وجود دارد؟",
        answer:
          "در صورت آسیب‌دیدگی یا مغایرت، کالا با هماهنگی پشتیبانی قابل بازگشت یا تعویض است. جزئیات در صفحهٔ بازگشت کالا آمده است.",
      },
    ],
  },
  {
    id: "authenticity",
    title: "اصالت کالا",
    desc: "تضمین اصالت و کنترل کیفیت محصولات",
    icon: BadgeCheck,
    items: [
      {
        question: "چطور از اصالت بطری‌ها مطمئن شوم؟",
        answer:
          "هر بطری مستقیم از سازنده یا نمایندهٔ رسمی تهیه می‌شود و پیش از قرار گرفتن در سردابه، توسط تیم ما بررسی و تأیید می‌گردد. اصالت همهٔ محصولات تضمین‌شده است.",
      },
    ],
  },
  {
    id: "account",
    title: "حساب کاربری",
    desc: "ورود، ثبت‌نام و مدیریت حساب شما",
    icon: UserRound,
    items: [
      {
        question: "برای خرید باید حساب کاربری بسازم؟",
        answer:
          "برای پیگیری سفارش‌ها، ذخیرهٔ آدرس‌ها و دسترسی به امکانات باشگاه مشتریان، ساختن حساب کاربری توصیه می‌شود؛ اما تکمیل خرید بدون حساب نیز ممکن است.",
      },
    ],
  },
]

// Flatten for structured-data (preserves original FAQ schema payload).
const allFaqs: Faq[] = groups.flatMap((g) => g.items)

export default function FaqPage() {
  return (
    <>
      <JsonLd
        data={[
          faqLd(allFaqs.map((f) => ({ question: f.question, answer: f.answer }))),
          breadcrumbLd([
            { name: "خانه", path: "/" },
            { name: "پرسش‌های پرتکرار", path: "/faq" },
          ]),
        ]}
      />

      {/* Intro header */}
      <section className="cellar-glow border-b border-border/60">
        <div className="container-px mx-auto max-w-3xl py-16 text-center sm:py-20 lg:py-24">
          <Reveal>
            <p className="eyebrow mb-4">
              <HelpCircle className="size-3.5" /> راهنما
            </p>
            <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
              پرسش‌های پرتکرار
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
              پاسخ پرسش‌هایی که بیش از همه از ما می‌پرسید، دسته‌بندی‌شده تا
              سریع‌تر به آنچه می‌خواهید برسید.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Grouped accordions */}
      <section className="container-px mx-auto max-w-3xl py-16 sm:py-20">
        <div className="space-y-12">
          {groups.map((group, gi) => (
            <Reveal key={group.id} delay={Math.min(gi, 4) * 0.05} y={16}>
              <div className="scroll-mt-24" id={group.id}>
                <div className="flex items-start gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/10">
                    <group.icon className="size-5" />
                  </span>
                  <div>
                    <h2 className="font-serif text-2xl leading-tight sm:text-3xl">
                      {group.title}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {group.desc}
                    </p>
                  </div>
                </div>

                <Accordion
                  type="single"
                  collapsible
                  className="border-hairline shadow-e1 mt-5 overflow-hidden rounded-2xl bg-card/40 px-4"
                >
                  {group.items.map((f, i) => (
                    <AccordionItem key={i} value={`${group.id}-${i}`}>
                      <AccordionTrigger className="text-start font-medium">
                        {f.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {f.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Contact-support CTA */}
      <section className="container-px mx-auto max-w-3xl pb-20 sm:pb-24">
        <Reveal y={24}>
          <div className="cellar-glow border-hairline shadow-e3 relative overflow-hidden rounded-3xl px-6 py-12 text-center ring-1 ring-foreground/10 sm:px-12">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <Headphones className="size-6" />
            </span>
            <h2 className="mt-5 font-serif text-2xl leading-tight sm:text-3xl">
              پاسخ پرسش‌تان را پیدا نکردید؟
            </h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              تیم پشتیبانی رومرا آمادهٔ کمک به شماست — پیش و پس از خرید.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button size="lg" className="h-12 px-6 text-sm" asChild>
                <Link href="/contact">
                  <MessageCircle /> تماس با پشتیبانی
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-6 text-sm"
                asChild
              >
                <Link href="/products">کاوش در فروشگاه</Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
