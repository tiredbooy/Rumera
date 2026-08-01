"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  PackageSearch,
  Search,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { listSelectableProducts } from "@/features/admin/products/api/client";
import type { ProductListItem } from "@/features/catalog/products/types";
import { faNum } from "@/lib/products";

export type JournalProductOption = Pick<
  ProductListItem,
  "id" | "title" | "brand"
>;

export function JournalProductPicker({
  value,
  initialOptions,
  onChange,
  disabled,
}: {
  value: number[];
  initialOptions: JournalProductOption[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search.trim());
  const [labels, setLabels] = React.useState<
    Record<number, JournalProductOption>
  >(() =>
    Object.fromEntries(initialOptions.map((option) => [option.id, option])),
  );
  const products = useQuery({
    queryKey: ["admin", "journal", "product-picker", deferredSearch],
    queryFn: () =>
      listSelectableProducts({
        limit: 50,
        ...(deferredSearch ? { search: deferredSearch } : {}),
      }),
    enabled: open,
    staleTime: 2 * 60 * 1000,
  });
  const selected = new Set(value);

  function add(product: ProductListItem) {
    if (selected.has(product.id)) return;
    setLabels((current) => ({
      ...current,
      [product.id]: {
        id: product.id,
        title: product.title,
        brand: product.brand,
      },
    }));
    onChange([...value, product.id]);
  }

  function remove(id: number) {
    onChange(value.filter((productID) => productID !== id));
  }

  return (
    <div className="space-y-3">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setSearch("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            افزودن محصول مرتبط
            <ChevronsUpDown className="size-4 opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) min-w-72 p-0"
        >
          <div className="relative border-b p-1.5">
            <Search
              className="pointer-events-none absolute inset-y-0 start-3.5 my-auto size-4 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="جستجوی محصول…"
              aria-label="جستجوی محصول مرتبط"
              className="h-9 border-0 bg-transparent ps-9 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-72 overflow-y-auto p-1.5" aria-live="polite">
            {products.isLoading ? (
              <p
                role="status"
                className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"
              >
                <Loader2 className="size-4 animate-spin" aria-hidden /> در حال
                بارگذاری…
              </p>
            ) : products.isError ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
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
              products.data.results.map((product) => {
                const active = selected.has(product.id);
                return (
                  <button
                    key={product.id}
                    type="button"
                    disabled={active}
                    onClick={() => add(product)}
                    className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-start text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:cursor-default disabled:opacity-60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {product.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {product.brand || `محصول ${faNum(product.id)}`}
                      </span>
                    </span>
                    {active ? (
                      <Check
                        className="size-4 shrink-0 text-primary"
                        aria-hidden
                      />
                    ) : null}
                  </button>
                );
              })
            ) : (
              <p className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
                <PackageSearch className="size-5" aria-hidden /> محصولی پیدا
                نشد.
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {value.length ? (
        <ul className="space-y-2" aria-label="محصولات مرتبط انتخاب‌شده">
          {value.map((id) => {
            const option = labels[id];
            return (
              <li
                key={id}
                className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2"
              >
                <span className="min-w-0 text-sm">
                  <span className="block truncate font-medium">
                    {option?.title ?? `محصول ${faNum(id)}`}
                  </span>
                  {option?.brand ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {option.brand}
                    </span>
                  ) : null}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled}
                  onClick={() => remove(id)}
                  aria-label={`حذف ${option?.title ?? `محصول ${faNum(id)}`} از نوشته`}
                >
                  <X className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          محصول مرتبطی انتخاب نشده است.
        </p>
      )}
    </div>
  );
}
