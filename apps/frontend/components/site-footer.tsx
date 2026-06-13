import Link from "next/link"
import { Wine, Send, AtSign, Camera, Rss } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const columns = [
  {
    title: "فروشگاه",
    links: ["ویسکی", "شراب", "شامپاین", "جین", "رام", "تکیلا"],
  },
  {
    title: "شرکت",
    links: ["داستان ما", "پایداری", "فروشگاه‌ها", "فرصت‌های شغلی", "رسانه"],
  },
  {
    title: "پشتیبانی",
    links: ["مرکز راهنما", "ارسال", "بازگشت کالا", "پیگیری سفارش", "تماس با ما"],
  },
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
              سردابه‌ای منتخب از اسپیریت‌های نایاب، شامپاین‌های تولیدکننده و
              شراب‌های دنیای قدیم — خنک، سریع و زیبا تحویل داده می‌شود.
            </p>
            <form className="mt-6 flex max-w-sm items-center gap-2">
              <Input
                type="email"
                required
                placeholder="ایمیل برای دسترسی زودهنگام"
                className="h-10"
              />
              <Button type="submit" className="h-10 shrink-0">
                عضویت <Send />
              </Button>
            </form>
            <div className="mt-6 flex items-center gap-2">
              {[Camera, AtSign, Send, Rss].map((Icon, i) => (
                <Button key={i} variant="outline" size="icon" aria-label="شبکه‌های اجتماعی">
                  <Icon />
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
                    <li key={link}>
                      <Link
                        href="#"
                        className="text-sm text-muted-foreground transition-colors hover:text-primary"
                      >
                        {link}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-8 text-xs text-muted-foreground sm:flex-row">
          <p>© ۱۴۰۴ رومرا. لطفاً مسئولانه بنوشید.</p>
          <div className="flex items-center gap-5">
            <Link href="#" className="hover:text-foreground">حریم خصوصی</Link>
            <Link href="#" className="hover:text-foreground">قوانین</Link>
            <Link href="#" className="hover:text-foreground">نوشیدنِ آگاهانه · +۱۸</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
