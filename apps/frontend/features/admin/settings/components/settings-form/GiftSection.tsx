"use client";

import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Controller,
  useFieldArray,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { SiteSettingsFormValues } from "@/features/settings/validations";
import { faNum, formatPrice } from "@/lib/products";
import { cn } from "@/lib/utils";
import { Panel } from "./FormLayout";

const EMPTY_OPTION = {
  id: "",
  label: "",
  description: "",
  price: "0",
  enabled: true,
} as const;

export function GiftSection({
  register,
  control,
  errors,
}: {
  register: UseFormRegister<SiteSettingsFormValues>;
  control: Control<SiteSettingsFormValues>;
  errors: FieldErrors<SiteSettingsFormValues>;
}) {
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "giftOptions",
  });

  return (
    <TabsContent
      value="gift"
      forceMount
      className="mt-5 data-[state=inactive]:hidden"
    >
      <Panel
        title="هدیه در تسویه‌حساب"
        description="بسته‌بندی و افزونه‌های پولی — قیمت‌ها از سرور اعمال می‌شوند."
      >
        <div className="space-y-6 sm:col-span-2">
          <p className="text-sm leading-relaxed text-muted-foreground">
            شناسهٔ هر گزینه پایدار بماند (مثلاً{" "}
            <code className="text-xs">gift_wrap</code>) تا سفارش‌های قبلی و
            گزارش‌ها یکپارچه بمانند. ترتیب لیست همان ترتیب نمایش در تسویه است.
          </p>

          <div className="flex flex-col gap-3">
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-3">
              <span className="text-sm font-medium">
                فعال بودن هدیه در تسویه
              </span>
              <Controller
                name="giftEnabled"
                control={control}
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="فعال بودن هدیه"
                  />
                )}
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-3">
              <span className="text-sm font-medium">پیام هدیه</span>
              <Controller
                name="giftMessageEnabled"
                control={control}
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="پیام هدیه"
                  />
                )}
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-3">
              <span className="text-sm font-medium">
                مخفی‌کردن قیمت روی رسید
              </span>
              <Controller
                name="giftHidePriceEnabled"
                control={control}
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="مخفی قیمت"
                  />
                )}
              />
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-sm font-medium">گزینه‌های بسته‌بندی</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {fields.length > 0
                    ? `${faNum(fields.length)} گزینه`
                    : "هنوز گزینه‌ای نیست — یکی اضافه کنید."}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={() =>
                  append({
                    ...EMPTY_OPTION,
                    id: suggestOptionId(fields.length),
                    label: "گزینهٔ جدید",
                  })
                }
              >
                <Plus className="size-4" aria-hidden />
                افزودن گزینه
              </Button>
            </div>

            {typeof errors.giftOptions?.message === "string" ? (
              <p className="text-xs text-destructive" role="alert">
                {errors.giftOptions.message}
              </p>
            ) : null}

            {fields.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                مشتری در تسویه گزینه‌ای برای انتخاب نخواهد داشت تا زمانی که
                حداقل یک گزینهٔ فعال تعریف کنید.
              </div>
            ) : (
              <ul className="space-y-3">
                {fields.map((field, index) => {
                  const rowErrors = errors.giftOptions?.[index];
                  return (
                    <li
                      key={field.id}
                      className="rounded-2xl border border-border/60 bg-background/60 p-4 ring-1 ring-foreground/[0.03]"
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          گزینه {faNum(index + 1)}
                        </span>
                        <div className="flex flex-wrap items-center gap-1">
                          <Controller
                            name={`giftOptions.${index}.enabled`}
                            control={control}
                            render={({ field: sw }) => (
                              <label className="me-2 flex items-center gap-2 text-xs text-muted-foreground">
                                <Switch
                                  checked={sw.value}
                                  onCheckedChange={sw.onChange}
                                  aria-label={`فعال بودن گزینه ${index + 1}`}
                                />
                                فعال در تسویه
                              </label>
                            )}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 cursor-pointer"
                            disabled={index === 0}
                            onClick={() => move(index, index - 1)}
                            aria-label="جابه‌جایی به بالا"
                          >
                            <ChevronUp className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 cursor-pointer"
                            disabled={index >= fields.length - 1}
                            onClick={() => move(index, index + 1)}
                            aria-label="جابه‌جایی به پایین"
                          >
                            <ChevronDown className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 cursor-pointer text-destructive hover:text-destructive"
                            onClick={() => remove(index)}
                            aria-label="حذف گزینه"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`gift-opt-id-${field.id}`}>
                            شناسه (پایدار)
                          </Label>
                          <Input
                            id={`gift-opt-id-${field.id}`}
                            dir="ltr"
                            className={cn(
                              "font-mono text-sm",
                              rowErrors?.id && "border-destructive",
                            )}
                            placeholder="gift_wrap"
                            autoComplete="off"
                            {...register(`giftOptions.${index}.id`)}
                          />
                          {rowErrors?.id ? (
                            <p className="text-xs text-destructive" role="alert">
                              {rowErrors.id.message}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`gift-opt-label-${field.id}`}>
                            عنوان
                          </Label>
                          <Input
                            id={`gift-opt-label-${field.id}`}
                            className={cn(rowErrors?.label && "border-destructive")}
                            placeholder="بسته‌بندی هدیه"
                            {...register(`giftOptions.${index}.label`)}
                          />
                          {rowErrors?.label ? (
                            <p className="text-xs text-destructive" role="alert">
                              {rowErrors.label.message}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-col gap-1.5 sm:col-span-2">
                          <Label htmlFor={`gift-opt-desc-${field.id}`}>
                            توضیح (اختیاری)
                          </Label>
                          <Textarea
                            id={`gift-opt-desc-${field.id}`}
                            rows={2}
                            placeholder="نمایش زیر عنوان در تسویه…"
                            {...register(`giftOptions.${index}.description`)}
                          />
                          {rowErrors?.description ? (
                            <p className="text-xs text-destructive" role="alert">
                              {rowErrors.description.message}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`gift-opt-price-${field.id}`}>
                            قیمت (تومان)
                          </Label>
                          <Input
                            id={`gift-opt-price-${field.id}`}
                            dir="ltr"
                            inputMode="numeric"
                            placeholder="0 = رایگان"
                            className={cn(
                              "tabular-nums",
                              rowErrors?.price && "border-destructive",
                            )}
                            {...register(`giftOptions.${index}.price`)}
                          />
                          {rowErrors?.price ? (
                            <p className="text-xs text-destructive" role="alert">
                              {rowErrors.price.message}
                            </p>
                          ) : (
                            <PriceHint control={control} index={index} />
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </Panel>
    </TabsContent>
  );
}

function PriceHint({
  control,
  index,
}: {
  control: Control<SiteSettingsFormValues>;
  index: number;
}) {
  return (
    <Controller
      name={`giftOptions.${index}.price`}
      control={control}
      render={({ field }) => {
        const raw = String(field.value ?? "").trim();
        if (raw === "" || !/^\d+$/.test(raw)) {
          return (
            <p className="text-xs text-muted-foreground">
              خالی یا ۰ = رایگان در تسویه
            </p>
          );
        }
        const n = Number(raw);
        if (n === 0) {
          return (
            <p className="text-xs text-muted-foreground">رایگان در تسویه</p>
          );
        }
        return (
          <p className="text-xs text-muted-foreground tabular-nums">
            نمایش: {formatPrice(n)}
          </p>
        );
      }}
    />
  );
}

function suggestOptionId(count: number): string {
  if (count === 0) return "gift_wrap";
  return `gift_option_${count + 1}`;
}
