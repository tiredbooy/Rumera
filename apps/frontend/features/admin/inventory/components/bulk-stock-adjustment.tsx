"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Minus, Plus, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { InventoryItem, MovementType } from "@/features/inventory/types";
import { faNum } from "@/lib/products";

import { adjustErrorMessage } from "../adjust-errors";
import {
  bulkAdjustVariantStockAction,
  type BulkStockAdjustment,
} from "../bulk-actions";
import { parseStockAdjustment } from "../validations";

type DecreaseReason = Extract<MovementType, "adjustment" | "damage">;

/** Same shape of note the single adjust writes, marked as a batch. */
const BULK_NOTE: Record<"restock" | DecreaseReason, string> = {
  restock: "تأمین گروهی از پنل مدیریت",
  adjustment: "کاهش گروهی از پنل مدیریت",
  damage: "ضایعات / شکستگی گروهی از پنل مدیریت",
};

/** `fixed`: one delta for every row. `reorder`: each row's own suggestion. */
export type BulkAdjustMode = "fixed" | "reorder";

export type PlannedAdjustment = {
  row: InventoryItem;
  quantity: number;
  /** Non-null when the row stays out of the batch, carrying the reason why. */
  blocked: string | null;
};

/**
 * Turns the selection into one planned movement per row. Rows that cannot
 * produce a legal movement are kept in the list — the operator has to see which
 * of the selected rows will be skipped and why, before submitting, not after.
 */
export function planBulkAdjustments(
  rows: InventoryItem[],
  mode: BulkAdjustMode,
  quantity: number | null,
): PlannedAdjustment[] {
  return rows.map((row) => {
    const delta = mode === "reorder" ? row.reorder_quantity : (quantity ?? 0);
    if (delta === 0) {
      return {
        row,
        quantity: 0,
        blocked:
          mode === "reorder"
            ? "مقدار پیشنهادی ثبت نشده"
            : "مقدار تغییر معتبر نیست",
      };
    }
    // The API refuses this too (stock_on_hand + delta >= committed_stock); the
    // preflight is here so 3 doomed rows never enter a 40-row batch.
    if (row.stock_on_hand + delta < row.committed_stock) {
      return {
        row,
        quantity: delta,
        blocked: `کمتر از رزرو (${faNum(row.committed_stock)})`,
      };
    }
    return { row, quantity: delta, blocked: null };
  });
}

function signed(quantity: number): string {
  return `${quantity > 0 ? "+" : "−"}${faNum(Math.abs(quantity))}`;
}

/**
 * Selection toolbar for the inventory list (CF-18): select-all for the page,
 * the batch adjust panel, and the report of what a batch actually did.
 */
export function BulkStockAdjustment({
  pageRowCount,
  visibleRowCount = pageRowCount,
  facetActive = false,
  selected,
  allSelected,
  onToggleAll,
  onKeepOnly,
}: {
  /** Rows on the current server page — the unfiltered set. */
  pageRowCount: number;
  /** Rows DataTable is actually showing after facets. */
  visibleRowCount?: number;
  /** True when a facet is hiding rows — select-all must not claim the page. */
  facetActive?: boolean;
  selected: InventoryItem[];
  allSelected: boolean;
  onToggleAll: (next: boolean) => void;
  /** Narrows the selection to these variants (empty clears it). */
  onKeepOnly: (variantIDs: number[]) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<BulkAdjustMode>("fixed");
  const [quantity, setQuantity] = React.useState("0");
  const [reason, setReason] = React.useState<DecreaseReason>("adjustment");
  const [pending, setPending] = React.useState(false);
  const [failures, setFailures] = React.useState<
    { variantID: number; title: string; message: string }[]
  >([]);

  const parsedDelta = parseStockAdjustment(quantity);
  const planned = React.useMemo(
    () => planBulkAdjustments(selected, mode, parsedDelta),
    [selected, mode, parsedDelta],
  );
  const ready = planned.filter((plan) => plan.blocked === null);
  const blocked = planned.filter((plan) => plan.blocked !== null);
  const decreasing = mode === "fixed" && parsedDelta !== null && parsedDelta < 0;

  function setOpenState(next: boolean) {
    if (pending) return;
    setOpen(next);
  }

  function changeQuantity(amount: number) {
    setQuantity(String((parseStockAdjustment(quantity) ?? 0) + amount));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (ready.length === 0 || pending) return;

    const batch: BulkStockAdjustment[] = ready.map((plan) => ({
      variantID: plan.row.product_variant_id,
      quantity: plan.quantity,
      type: plan.quantity > 0 ? "restock" : reason,
      note: plan.quantity > 0 ? BULK_NOTE.restock : BULK_NOTE[reason],
    }));
    const titles = new Map(
      ready.map((plan) => [plan.row.product_variant_id, plan.row.product_title]),
    );

    setPending(true);
    setFailures([]);
    let result: Awaited<ReturnType<typeof bulkAdjustVariantStockAction>>;
    try {
      result = await bulkAdjustVariantStockAction(batch);
    } catch {
      // The action threw after some rows may already have committed. We do
      // not know which. "Failed" would invite a blind retry that double-moves
      // the ones that landed.
      setPending(false);
      toast.error(
        "وضعیت این دسته نامشخص است — بعضی ردیف‌ها ممکن است ثبت شده باشند. انتخاب را نگه داشتیم تا موجودی را بررسی کنید و فقط عمداً دوباره تلاش کنید.",
      );
      router.refresh();
      return;
    }
    setPending(false);

    if (!result.ok) {
      toast.error(adjustErrorMessage(result.error.code, result.error.message));
      return;
    }

    const { applied, failed } = result.data;
    setOpen(false);
    // The applied rows leave the selection either way, so the retry the
    // operator reaches for next cannot record a second movement for them.
    onKeepOnly(failed.map((failure) => failure.variantID));

    if (failed.length === 0) {
      toast.success(`موجودی ${faNum(applied.length)} ردیف ثبت شد`);
    } else {
      setFailures(
        failed.map((failure) => ({
          variantID: failure.variantID,
          title: titles.get(failure.variantID) ?? `#${failure.variantID}`,
          message: adjustErrorMessage(failure.code, failure.message),
        })),
      );
      toast.error(
        `${faNum(applied.length)} ردیف ثبت شد و ${faNum(failed.length)} ردیف ناموفق ماند`,
      );
    }
    router.refresh();
  }

  return (
    <div className="mb-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-muted/30 px-3 py-1.5 ring-1 ring-border/50">
        <label
          htmlFor="inventory-select-all"
          className="flex min-h-11 cursor-pointer items-center gap-2 text-xs"
        >
          <Checkbox
            id="inventory-select-all"
            checked={allSelected}
            disabled={(facetActive ? visibleRowCount : pageRowCount) === 0}
            onCheckedChange={(checked) => onToggleAll(checked === true)}
          />
          <span>
            {facetActive
              ? `انتخاب همهٔ ${faNum(visibleRowCount)} ردیف نمایش‌داده‌شده`
              : `انتخاب همهٔ ${faNum(pageRowCount)} ردیف این صفحه`}
          </span>
        </label>

        <p className="text-xs text-muted-foreground">
          {selected.length === 0
            ? "برای اعمال گروهی، ردیف‌ها را انتخاب کنید"
            : facetActive
              ? `${faNum(selected.length)} ردیف نمایش‌داده‌شده انتخاب شده · انتخاب با تغییر فیلتر پاک می‌شود`
              : `${faNum(selected.length)} ردیف انتخاب شده · انتخاب با تغییر صفحه یا فیلتر پاک می‌شود`}
        </p>

        <div className="ms-auto flex items-center gap-2">
          {selected.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-11"
              disabled={pending}
              onClick={() => onKeepOnly([])}
            >
              پاک کردن انتخاب
            </Button>
          ) : null}

          <Popover open={open} onOpenChange={setOpenState}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11"
                disabled={selected.length === 0}
              >
                <Wand2 className="size-4" aria-hidden />
                تنظیم گروهی موجودی
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-80 max-w-[calc(100vw-2rem)]"
            >
              <form onSubmit={submit} aria-busy={pending || undefined}>
                <PopoverTitle>
                  تنظیم موجودی {faNum(selected.length)} ردیف
                </PopoverTitle>

                <div className="mt-3 space-y-1.5">
                  <Label htmlFor="inventory-bulk-mode">مقدار</Label>
                  <NativeSelect
                    id="inventory-bulk-mode"
                    value={mode}
                    disabled={pending}
                    onChange={(event) =>
                      setMode(event.target.value as BulkAdjustMode)
                    }
                    className="w-full [&_[data-slot=native-select]]:h-11"
                  >
                    <NativeSelectOption value="fixed">
                      یک مقدار برای همهٔ ردیف‌ها
                    </NativeSelectOption>
                    <NativeSelectOption value="reorder">
                      مقدار پیشنهادی تأمین هر ردیف
                    </NativeSelectOption>
                  </NativeSelect>
                </div>

                {mode === "fixed" ? (
                  <div className="mt-3 space-y-1.5">
                    <Label htmlFor="inventory-bulk-quantity">
                      تغییر موجودی (±)
                    </Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={pending}
                        onClick={() => changeQuantity(-1)}
                        aria-label="کاهش تغییر موجودی"
                      >
                        <Minus className="size-4" aria-hidden />
                      </Button>
                      <Input
                        id="inventory-bulk-quantity"
                        inputMode="numeric"
                        autoComplete="off"
                        dir="ltr"
                        className="h-11 text-center"
                        value={quantity}
                        disabled={pending}
                        onChange={(event) => setQuantity(event.target.value)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={pending}
                        onClick={() => changeQuantity(1)}
                        aria-label="افزایش تغییر موجودی"
                      >
                        <Plus className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                ) : null}

                {decreasing ? (
                  <div className="mt-3 space-y-1.5">
                    <Label htmlFor="inventory-bulk-reason">دلیل کاهش</Label>
                    <NativeSelect
                      id="inventory-bulk-reason"
                      value={reason}
                      disabled={pending}
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

                <p className="mt-3 text-xs text-muted-foreground">
                  {mode === "fixed" && parsedDelta === null
                    ? "یک عدد صحیح غیرصفر وارد کنید؛ برای هر ردیف یک گردش جداگانه ثبت می‌شود."
                    : "برای هر ردیف یک گردش جداگانه با همین دلیل ثبت می‌شود."}
                </p>

                <ul
                  className="mt-2 max-h-40 space-y-1 overflow-auto rounded-xl bg-muted/40 p-2 text-xs"
                  // A page of “مقدار تغییر معتبر نیست” before the operator has
                  // typed anything is noise, not a warning.
                  hidden={mode === "fixed" && parsedDelta === null}
                >
                  {planned.map((plan) => (
                    <li
                      key={plan.row.product_variant_id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="min-w-0 truncate">
                        {plan.row.product_title}
                      </span>
                      {plan.blocked ? (
                        <span className="shrink-0 text-destructive">
                          {plan.blocked}
                        </span>
                      ) : (
                        <span className="shrink-0 font-medium tabular-nums">
                          {signed(plan.quantity)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                <Button
                  type="submit"
                  className="mt-4 h-11 w-full"
                  disabled={pending || ready.length === 0}
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : null}
                  {pending
                    ? "در حال ثبت…"
                    : `ثبت برای ${faNum(ready.length)} ردیف${
                        blocked.length > 0
                          ? ` · ${faNum(blocked.length)} ردیف نادیده`
                          : ""
                      }`}
                </Button>
              </form>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {failures.length > 0 ? (
        <div
          role="alert"
          className="rounded-xl bg-destructive/[0.07] px-3 py-2 text-xs ring-1 ring-destructive/25"
        >
          <p className="font-medium text-destructive">
            {faNum(failures.length)} ردیف ثبت نشد و در انتخاب باقی ماند؛ بقیه
            ثبت شده‌اند و دوباره اعمال نمی‌شوند.
          </p>
          <ul className="mt-1.5 space-y-1">
            {failures.map((failure) => (
              <li key={failure.variantID} className="leading-5">
                <span className="font-medium">{failure.title}</span>{" "}
                <span className="text-muted-foreground">
                  — {failure.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
