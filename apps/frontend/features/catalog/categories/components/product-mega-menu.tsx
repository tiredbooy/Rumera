"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Grid2x2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { CategoryTree } from "../types";
import { getCategoryHref } from "../utils";
import { CategoryThumbnail } from "./category-thumbnail";

interface ProductsMegaMenuProps {
  categoryTree: CategoryTree[];
  promotion: ProductMenuPromotion;
}

interface MenuPosition {
  left: number;
  top: number;
  width: number;
}

export interface ProductMenuPromotion {
  href: string;
  title: string;
  description: string;
  ctaLabel: string;
}

/** Three-pane, RTL-aware category navigation for desktop storefronts. */
export function ProductsMegaMenu({
  categoryTree,
  promotion,
}: ProductsMegaMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [activeId, setActiveId] = React.useState<number | null>(
    categoryTree[0]?.id ?? null,
  );
  const [menuPosition, setMenuPosition] = React.useState<MenuPosition | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const categoryTabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressFocusOpen = React.useRef(false);
  const panelId = React.useId();

  const activeCategory =
    categoryTree.find((category) => category.id === activeId) ?? categoryTree[0];

  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }

  function openNow() {
    cancelClose();
    setOpen(true);
  }

  function closeSoon() {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  }

  function closeMenu() {
    cancelClose();
    setOpen(false);
  }

  const closeFromDocument = React.useEffectEvent(closeMenu);
  const updateMenuPosition = React.useEffectEvent(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const viewportWidth = document.documentElement.clientWidth;
    const width = Math.min(920, viewportWidth - 32);
    const triggerRect = trigger.getBoundingClientRect();
    const preferredLeft = triggerRect.right - width;

    setMenuPosition({
      left: Math.min(Math.max(16, preferredLeft), viewportWidth - width - 16),
      top: triggerRect.bottom + 8,
      width,
    });
  });

  function focusCategoryTab(index: number) {
    const nextCategory = categoryTree[index];
    if (!nextCategory) return;
    setActiveId(nextCategory.id);
    categoryTabRefs.current[index]?.focus();
  }

  React.useEffect(() => {
    return () => cancelClose();
  }, []);

  React.useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) closeFromDocument();
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  React.useLayoutEffect(() => {
    if (!open) return;

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
      onFocusCapture={() => {
        if (suppressFocusOpen.current) {
          suppressFocusOpen.current = false;
          return;
        }
        openNow();
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) closeMenu();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        suppressFocusOpen.current = true;
        closeMenu();
        triggerRef.current?.focus();
        requestAnimationFrame(() => {
          suppressFocusOpen.current = false;
        });
      }}
    >
      <Button
        ref={triggerRef}
        variant="ghost"
        size="sm"
        type="button"
        aria-controls={panelId}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
        className={cn("min-h-11 cursor-pointer gap-1", open && "bg-accent")}
      >
        محصولات
        <ChevronDown
          className={cn(
            "size-4 transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </Button>

      {open && menuPosition ? (
        <div
          className="fixed z-50"
          style={{
            left: menuPosition.left,
            top: menuPosition.top,
            width: menuPosition.width,
          }}
        >
          <div
            id={panelId}
            role="dialog"
            aria-label="دسته‌بندی محصولات"
            className="animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 shadow-e3 grid w-full grid-cols-[210px_minmax(0,1fr)_230px] overflow-hidden rounded-3xl border border-border/60 bg-popover/95 backdrop-blur-xl duration-150 motion-reduce:animate-none"
          >
            <div className="flex flex-col gap-1 border-e border-border/60 p-3">
              <div className="eyebrow mb-1 px-2">
                <Grid2x2 className="size-3.5" /> دسته‌بندی‌ها
              </div>
              <Link
                href="/products"
                onClick={closeMenu}
                className="flex min-h-11 items-center justify-between rounded-xl px-3 text-sm font-semibold text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                همهٔ محصولات
                <ArrowLeft className="size-4 text-primary" />
              </Link>

              <div role="tablist" aria-label="دسته‌بندی‌های اصلی">
              {categoryTree.map((category, index) => {
                const itemClassName = cn(
                  "group/category flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-start text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  activeCategory?.id === category.id
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                );
                const content = (
                  <>
                    <CategoryThumbnail
                      category={category}
                      active={activeCategory?.id === category.id}
                      size="sm"
                    />
                    <span className="flex-1 truncate">{category.title}</span>
                    <ArrowLeft className="size-3.5 shrink-0 text-primary" />
                  </>
                );

                return (
                  <button
                    key={category.id}
                    ref={(node) => {
                      categoryTabRefs.current[index] = node;
                    }}
                    id={`${panelId}-tab-${category.id}`}
                    type="button"
                    role="tab"
                    aria-controls={`${panelId}-tabpanel`}
                    aria-selected={activeCategory?.id === category.id}
                    tabIndex={activeCategory?.id === category.id ? 0 : -1}
                    onMouseEnter={() => setActiveId(category.id)}
                    onFocus={() => setActiveId(category.id)}
                    onClick={() => setActiveId(category.id)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        focusCategoryTab((index + 1) % categoryTree.length);
                      } else if (event.key === "ArrowUp") {
                        event.preventDefault();
                        focusCategoryTab(
                          (index - 1 + categoryTree.length) % categoryTree.length,
                        );
                      } else if (event.key === "Home") {
                        event.preventDefault();
                        focusCategoryTab(0);
                      } else if (event.key === "End") {
                        event.preventDefault();
                        focusCategoryTab(categoryTree.length - 1);
                      }
                    }}
                    className={itemClassName}
                  >
                    {content}
                  </button>
                );
              })}
              </div>
            </div>

            <div
              id={`${panelId}-tabpanel`}
              role={activeCategory ? "tabpanel" : undefined}
              aria-labelledby={
                activeCategory ? `${panelId}-tab-${activeCategory.id}` : undefined
              }
              className="max-h-[70vh] overflow-y-auto p-5"
            >
              {activeCategory ? (
                <CategoryColumns category={activeCategory} onNavigate={closeMenu} />
              ) : (
                <div className="flex h-full min-h-44 flex-col items-center justify-center gap-3 text-center">
                  <Grid2x2 className="size-8 text-primary" />
                  <div>
                    <p className="font-serif text-lg">همهٔ محصولات رومرا</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      دسته‌بندی‌ها هنوز در دسترس نیستند.
                    </p>
                  </div>
                  <Button variant="outline" asChild>
                    <Link href="/products" onClick={closeMenu}>
                      ورود به فروشگاه
                    </Link>
                  </Button>
                </div>
              )}
            </div>

            <Link
              href={promotion.href}
              onClick={closeMenu}
              className="cellar-glow group/promo relative flex min-h-56 flex-col justify-end gap-1 border-s border-border/60 p-5 outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Sparkles className="size-5" />
              </span>
              <p className="mt-2 font-serif text-xl leading-tight">
                {promotion.title}
              </p>
              <p className="text-sm text-muted-foreground">{promotion.description}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary">
                {promotion.ctaLabel}
                <ArrowLeft className="size-4 transition-transform group-hover/promo:-translate-x-1 motion-reduce:transition-none" />
              </span>
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CategoryColumns({
  category,
  onNavigate,
}: {
  category: CategoryTree;
  onNavigate: () => void;
}) {
  const categoryLink = getCategoryHref(category);
  const children = category.children ?? [];

  return (
    <>
      <div className="mb-4 flex min-h-10 items-center justify-between gap-3">
        <h2 className="font-serif text-lg">{category.title}</h2>
        {categoryLink ? (
          <Link
            href={categoryLink}
            onClick={onNavigate}
            className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            مشاهدهٔ همه <ArrowLeft className="size-3.5" />
          </Link>
        ) : null}
      </div>

      {children.length ? (
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
          {children.map((subcategory) => {
            const subcategoryLink = getCategoryHref(subcategory);
            const leaves = subcategory.children ?? [];

            return (
              <section key={subcategory.id} aria-label={subcategory.title}>
                {subcategoryLink ? (
                  <Link
                    href={subcategoryLink}
                    onClick={onNavigate}
                    className="mb-1.5 inline-flex min-h-8 items-center rounded-md text-sm font-semibold outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {subcategory.title}
                  </Link>
                ) : (
                  <h3 className="mb-1.5 flex min-h-8 items-center text-sm font-semibold">
                    {subcategory.title}
                  </h3>
                )}
                {leaves.length ? (
                  <ul className="flex flex-col gap-0.5">
                    {leaves.map((leaf) => {
                      const leafLink = getCategoryHref(leaf);
                      if (!leafLink) return null;

                      return (
                        <li key={leaf.id}>
                          <Link
                            href={leafLink}
                            onClick={onNavigate}
                            className="flex min-h-8 items-center truncate rounded-md px-1 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {leaf.title}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          زیردسته‌ای برای این دسته ثبت نشده است.
        </p>
      )}
    </>
  );
}
