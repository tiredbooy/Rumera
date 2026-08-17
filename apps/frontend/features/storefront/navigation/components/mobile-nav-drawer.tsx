"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Grid2x2,
  Menu,
  PackageOpen,
  User,
} from "lucide-react";

import { RumeraBrandMark } from "@/components/brand/rumera-brand-mark";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CategoryThumbnail } from "@/features/catalog/categories/components/category-thumbnail";
import type { CategoryTree } from "@/features/catalog/categories/types";
import { getCategoryHref } from "@/features/catalog/categories/utils";
import { brandCopy } from "@/lib/brand";

import { primaryNavigationItems } from "../config";
import { HeaderSearch } from "./header-search";

interface MobileNavDrawerProps {
  categoryTree: CategoryTree[];
  storeName?: string;
}

export function MobileNavDrawer({
  categoryTree,
  storeName,
}: MobileNavDrawerProps) {
  const [stack, setStack] = React.useState<CategoryTree[]>([]);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const levelHeadingRef = React.useRef<HTMLSpanElement>(null);
  const previousDepth = React.useRef(0);
  const activeCategory = stack.at(-1);
  const currentLevel = activeCategory?.children ?? categoryTree;

  function closeDrawer() {
    setSheetOpen(false);
  }

  React.useEffect(() => {
    if (!sheetOpen) {
      previousDepth.current = 0;
      return;
    }
    if (previousDepth.current === stack.length) return;

    previousDepth.current = stack.length;
    levelHeadingRef.current?.focus();
  }, [sheetOpen, stack.length]);

  return (
    <Sheet
      open={sheetOpen}
      onOpenChange={(nextOpen) => {
        setSheetOpen(nextOpen);
        if (!nextOpen) setStack([]);
      }}
    >
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="باز کردن منوی فروشگاه"
          className="size-11"
        >
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        aria-describedby={undefined}
        className="flex max-h-dvh flex-col overflow-x-hidden overflow-y-auto overscroll-contain p-0 [padding-bottom:env(safe-area-inset-bottom)] [padding-left:env(safe-area-inset-left)] [padding-right:env(safe-area-inset-right)] [padding-top:env(safe-area-inset-top)] data-[side=right]:h-dvh data-[side=right]:w-full data-[side=right]:max-w-[360px] data-[side=right]:sm:max-w-[360px]"
      >
        <SheetHeader className="border-b border-border/50 p-4 pe-16 pb-3">
          <SheetTitle className="sr-only">
            {storeName?.trim() || brandCopy.wordmarkFa}
          </SheetTitle>
          <RumeraBrandMark
            variant="full"
            size="sm"
            href="/"
            aria-label={`${storeName?.trim() || brandCopy.wordmarkFa} — خانه`}
          />
        </SheetHeader>

        <div className="px-4 pt-4">
          <HeaderSearch variant="drawer" onSubmitNavigate={closeDrawer} />
        </div>

        {!activeCategory ? (
          <nav aria-label="پیوندهای اصلی" className="mt-2 flex flex-col px-4 pb-2">
            {primaryNavigationItems.map((item) => (
              <DrawerLink
                key={item.href}
                href={item.href}
                onNavigate={closeDrawer}
              >
                <span className="flex items-center gap-2">
                  <item.icon className="size-4 text-muted-foreground" />
                  {item.label}
                </span>
                {item.href.startsWith("/products") ? (
                  <ArrowLeft className="size-4 text-primary" />
                ) : null}
              </DrawerLink>
            ))}
            <DrawerLink href="/account" onNavigate={closeDrawer}>
              <span className="flex items-center gap-2">
                <User className="size-4 text-muted-foreground" /> حساب کاربری
              </span>
            </DrawerLink>
          </nav>
        ) : null}

        <nav
          aria-label="دسته‌بندی محصولات"
          className="flex min-w-0 flex-1 flex-col px-4 pb-6"
        >
          <div className="mb-1 mt-3 flex min-h-11 items-center gap-2">
            {activeCategory ? (
              <button
                type="button"
                onClick={() => setStack((current) => current.slice(0, -1))}
                aria-label="بازگشت به دسته‌بندی قبلی"
                className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ArrowRight className="size-4" />
              </button>
            ) : (
              <Grid2x2 className="size-4 text-primary" />
            )}
            <span
              ref={levelHeadingRef}
              tabIndex={-1}
              className="eyebrow rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {activeCategory?.title ?? "دسته‌بندی‌ها"}
            </span>
          </div>

          {activeCategory ? (
            <CurrentCategoryLink
              category={activeCategory}
              onNavigate={closeDrawer}
            />
          ) : null}

          {currentLevel.length ? (
            <div className="grid grid-cols-1 gap-1">
              {currentLevel.map((category) => (
                <CategoryDrawerRow
                  key={category.id}
                  category={category}
                  onDrillDown={() =>
                    setStack((current) => [...current, category])
                  }
                  onNavigate={closeDrawer}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
              <PackageOpen className="size-8 text-primary" />
              <div>
                <p className="font-medium">
                  {activeCategory
                    ? "زیردسته‌ای ثبت نشده است"
                    : "دسته‌بندی‌ها در دسترس نیستند"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  همچنان می‌توانید همهٔ محصولات را ببینید.
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link href="/products" onClick={closeDrawer}>
                  مشاهدهٔ محصولات
                </Link>
              </Button>
            </div>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function DrawerLink({
  href,
  children,
  onNavigate,
}: {
  href: string;
  children: React.ReactNode;
  onNavigate: () => void;
}) {
  return (
    <SheetClose asChild>
      <Link
        href={href}
        onClick={onNavigate}
        className="flex min-h-11 items-center justify-between border-b border-border/50 text-sm font-medium outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
      >
        {children}
      </Link>
    </SheetClose>
  );
}

function CurrentCategoryLink({
  category,
  onNavigate,
}: {
  category: CategoryTree;
  onNavigate: () => void;
}) {
  const href = getCategoryHref(category);
  if (!href) return null;

  return (
    <SheetClose asChild>
      <Link
        href={href}
        onClick={onNavigate}
        className="mb-1 flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-xl px-3 text-sm font-semibold text-primary outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0 truncate">مشاهدهٔ همهٔ «{category.title}»</span>
        <ArrowLeft className="size-4 shrink-0" />
      </Link>
    </SheetClose>
  );
}

function CategoryDrawerRow({
  category,
  onDrillDown,
  onNavigate,
}: {
  category: CategoryTree;
  onDrillDown: () => void;
  onNavigate: () => void;
}) {
  const hasChildren = Boolean(category.children?.length);
  const href = getCategoryHref(category);
  const className =
    "group/category flex min-h-12 min-w-0 w-full cursor-pointer items-center gap-3 rounded-xl px-2 text-start text-sm text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";
  const content = (
    <>
      <CategoryThumbnail category={category} size="sm" />
      <span className="flex-1 truncate">{category.title}</span>
      {hasChildren ? <ArrowLeft className="size-4 shrink-0 text-primary" /> : null}
    </>
  );

  if (hasChildren) {
    return (
      <button type="button" onClick={onDrillDown} className={className}>
        {content}
      </button>
    );
  }

  if (!href) {
    return (
      <div className={className} aria-disabled="true">
        {content}
      </div>
    );
  }

  return (
    <SheetClose asChild>
      <Link href={href} onClick={onNavigate} className={className}>
        {content}
      </Link>
    </SheetClose>
  );
}
