"use client";

import type { FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { PRODUCT_LIST_SEARCH_MAX_LENGTH } from "@/features/catalog/products/list-routing";

/**
 * Catalogue search box for /products. Writes the `search` param the route
 * parser already reads, keeps the brand/sort filters (and any campaign params)
 * in place, and resets pagination — same idiom as {@link ProductSort}.
 */
export function ProductSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // ponytail: the URL is the single source of truth, so the input stays
  // uncontrolled and is remounted by `key` when the applied term changes.
  const active = params.get("search")?.trim() ?? "";

  function navigate(search: string) {
    const next = new URLSearchParams(params.toString());
    if (search) next.set("search", search);
    else next.delete("search");
    next.delete("page");
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("search");
    const submitted = typeof value === "string" ? value.trim() : "";
    if (submitted === active) return;
    navigate(submitted);
  }

  return (
    <form
      onSubmit={onSubmit}
      role="search"
      aria-label="جستجو در کاتالوگ"
      className="relative mt-6 w-full max-w-md"
    >
      <button
        type="submit"
        aria-label="اجرای جستجو"
        className="absolute inset-y-0 start-0 flex w-11 cursor-pointer items-center justify-center rounded-s-full text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <Search className="size-4" />
      </button>
      <input
        key={active}
        type="search"
        name="search"
        defaultValue={active}
        maxLength={PRODUCT_LIST_SEARCH_MAX_LENGTH}
        placeholder="جستجو در محصولات فروشگاه…"
        aria-label="عبارت جستجوی محصول"
        autoComplete="off"
        className="h-11 w-full rounded-full border border-border/70 bg-secondary/50 pe-11 ps-11 text-sm outline-none transition-[background-color,border-color,box-shadow] placeholder:text-muted-foreground/80 focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/20"
      />
      {active ? (
        <button
          type="button"
          onClick={() => navigate("")}
          aria-label="پاک‌کردن جستجو"
          className="absolute inset-y-0 end-0 flex w-11 cursor-pointer items-center justify-center rounded-e-full text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </form>
  );
}
