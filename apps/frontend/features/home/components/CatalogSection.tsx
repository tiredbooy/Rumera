import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/features/motion/components/reveal";

interface FilterChip {
  key: string;
  label: string;
  href: string;
}

interface CatalogSectionProps {
  filterChips: FilterChip[];
}

export function CatalogSection({ filterChips }: CatalogSectionProps) {
  return (
    <section id="catalog" className="container-px mx-auto max-w-7xl pb-20">
      <Reveal className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-3">تازه رسیده</p>
          <h2 className="font-serif text-4xl sm:text-5xl">منتخب فروشگاه</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {filterChips.map((f, i) => (
            <Button
              key={f.key}
              size="sm"
              variant={i === 0 ? "default" : "outline"}
              className="rounded-full"
              asChild
            >
              <Link href={f.href}>{f.label}</Link>
            </Button>
          ))}
        </div>
      </Reveal>

      {/* Product grid goes here once `featured` products are wired back in */}

      <div className="mt-10 flex justify-center sm:hidden">
        <Button variant="outline" asChild>
          <Link href="/products">
            مشاهدهٔ همهٔ محصولات <ArrowLeft />
          </Link>
        </Button>
      </div>
    </section>
  );
}
