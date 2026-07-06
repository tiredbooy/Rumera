import { Sparkles, Check, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Reveal } from "@/features/motion/components/reveal";

const benefits = [
  "دسترسی زودهنگام به عرضه‌های محدود",
  "قیمت ویژهٔ اعضا و کدهای تخفیف اختصاصی",
  "یک ارسال رایگان روی نخستین سفارش",
];

export function NewsletterSection() {
  return (
    <section className="container-px mx-auto max-w-7xl pb-24">
      <Reveal y={24}>
        <div className="cellar-glow border-hairline shadow-e3 relative overflow-hidden rounded-[2.5rem] px-6 py-14 ring-1 ring-foreground/10 sm:px-16 sm:py-16">
          <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-2">
            <div className="text-center lg:text-start">
              <p className="eyebrow mb-4 justify-center lg:justify-start">
                <Sparkles className="size-3.5" /> عضویت رایگان
              </p>
              <h2 className="font-serif text-3xl leading-tight sm:text-4xl">
                اول از همه، از تازه‌ها باخبر شوید.
              </h2>
              <ul className="mx-auto mt-6 grid max-w-md gap-2.5 text-sm text-muted-foreground lg:mx-0">
                {benefits.map((b) => (
                  <li key={b} className="flex items-center gap-2">
                    <Check className="size-4 shrink-0 text-primary" /> {b}
                  </li>
                ))}
              </ul>
            </div>

            {/* Visual signup form — wire to the newsletter endpoint when available. */}
            <form className="flex w-full flex-col gap-3 rounded-3xl bg-background/70 p-5 backdrop-blur-md sm:p-6">
              <label htmlFor="newsletter-email" className="text-sm font-medium">
                ایمیل خود را وارد کنید
              </label>
              <Input
                id="newsletter-email"
                type="email"
                inputMode="email"
                dir="ltr"
                placeholder="you@example.com"
                className="h-12 text-start"
                required
              />
              <Button size="lg" type="submit" className="h-12 text-sm">
                عضویت در خبرنامهٔ رومرا <ArrowLeft />
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">
                با عضویت، شرایط استفاده و حریم خصوصی رومرا را می‌پذیرید.
              </p>
            </form>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
