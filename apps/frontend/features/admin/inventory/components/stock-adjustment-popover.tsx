"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Minus, Plus, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  FieldControl,
  fieldDescriptionId,
  fieldErrorId,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  InventoryMutationError,
  useAdjustVariantStock,
} from "@/features/inventory/hooks";
import type { InventoryItem } from "@/features/inventory/types";
import { faNum } from "@/lib/products";

import {
  MAX_INVENTORY_INTEGER,
  MIN_INVENTORY_INTEGER,
  parseStockAdjustment,
} from "../validations";

function adjustmentErrorMessage(error: unknown): string {
  if (!(error instanceof InventoryMutationError)) {
    return "ذخیرهٔ موجودی انجام نشد. دوباره تلاش کنید.";
  }
  if (error.code === "OUT_OF_STOCK") {
    return "موجودی در این فاصله تغییر کرده یا مقدار هدف مجاز نیست. صفحه را تازه کنید و دوباره تلاش کنید.";
  }
  if (error.code === "NOT_FOUND") {
    return "رکورد موجودی این واریانت پیدا نشد.";
  }
  if (error.code === "VALIDATION_ERROR") {
    return "مقدار موجودی معتبر نیست.";
  }
  return "ذخیرهٔ موجودی انجام نشد. دوباره تلاش کنید.";
}

export function StockAdjustmentPopover({
  inventory,
  compact = false,
}: {
  inventory: InventoryItem;
  compact?: boolean;
}) {
  const router = useRouter();
  const adjustment = useAdjustVariantStock();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [quantity, setQuantity] = React.useState("0");
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const inputID = `stock-adjustment-${inventory.product_variant_id}`;
  const titleID = `stock-adjustment-title-${inventory.product_variant_id}`;

  function setOpenState(nextOpen: boolean) {
    if (adjustment.isPending) return;
    setOpen(nextOpen);
    if (nextOpen) {
      setQuantity("0");
      setError(null);
    }
  }

  function changeQuantity(amount: number) {
    const current = parseStockAdjustment(quantity) ?? 0;
    setQuantity(
      String(
        Math.min(
          MAX_INVENTORY_INTEGER,
          Math.max(MIN_INVENTORY_INTEGER, current + amount),
        ),
      ),
    );
    setError(null);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsedQuantity = parseStockAdjustment(quantity);
    if (parsedQuantity === null) {
      setError("تغییر موجودی باید یک عدد صحیح غیرصفر در بازهٔ مجاز باشد.");
      inputRef.current?.focus();
      return;
    }

    try {
      await adjustment.mutateAsync({
        variantID: inventory.product_variant_id,
        input: {
          quantity: parsedQuantity,
          type: "adjustment",
          note: "تنظیم موجودی از پنل مدیریت",
        },
      });
      const signedQuantity = `${parsedQuantity > 0 ? "+" : "−"}${faNum(Math.abs(parsedQuantity))}`;
      toast.success(
        `تغییر ${signedQuantity} واحدی موجودی «${inventory.product_title}» ثبت شد`,
      );
      setOpen(false);
      router.refresh();
    } catch (reason) {
      const message = adjustmentErrorMessage(reason);
      setError(message);
      toast.error(message);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpenState}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size={compact ? "icon" : "sm"}
          className={compact ? "size-11" : "h-11"}
          aria-label={
            compact ? `تنظیم موجودی ${inventory.product_title}` : undefined
          }
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          {compact ? null : "تنظیم موجودی"}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 max-w-[calc(100vw-2rem)]"
        aria-labelledby={titleID}
      >
        <form onSubmit={save} aria-busy={adjustment.isPending || undefined}>
          <PopoverTitle id={titleID}>{inventory.product_title}</PopoverTitle>
          <p className="mt-0.5 text-xs text-muted-foreground" dir="ltr">
            {inventory.sku ?? `#${inventory.product_variant_id}`}
          </p>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            موجودی فعلی {faNum(inventory.stock_on_hand)} و موجودی رزروشده{" "}
            {faNum(inventory.committed_stock)} واحد است.
          </p>

          <div className="mt-4 space-y-1.5">
            <Label htmlFor={inputID}>تغییر موجودی</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={adjustment.isPending}
                onClick={() => changeQuantity(-1)}
                aria-label="کاهش تغییر موجودی"
              >
                <Minus className="size-4" aria-hidden />
              </Button>
              <FieldControl id={inputID} error={error} description>
                <Input
                  ref={inputRef}
                  id={inputID}
                  inputMode="numeric"
                  autoComplete="off"
                  dir="ltr"
                  className="h-11 text-center"
                  value={quantity}
                  disabled={adjustment.isPending}
                  onChange={(event) => {
                    setQuantity(event.target.value);
                    setError(null);
                  }}
                />
              </FieldControl>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={adjustment.isPending}
                onClick={() => changeQuantity(1)}
                aria-label="افزایش تغییر موجودی"
              >
                <Plus className="size-4" aria-hidden />
              </Button>
            </div>
            {error ? (
              <p
                id={fieldErrorId(inputID)}
                role="alert"
                className="text-xs leading-5 text-destructive"
              >
                {error}
              </p>
            ) : (
              <p
                id={fieldDescriptionId(inputID)}
                className="text-xs leading-5 text-muted-foreground"
              >
                عدد مثبت موجودی را افزایش و عدد منفی آن را کاهش می‌دهد.
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="mt-4 h-11 w-full"
            disabled={adjustment.isPending}
          >
            {adjustment.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            {adjustment.isPending ? "در حال ذخیره…" : "ذخیرهٔ موجودی"}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
