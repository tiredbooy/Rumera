"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Check, ChevronsUpDown, Loader2, Search, PackageSearch } from "lucide-react"

import { cn } from "@/lib/utils"
import { faNum, formatPrice } from "@/lib/products"
import {
  listProductVariants,
  listSelectableProducts,
} from "@/features/admin/products/api/client"
import type {
  ProductListItem,
  ProductVariant,
} from "@/features/catalog/products/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

/**
 * Two-step variant picker: choose a product, then a concrete variant. Resolves
 * to a `product_variant_id` (the shoppable link a recipe needs). Fully keyboard
 * accessible — a labelled trigger, a searchable product list, and a variant list
 * once a product is chosen. Data is fetched through the admin BFF proxy and
 * cached by TanStack Query so reopening the picker is instant.
 */

export type VariantOption = {
  variantId: number
  productTitle: string
  brand?: string | null
  sku?: string | null
  price: number
}

function useProducts(search: string) {
  return useQuery({
    queryKey: ["admin", "products", "picker", search],
    queryFn: () =>
      listSelectableProducts({ limit: 50, ...(search ? { search } : {}) }),
    staleTime: 2 * 60 * 1000,
  })
}

function useVariants(productId: number | null) {
  return useQuery({
    queryKey: ["admin", "products", productId, "variants"],
    enabled: !!productId,
    queryFn: () => listProductVariants(productId as number),
    staleTime: 2 * 60 * 1000,
  })
}

function variantLabel(opt: VariantOption | null): string {
  if (!opt) return ""
  const sku = opt.sku ? ` · ${opt.sku}` : ""
  return `${opt.productTitle}${sku}`
}

export function VariantPicker({
  value,
  onChange,
  initialLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  invalid,
}: {
  value: number | null
  onChange: (option: VariantOption | null) => void
  /** Pre-resolved label for an existing selection (edit mode). */
  initialLabel?: VariantOption | null
  ariaLabelledBy?: string
  ariaDescribedBy?: string
  invalid?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [step, setStep] = React.useState<"product" | "variant">("product")
  const [selectedProduct, setSelectedProduct] = React.useState<ProductListItem | null>(null)
  const variantStepRef = React.useRef<HTMLButtonElement>(null)
  // The label shown on the trigger once the user picks in-session.
  const [picked, setPicked] = React.useState<VariantOption | null>(null)

  // Show the in-session pick if present, otherwise fall back to the pre-resolved
  // edit-mode label — derived, so it stays correct when defaults load async.
  const label = picked ?? initialLabel ?? null

  function handleOpenChange(next: boolean) {
    setOpen(next)
    // Reset transient picker state whenever it closes.
    if (!next) {
      setStep("product")
      setSelectedProduct(null)
      setSearch("")
    }
  }

  const productsQuery = useProducts(open && step === "product" ? search : "")
  const variantsQuery = useVariants(step === "variant" ? (selectedProduct?.id ?? null) : null)

  const products = productsQuery.data?.results ?? []
  const variants = (variantsQuery.data ?? []).filter((variant) => variant.is_active)

  React.useEffect(() => {
    if (open && step === "variant") variantStepRef.current?.focus()
  }, [open, step])

  function chooseVariant(v: ProductVariant) {
    const option: VariantOption = {
      variantId: v.id,
      productTitle: selectedProduct?.title ?? "",
      brand: selectedProduct?.brand,
      sku: v.sku,
      price: v.price,
    }
    setPicked(option)
    onChange(option)
    setOpen(false)
  }

  const triggerText = value && label ? variantLabel(label) : "انتخاب فرآورده…"

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          aria-invalid={invalid || undefined}
          className={cn(
            "h-10 w-full justify-between gap-2 px-3 font-normal",
            !value && "text-muted-foreground",
            invalid && "border-destructive ring-3 ring-destructive/20"
          )}
        >
          <span className="truncate text-start">{triggerText}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-72 p-0"
      >
        {step === "product" ? (
          <div className="flex flex-col">
            <div className="relative border-b p-1.5">
              <Search className="pointer-events-none absolute inset-y-0 start-3.5 my-auto size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجوی محصول…"
                aria-label="جستجوی محصول"
                className="h-9 border-0 bg-transparent ps-9 shadow-none focus-visible:ring-0"
                autoFocus
              />
            </div>
            <div className="no-scrollbar max-h-64 overflow-y-auto p-1.5" aria-label="محصولات">
              {productsQuery.isLoading ? (
                <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> در حال بارگذاری…
                </p>
              ) : productsQuery.isError ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <p className="text-sm text-muted-foreground">بارگذاری محصولات ناموفق بود.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => productsQuery.refetch()}
                  >
                    تلاش دوباره
                  </Button>
                </div>
              ) : products.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">محصولی یافت نشد.</p>
              ) : (
                products.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedProduct(p)
                      setStep("variant")
                    }}
                    className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-2 py-2 text-start text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.title}</span>
                      {p.brand ? (
                        <span className="block truncate text-xs text-muted-foreground">{p.brand}</span>
                      ) : null}
                    </span>
                    <ChevronsUpDown className="size-3.5 shrink-0 rotate-90 opacity-40" />
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="flex items-center gap-2 border-b p-2">
              <Button
                ref={variantStepRef}
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2 text-muted-foreground"
                onClick={() => setStep("product")}
              >
                <ChevronsUpDown className="size-4 rotate-90" />
                بازگشت
              </Button>
              <span className="truncate text-sm font-medium">{selectedProduct?.title}</span>
            </div>
            <div className="no-scrollbar max-h-64 overflow-y-auto p-1.5" aria-label="تنوع‌ها">
              {variantsQuery.isLoading ? (
                <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> در حال بارگذاری تنوع‌ها…
                </p>
              ) : variantsQuery.isError ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <p className="text-sm text-muted-foreground">بارگذاری تنوع‌ها ناموفق بود.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => variantsQuery.refetch()}
                  >
                    تلاش دوباره
                  </Button>
                </div>
              ) : variants.length === 0 ? (
                <p className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
                  <PackageSearch className="size-5 opacity-60" />
                  این محصول تنوعی ندارد.
                </p>
              ) : (
                variants.map((v) => {
                  const active = v.id === value
                  return (
                    <button
                      key={v.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => chooseVariant(v)}
                      className={cn(
                        "flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-2 py-2 text-start text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                        active && "bg-muted"
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium" dir="ltr">
                          {v.sku || `#${faNum(v.id)}`}
                        </span>
                        <span className="block text-xs text-muted-foreground">{formatPrice(v.price)}</span>
                      </span>
                      {active ? <Check className="size-4 shrink-0 text-primary" /> : null}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
