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
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
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
import type { InventoryItem, MovementType } from "@/features/inventory/types";
import { faNum } from "@/lib/products";
import { cn } from "@/lib/utils";

import { adjustErrorMessage } from "../adjust-errors";
import {
  MAX_INVENTORY_INTEGER,
  MIN_INVENTORY_INTEGER,
  parseStockAdjustment,
} from "../validations";

const DEFAULT_QUICK_RESTOCK = [5, 10, 24, 50] as const;

type DecreaseReason = Extract<MovementType, "adjustment" | "damage">;

const DECREASE_REASON_NOTE: Record<DecreaseReason, string> = {
  adjustment: "کاهش موجودی از پنل مدیریت",
  damage: "ضایعات / شکستگی از پنل مدیریت",
};

function quickRestockUnits(reorderQuantity: number): number[] {
  const units = new Set<number>(DEFAULT_QUICK_RESTOCK);
  if (reorderQuantity > 0) {
    units.add(reorderQuantity);
  }
  return Array.from(units).sort((a, b) => a - b);
}

function adjustmentErrorMessage(error: unknown): string {
  return error instanceof InventoryMutationError
    ? adjustErrorMessage(error.code, error.message)
    : adjustErrorMessage(null);
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
  const [reason, setReason] = React.useState<DecreaseReason>("adjustment");
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const inputID = `stock-adjustment-${inventory.product_variant_id}`;
  const reasonID = `${inputID}-reason`;
  const titleID = `stock-adjustment-title-${inventory.product_variant_id}`;

  const restockChips = React.useMemo(
    () => quickRestockUnits(inventory.reorder_quantity),
    [inventory.reorder_quantity],
  );

  const parsedDelta = parseStockAdjustment(quantity);
  const previewOnHand =
    parsedDelta === null
      ? null
      : inventory.stock_on_hand + parsedDelta;
  const previewAvailable =
    previewOnHand === null
      ? null
      : previewOnHand - inventory.committed_stock;

  function setOpenState(nextOpen: boolean) {
    if (adjustment.isPending) return;
    setOpen(nextOpen);
    if (nextOpen) {
      setQuantity("0");
      setReason("adjustment");
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

  function applyQuickRestock(units: number) {
    setQuantity(String(units));
    setError(null);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Radix renders this popover in a portal, but React still propagates the
    // submit up the *React* tree — so inside the product editor this fired
    // ProductForm's onFormSubmit too, and every stock movement dragged a full
    // product aggregate save along with it. Stopped at the shared root so any
    // other form embedding the popover is covered as well.
    event.stopPropagation();
    setError(null);

    const parsedQuantity = parseStockAdjustment(quantity);
    if (parsedQuantity === null) {
      setError("تغییر موجودی باید یک عدد صحیح غیرصفر در بازهٔ مجاز باشد.");
      inputRef.current?.focus();
      return;
    }

    if (
      inventory.stock_on_hand + parsedQuantity <
      inventory.committed_stock
    ) {
      setError(
        `نمی‌توان کمتر از رزرو (${faNum(inventory.committed_stock)}) موجودی فیزیکی گذاشت.`,
      );
      inputRef.current?.focus();
      return;
    }

    const movementType: MovementType =
      parsedQuantity > 0 ? "restock" : reason;

    try {
      await adjustment.mutateAsync({
        variantID: inventory.product_variant_id,
        input: {
          quantity: parsedQuantity,
          type: movementType,
          note:
            parsedQuantity > 0
              ? "تأمین / افزایش موجودی از پنل مدیریت"
              : DECREASE_REASON_NOTE[reason],
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
        className="w-80 max-w-[calc(100vw-2rem)]"
        aria-labelledby={titleID}
      >
        <form onSubmit={save} aria-busy={adjustment.isPending || undefined}>
          <PopoverTitle id={titleID}>{inventory.product_title}</PopoverTitle>
          <p className="mt-0.5 text-xs text-muted-foreground" dir="ltr">
            {inventory.sku ?? `#${inventory.product_variant_id}`}
          </p>

          <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-2.5 text-center text-xs">
            <div>
              <dt className="text-muted-foreground">فیزیکی</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">
                {faNum(inventory.stock_on_hand)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">رزرو</dt>
              <dd className="mt-0.5 tabular-nums text-muted-foreground">
                {faNum(inventory.committed_stock)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">قابل فروش</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-primary">
                {faNum(inventory.available_stock)}
              </dd>
            </div>
          </dl>

          <div className="mt-3">
            <p className="mb-1.5 text-xs text-muted-foreground">
              تأمین سریع
              {inventory.reorder_quantity > 0
                ? ` · پیشنهاد ${faNum(inventory.reorder_quantity)}`
                : null}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {restockChips.map((units) => (
                <Button
                  key={units}
                  type="button"
                  size="sm"
                  variant={
                    units === inventory.reorder_quantity
                      ? "default"
                      : "secondary"
                  }
                  className="h-9 px-2.5 tabular-nums"
                  disabled={adjustment.isPending}
                  onClick={() => applyQuickRestock(units)}
                >
                  +{faNum(units)}
                </Button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            <Label htmlFor={inputID}>تغییر موجودی (±)</Label>
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
                className={cn(
                  "text-xs leading-5 text-muted-foreground",
                  previewOnHand !== null && "text-foreground",
                )}
              >
                {previewOnHand === null || previewAvailable === null ? (
                  <>
                    عدد مثبت تأمین می‌کند؛ منفی کم می‌کند. رزرو (
                    {faNum(inventory.committed_stock)}) قابل فروش را محدود
                    می‌کند.
                  </>
                ) : (
                  <>
                    بعد از ذخیره: فیزیکی {faNum(previewOnHand)} · قابل فروش{" "}
                    <span
                      className={
                        previewAvailable < 0
                          ? "text-destructive"
                          : "font-medium text-primary"
                      }
                    >
                      {faNum(previewAvailable)}
                    </span>
                  </>
                )}
              </p>
            )}
          </div>

          {parsedDelta !== null && parsedDelta < 0 ? (
            <div className="mt-3 flex min-w-0 flex-col gap-1.5">
              <Label htmlFor={reasonID}>دلیل کاهش</Label>
              <NativeSelect
                id={reasonID}
                value={reason}
                disabled={adjustment.isPending}
                onChange={(event) =>
                  setReason(event.target.value as DecreaseReason)
                }
                className="w-full [&_[data-slot=native-select]]:h-11"
              >
                <NativeSelectOption value="adjustment">
                  اصلاح دستی
                </NativeSelectOption>
                <NativeSelectOption value="damage">
                  ضایعات / شکستگی
                </NativeSelectOption>
              </NativeSelect>
            </div>
          ) : null}

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
