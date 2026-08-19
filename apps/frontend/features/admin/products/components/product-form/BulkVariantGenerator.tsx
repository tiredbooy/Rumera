"use client";

import * as React from "react";
import { ChevronDown, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProductOptionGroup } from "@/features/admin/products/types";
import { cn } from "@/lib/utils";
import type { VariantFormValues } from "../../validations";

const MAX_BULK_VARIANTS = 100;

function combinationKey(ids: number[]) {
  return [...new Set(ids)].sort((left, right) => left - right).join(":");
}

function buildCombinations(groups: ProductOptionGroup[]) {
  return groups.reduce<number[][]>(
    (combinations, group) =>
      combinations.flatMap((combination) =>
        group.values.map((value) => [...combination, value.id]),
      ),
    [[]],
  );
}

export function BulkVariantGenerator({
  optionTypes,
  existingCombinations,
  disabled,
  onGenerate,
}: {
  optionTypes: ProductOptionGroup[];
  existingCombinations: number[][];
  disabled?: boolean;
  onGenerate: (variants: VariantFormValues[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [selectedTypeIds, setSelectedTypeIds] = React.useState<number[]>([]);
  const [basePrice, setBasePrice] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);
  // The preview step: the combinations the Cartesian product proposes, and the
  // ones the operator has struck off because that bottling is never sold in
  // that size. Deselection is keyed by combination, not by position, so it
  // survives re-computing the preview.
  const [preview, setPreview] = React.useState<number[][] | null>(null);
  const [excluded, setExcluded] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const selectableTypes = optionTypes.filter(
    (group) => group.values.length > 0,
  );
  const selectedGroups = selectableTypes.filter((group) =>
    selectedTypeIds.includes(group.id),
  );
  const combinationCount = selectedGroups.reduce(
    (count, group) => count * group.values.length,
    selectedGroups.length > 0 ? 1 : 0,
  );
  const validPrice =
    Number.isFinite(Number(basePrice)) && Number(basePrice) > 0;
  const exceedsLimit = combinationCount > MAX_BULK_VARIANTS;
  const valueLabels = new Map(
    selectableTypes.flatMap((group) =>
      group.values.map((value) => [value.id, value.value] as const),
    ),
  );
  const keptCombinations = (preview ?? []).filter(
    (ids) => !excluded.has(combinationKey(ids)),
  );

  if (selectableTypes.length === 0) return null;

  /** Discards a stale preview whenever the inputs that produced it change. */
  function resetPreview() {
    setMessage(null);
    setPreview(null);
    setExcluded(new Set());
  }

  function buildPreview() {
    const existing = new Set(existingCombinations.map(combinationKey));
    const combinations = buildCombinations(selectedGroups).filter(
      (ids) => !existing.has(combinationKey(ids)),
    );

    if (combinations.length === 0) {
      setMessage("همهٔ ترکیب‌های انتخاب‌شده از قبل وجود دارند.");
      return;
    }
    setMessage(null);
    setExcluded(new Set());
    setPreview(combinations);
  }

  function generate() {
    if (keptCombinations.length === 0) return;

    onGenerate(
      keptCombinations.map((optionValueIds) => ({
        sku: "",
        price: basePrice.trim(),
        compare_at_price: "",
        is_active: true,
        option_value_ids: optionValueIds,
      })),
    );
    const created = keptCombinations.length;
    setPreview(null);
    setExcluded(new Set());
    setMessage(
      `${created.toLocaleString("fa-IR")} تنوع تازه ساخته شد؛ SKU هر ردیف از کد محصول ساخته شد.`,
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-xl border border-dashed border-primary/25 bg-primary/[0.04]">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-start focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none"
            disabled={disabled}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-primary" aria-hidden />
              ساخت گروهی تنوع‌ها
            </span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {open
                ? "نوع ویژگی و قیمت پایه را انتخاب کنید"
                : "ساخت همهٔ ترکیب‌های ممکن"}
              <ChevronDown
                className={cn(
                  "size-4 transition-transform",
                  open && "rotate-180",
                )}
                aria-hidden
              />
            </span>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent forceMount hidden={!open}>
          <div className="space-y-4 border-t border-primary/15 px-4 py-4">
            <fieldset className="space-y-2">
              <legend className="text-xs font-medium">ابعاد ترکیب</legend>
              <div className="flex flex-wrap gap-2">
                {selectableTypes.map((group) => {
                  const checked = selectedTypeIds.includes(group.id);
                  const checkboxId = `bulk-option-type-${group.id}`;
                  return (
                    <Label
                      key={group.id}
                      htmlFor={checkboxId}
                      className={cn(
                        "min-h-11 cursor-pointer rounded-full border px-3 text-sm transition-colors",
                        checked
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Checkbox
                        id={checkboxId}
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={(nextChecked) => {
                          resetPreview();
                          setSelectedTypeIds((current) =>
                            nextChecked
                              ? [...current, group.id]
                              : current.filter((id) => id !== group.id),
                          );
                        }}
                      />
                      {group.display_name}
                      <span className="text-xs text-muted-foreground">
                        {group.values.length.toLocaleString("fa-IR")}
                      </span>
                    </Label>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-2 sm:max-w-xs">
              <Label htmlFor="bulk-variant-price">قیمت پایه (تومان)</Label>
              <Input
                id="bulk-variant-price"
                type="number"
                min={1}
                dir="ltr"
                value={basePrice}
                disabled={disabled}
                placeholder="مثلاً 1250000"
                onChange={(event) => {
                  setMessage(null);
                  setBasePrice(event.target.value);
                }}
              />
            </div>

            {preview ? (
              <fieldset className="space-y-2">
                <legend className="text-xs font-medium">
                  ترکیب‌هایی که ساخته می‌شوند
                </legend>
                <p className="text-xs text-muted-foreground">
                  ترکیبی که این محصول در آن عرضه نمی‌شود را بردارید تا ساخته
                  نشود.
                </p>
                <ul className="max-h-64 space-y-1 overflow-y-auto rounded-xl bg-background/60 p-2">
                  {preview.map((ids) => {
                    const key = combinationKey(ids);
                    const checkboxId = `bulk-preview-${key}`;
                    const label = ids
                      .map((id) => valueLabels.get(id) ?? String(id))
                      .join(" / ");
                    return (
                      <li key={key}>
                        <Label
                          htmlFor={checkboxId}
                          className="min-h-11 cursor-pointer gap-2 rounded-lg px-2 text-sm font-normal"
                        >
                          <Checkbox
                            id={checkboxId}
                            checked={!excluded.has(key)}
                            disabled={disabled}
                            onCheckedChange={(nextChecked) =>
                              setExcluded((current) => {
                                const next = new Set(current);
                                if (nextChecked) next.delete(key);
                                else next.add(key);
                                return next;
                              })
                            }
                          />
                          {label}
                        </Label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              {preview ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    disabled={disabled || keptCombinations.length === 0}
                    onClick={generate}
                  >
                    ساخت {keptCombinations.length.toLocaleString("fa-IR")} تنوع
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={resetPreview}
                  >
                    بازگشت
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    disabled ||
                    selectedGroups.length === 0 ||
                    !validPrice ||
                    exceedsLimit
                  }
                  onClick={buildPreview}
                >
                  پیش‌نمایش {combinationCount.toLocaleString("fa-IR")} ترکیب
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                ترکیب‌های تکراری به‌صورت خودکار نادیده گرفته می‌شوند.
              </p>
            </div>

            {exceedsLimit ? (
              <p role="alert" className="text-xs text-destructive">
                تعداد ترکیب‌ها بیشتر از{" "}
                {MAX_BULK_VARIANTS.toLocaleString("fa-IR")} است؛ ابعاد کمتری
                انتخاب کنید.
              </p>
            ) : null}
            {message ? (
              <p role="status" className="text-xs text-muted-foreground">
                {message}
              </p>
            ) : null}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
