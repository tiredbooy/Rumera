import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SmartImage } from "@/components/smart-image";
import { Reveal } from "@/features/motion/components/reveal";

export function StorySection() {
  return (
    <section id="story" className="border-y border-border/60 bg-card/30">
      <div className="container-px mx-auto grid max-w-7xl items-center gap-12 py-20 lg:grid-cols-2">
        <Reveal y={24}>
          <div className="border-hairline relative aspect-square overflow-hidden rounded-[2rem] ring-1 ring-foreground/10">
            <SmartImage
              src="/images/story/rumera-cellar.jpg"
              alt="انتخاب و کنترل کیفیت در رومرا"
              sizes="(max-width: 1024px) 100vw, 50vw"
              label="رومرا"
            />
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="eyebrow mb-4">داستان ما</p>
          <h2 className="font-serif text-4xl leading-tight sm:text-5xl">
            یک مقصد، برای هر سلیقه و هر بهانه.
          </h2>
          <p className="mt-5 text-muted-foreground">
            رومرا با یک باور ساده شروع شد: خرید چیزهای خوب نباید سخت باشد. ما
            بهترین‌ها را از برندها و سازندگان معتبر گرد هم آوردیم تا شما با خیال
            راحت، اصل و باکیفیت انتخاب کنید.
          </p>
          <p className="mt-4 text-muted-foreground">
            هر محصول پیش از راه‌یافتن به فروشگاه، از نظر اصالت و کیفیت بررسی
            می‌شود. بدون واسطهٔ اضافی، بدون مصالحه روی کیفیت.
          </p>
          <Button size="lg" className="mt-8 h-12 px-6 text-sm" asChild>
            <Link href="/about">
              بیشتر دربارهٔ رومرا <ArrowLeft />
            </Link>
          </Button>
        </Reveal>
      </div>
    </section>
  );
}
