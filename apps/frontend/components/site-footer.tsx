import Link from "next/link"
import {
  Wine,
  Send,
  AtSign,
  Camera,
  Rss,
  ShieldCheck,
  Truck,
  BadgeCheck,
  Phone,
  Mail,
} from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const columns: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "خرید",
    links: [
      { label: "همهٔ محصولات", href: "/products" },
      { label: "دسته‌بندی‌ها", href: "/categories" },
      { label: "پیشنهادهای ویژه", href: "/products?sort=discount" },
      { label: "تازه‌ رسیده‌ها", href: "/products?sort=new" },
    ],
  },
  {
    title: "کاوش",
    links: [
      { label: "دستورها", href: "/recipes" },
      { label: "ژورنال", href: "/journal" },
      { label: "دربارهٔ ما", href: "/about" },
      { label: "پرسش‌های متداول", href: "/faq" },
    ],
  },
  {
    title: "پشتیبانی",
    links: [
      { label: "حساب کاربری", href: "/account" },
      { label: "پیگیری سفارش", href: "/account/orders" },
      { label: "ارسال و بازگشت کالا", href: "/faq" },
      { label: "تماس با ما", href: "/contact" },
    ],
  },
]

const socials: { Icon: typeof Camera; label: string; href: string }[] = [
  { Icon: Camera, label: "اینستاگرام", href: "#" },
  { Icon: AtSign, label: "تردز", href: "#" },
  { Icon: Send, label: "تلگرام", href: "#" },
  { Icon: Rss, label: "خوراک خبری", href: "#" },
]

const trust = [
  { Icon: ShieldCheck, label: "پرداخت امن" },
  { Icon: BadgeCheck, label: "ضمانت اصالت" },
  { Icon: Truck, label: "ارسال سریع" },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-card/40">
      <div className="container-px mx-auto max-w-7xl py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          {/* Brand + newsletter */}
          <div>
            <Link href="/" className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Wine className="size-4.5" />
              </span>
              <span className="font-serif text-3xl leading-none">
                <span className="text-foil">رومرا</span>
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              فروشگاهی منتخب برای هر سلیقه — از نوشیدنی‌های اصل تا لوازم خانه و
              آشپزخانه، با ضمانت اصالت و ارسالی مطمئن به سراسر کشور.
            </p>
            <form className="mt-6 flex max-w-sm items-center gap-2">
              <Input
                type="email"
                required
                dir="ltr"
                placeholder="ایمیل برای دسترسی زودهنگام"
                className="h-10 text-start"
              />
              <Button type="submit" className="h-10 shrink-0">
                عضویت <Send />
              </Button>
            </form>
            <div className="mt-6 flex items-center gap-2">
              {socials.map(({ Icon, label, href }) => (
                <Button
                  key={label}
                  variant="outline"
                  size="icon"
                  aria-label={label}
                  asChild
                >
                  <Link href={href}>
                    <Icon />
                  </Link>
                </Button>
              ))}
            </div>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {columns.map((col) => (
              <div key={col.title}>
                <h4 className="text-xs font-semibold text-foreground">
                  {col.title}
                </h4>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-primary"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Contact */}
            <div className="col-span-2 sm:col-span-3">
              <div className="mt-2 flex flex-col gap-3 border-t border-border/60 pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:gap-8">
                <a
                  href="tel:+982100000000"
                  dir="ltr"
                  className="inline-flex items-center gap-2 transition-colors hover:text-primary"
                >
                  <Phone className="size-4 text-primary" /> +۹۸ ۲۱ ۰۰۰۰ ۰۰۰۰
                </a>
                <a
                  href="mailto:hello@rumera.example"
                  dir="ltr"
                  className="inline-flex items-center gap-2 transition-colors hover:text-primary"
                >
                  <Mail className="size-4 text-primary" /> hello@rumera.example
                </a>
                <span>پشتیبانی همه‌روزه ۹ تا ۲۱</span>
              </div>
            </div>
          </div>
        </div>

        {/* Trust strip */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 rounded-2xl bg-background/50 py-4">
          {trust.map(({ Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground"
            >
              <Icon className="size-4 text-primary" /> {label}
            </span>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-8 text-xs text-muted-foreground sm:flex-row">
          <p>© ۱۴۰۴ رومرا. تمامی حقوق محفوظ است.</p>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-foreground">
              حریم خصوصی
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              قوانین
            </Link>
            <Link href="/about" className="hover:text-foreground">
              خرید آگاهانه · +۱۸
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
