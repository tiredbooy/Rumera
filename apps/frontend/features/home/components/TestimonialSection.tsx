import { Quote } from "lucide-react";
import { Reveal } from "@/features/motion/components/reveal";

export function TestimonialSection() {
  return (
    <section className="container-px mx-auto max-w-3xl py-20 text-center">
      <Reveal>
        <div className="border-hairline shadow-e2 relative overflow-hidden rounded-[2rem] bg-card/60 px-6 py-10 ring-1 ring-foreground/5 sm:px-12">
          <div aria-hidden className="rule-gold absolute inset-x-12 top-0" />
          <Quote className="mx-auto size-8 text-primary/40" />
          <blockquote className="mt-5 font-serif text-2xl leading-snug sm:text-3xl">
            «نزدیک‌ترین چیز به یک مشاور خرید همیشه‌همراه — انتخاب مطمئن، ارسال
            سریع و تجربه‌ای دلنشین، همه در یک اپلیکیشن.»
          </blockquote>
          <div className="mt-6 flex items-center justify-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary/15 font-serif text-lg text-primary">
              ن
            </span>
            <div className="text-start">
              <p className="text-sm font-medium">نیلوفر مرادی</p>
              <p className="text-xs text-muted-foreground">عضو از سال ۱۴۰۰</p>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
