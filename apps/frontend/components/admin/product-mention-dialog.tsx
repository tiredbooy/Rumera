"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, PackageSearch, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { listSelectableProducts } from "@/features/admin/products/api/client";
import { productPublicHref } from "@/features/catalog/products/catalogue-presentation";
import { faNum } from "@/lib/products";

export type ProductMention = { title: string; href: string };

/**
 * CE-4. Inserts a mention of a real catalogue product into an editorial body.
 *
 * Search runs server-side (`listSelectableProducts`, the same call the related
 * products picker uses) rather than filtering a first page client-side, so
 * product #101 is reachable.
 *
 * A mention serialises as a plain link to the product page: `sanitizeHtml`
 * keeps `href` and `title` on `<a>` and drops every class and data attribute,
 * so an anchor is the only mention the public renderer can actually render.
 */
export function ProductMentionDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (mention: ProductMention) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Radix unmounts this while closed, so the search box starts empty on
            every open without an effect. */}
        <ProductMentionBody
          onPick={onPick}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function ProductMentionBody({
  onPick,
  onClose,
}: {
  onPick: (mention: ProductMention) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search.trim());

  const products = useQuery({
    queryKey: ["admin", "product-mention", deferredSearch],
    queryFn: () =>
      listSelectableProducts({
        limit: 50,
        ...(deferredSearch ? { search: deferredSearch } : {}),
      }),
    staleTime: 2 * 60 * 1000,
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>اشاره به محصول</DialogTitle>
        <DialogDescription>
          محصول به‌صورت پیوند به صفحهٔ همان محصول درج می‌شود.
        </DialogDescription>
      </DialogHeader>

      <div className="relative">
        <Search
          className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={search}
          autoFocus
          onChange={(event) => setSearch(event.target.value)}
          placeholder="جستجوی محصول…"
          aria-label="جستجوی محصول برای درج"
          className="ps-9"
        />
      </div>

      <div className="max-h-72 overflow-y-auto" aria-live="polite">
        {products.isLoading ? (
          <p
            role="status"
            className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"
          >
            <Loader2 className="size-4 animate-spin" aria-hidden /> در حال
            بارگذاری…
          </p>
        ) : products.isError ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <p className="text-sm text-muted-foreground">
              بارگذاری محصولات ناموفق بود.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => products.refetch()}
            >
              تلاش دوباره
            </Button>
          </div>
        ) : products.data?.results.length ? (
          <ul className="list-none space-y-1 p-0">
            {products.data.results.map((product) => {
              const href = productPublicHref(product);
              return (
                <li key={product.id}>
                  <button
                    type="button"
                    disabled={!href}
                    onClick={() => {
                      if (!href) return;
                      onPick({ title: product.title, href });
                      onClose();
                    }}
                    className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-start text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {product.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {product.brand || `محصول ${faNum(product.id)}`}
                      </span>
                    </span>
                    {href ? null : (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        بدون نامک
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <PackageSearch className="size-5" aria-hidden /> محصولی پیدا نشد.
          </p>
        )}
      </div>
    </>
  );
}
