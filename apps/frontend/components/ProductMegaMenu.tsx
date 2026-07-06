"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Grid2x2, Tag } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CategoryTree } from "@/features/categories/types";

interface ProductsMegaMenuProps {
  categoryTree: CategoryTree[];
}

/**
 * Three-pane mega menu:
 *   [level-1 rail]  [level-2 columns, each with level-3 links underneath]  [promo]
 * Hovering/focusing a level-1 row swaps the active category — no further
 * hover chains needed to reach level-3, which keeps it usable via keyboard
 * and touch, not just mouse hover.
 */
export function ProductsMegaMenu({ categoryTree }: ProductsMegaMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [activeId, setActiveId] = React.useState<number | null>(
    categoryTree?.[0]?.id ?? null,
  );
  const closeTimer = React.useRef<number | undefined>(undefined);

  const openNow = () => {
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const closeSoon = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  };

  if (categoryTree?.length === 0) return null;

  const activeCategory =
    categoryTree?.find((c) => c.id === activeId) ?? categoryTree?.[0];

  return (
    <div
      className="relative"
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
      onFocusCapture={openNow}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className={cn("cursor-pointer gap-1", open && "bg-accent")}
      >
        محصولات
        <ChevronDown
          className={cn(
            "size-4 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </Button>

      {open ? (
        <div className="absolute start-0 top-full z-50 pt-2">
          <div className="animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 shadow-e3 grid w-[min(94vw,920px)] grid-cols-[200px_1fr_240px] overflow-hidden rounded-3xl border border-border/60 bg-popover/95 backdrop-blur-xl duration-150">
            {/* Level 1 — category rail */}
            <div className="flex flex-col gap-0.5 border-e border-border/60 p-3">
              <div className="eyebrow mb-2 px-2">
                <Grid2x2 className="size-3.5" /> دسته‌بندی‌ها
              </div>
              {categoryTree.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onMouseEnter={() => setActiveId(cat.id)}
                  onFocus={() => setActiveId(cat.id)}
                  onClick={() => setActiveId(cat.id)}
                  className={cn(
                    "group/l1 flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-start text-sm transition-colors",
                    activeId === cat.id
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  <CategoryThumb category={cat} active={activeId === cat.id} />
                  <span className="flex-1 truncate">{cat?.title}</span>
                  {cat.children?.length ? (
                    <ArrowLeft
                      className={cn(
                        "size-3.5 shrink-0 text-primary opacity-0 transition-all",
                        activeId === cat.id
                          ? "translate-x-0 opacity-100"
                          : "-translate-x-1 group-hover/l1:translate-x-0 group-hover/l1:opacity-100",
                      )}
                    />
                  ) : null}
                </button>
              ))}
            </div>

            {/* Level 2 + 3 — subcategory columns */}
            <div className="max-h-[70vh] overflow-y-auto p-5">
              {activeCategory ? (
                <>
                  <div className="mb-3 flex items-center justify-between">
                    <Link
                      href={`/categories/${activeCategory.slug}`}
                      onClick={() => setOpen(false)}
                      className="font-serif text-lg hover:underline"
                    >
                      {activeCategory?.title}
                    </Link>
                    <Link
                      href={`/categories/${activeCategory.slug}`}
                      onClick={() => setOpen(false)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      مشاهدهٔ همه <ArrowLeft className="size-3.5" />
                    </Link>
                  </div>

                  {activeCategory.children?.length ? (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                      {activeCategory?.children.map((sub) => (
                        <div key={sub?.id}>
                          <Link
                            href={`/categories/${sub?.slug}`}
                            onClick={() => setOpen(false)}
                            className="mb-1.5 block text-sm font-medium hover:text-primary hover:underline"
                          >
                            {sub?.title}
                          </Link>
                          {sub?.children?.length ? (
                            <ul className="flex flex-col gap-1">
                              {sub?.children.map((leaf) => (
                                <li key={leaf?.id}>
                                  <Link
                                    href={`/categories/${leaf?.slug}`}
                                    onClick={() => setOpen(false)}
                                    className="block truncate text-sm text-muted-foreground transition-colors hover:text-foreground"
                                  >
                                    {leaf?.title}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      زیردسته‌ای برای این دسته ثبت نشده است.
                    </p>
                  )}
                </>
              ) : null}
            </div>

            {/* Promo */}
            <Link
              href="/products?sort=discount"
              onClick={() => setOpen(false)}
              className="cellar-glow group/promo relative flex flex-col justify-end gap-1 border-s border-border/60 p-5 transition-colors hover:bg-accent/40"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Tag className="size-5" />
              </span>
              <p className="mt-2 font-serif text-xl leading-tight">
                پیشنهادهای ویژه
              </p>
              <p className="text-sm text-muted-foreground">
                منتخب تخفیف‌های این هفته را ببینید.
              </p>
              <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary">
                مشاهده
                <ArrowLeft className="size-4 transition-transform group-hover/promo:-translate-x-1" />
              </span>
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Uses the real category image when available, falls back to a monogram chip. */
function CategoryThumb({
  category,
  active,
}: {
  category: CategoryTree;
  active: boolean;
}) {
  if (category?.image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- category images aren't
      // on a configured next/image domain yet; swap to <Image> once upload API lands.
      <img
        src={category?.image_url}
        alt=""
        className="size-8 shrink-0 rounded-lg object-cover"
      />
    );
  }
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg font-serif text-sm transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-primary/10 text-primary",
      )}
    >
      {category?.title.charAt(0)}
    </span>
  );
}
