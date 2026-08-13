import { Check, Loader2, Package, Repeat } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Address } from "@/features/addresses/types";
import type { SubscriptionCadence } from "@/features/subscriptions/types";
import { cn } from "@/lib/utils";
import { cadenceLabel, cadenceShort, formatAddress } from "./subscription-display-helpers";

type SubscriptionCreatePanelProps = {
  cadence: SubscriptionCadence;
  addressId: number | null;
  addresses: Address[];
  isPending: boolean;
  onCadenceChange: (cadence: SubscriptionCadence) => void;
  onAddressChange: (id: number | null) => void;
  onSubscribe: () => void;
};

export function SubscriptionCreatePanel({
  cadence,
  addressId,
  addresses,
  isPending,
  onCadenceChange,
  onAddressChange,
  onSubscribe,
}: SubscriptionCreatePanelProps) {
  return (
    <div className="cellar-glow border-hairline rounded-3xl px-6 py-7 ring-1 ring-foreground/10">
      <p className="eyebrow">
        <Package className="size-3.5" /> باکس فیزیکی دوره‌ای
      </p>
      <h2 className="mt-2 font-serif text-2xl sm:text-3xl">باکس سرداب</h2>
      <p className="mt-2 max-w-xl text-base leading-relaxed text-muted-foreground">
        در هر دوره یک منتخب فیزیکی ویژه برایتان فرستاده می‌شود — نه دسترسی
        نامحدود به فروشگاه. هر زمان می‌توانید یک دوره را رد کنید، موقتاً متوقف
        کنید یا لغو کنید.
      </p>
      <ul className="mt-3 max-w-xl list-inside list-disc space-y-1 text-sm text-muted-foreground">
        <li>فعال‌سازی الان پولی کسر نمی‌کند؛ یادآوری ارسال با ایمیل است.</li>
        <li>محتوای هر باکس را تیم فروشگاه برای همان دوره انتخاب می‌کند.</li>
      </ul>

      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-medium">دورهٔ ارسال</legend>
        <div className="flex flex-wrap items-center gap-2.5">
          {(["monthly", "quarterly"] as const).map((nextCadence) => (
            <button
              key={nextCadence}
              type="button"
              onClick={() => onCadenceChange(nextCadence)}
              aria-pressed={cadence === nextCadence}
              className={cn(
                "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium ring-1 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                cadence === nextCadence
                  ? "bg-primary text-primary-foreground ring-primary"
                  : "bg-secondary text-secondary-foreground ring-transparent hover:bg-accent",
              )}
            >
              {cadenceShort[nextCadence]}
              <span
                className={cn(
                  "text-xs",
                  cadence === nextCadence
                    ? "text-primary-foreground/80"
                    : "text-muted-foreground",
                )}
              >
                · {cadenceLabel(nextCadence)}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-medium">آدرس ارسال (اختیاری)</legend>
        {addresses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            هنوز آدرسی ندارید. می‌توانید بعداً از بخش آدرس‌ها اضافه کنید؛ تا آن
            زمان باکس بدون آدرس ثبت می‌شود.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="sr-only" htmlFor="sub-ship-address">
              انتخاب آدرس
            </label>
            <select
              id="sub-ship-address"
              value={addressId ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                onAddressChange(v === "" ? null : Number(v));
              }}
              className="border-hairline h-11 max-w-md cursor-pointer rounded-xl bg-background px-3 text-sm ring-1 ring-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">بدون آدرس — بعداً تکمیل می‌کنم</option>
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {(a.title || a.full_name) + " — " + formatAddress(a)}
                </option>
              ))}
            </select>
          </div>
        )}
      </fieldset>

      <div className="mt-6">
        <Button
          onClick={onSubscribe}
          disabled={isPending}
          className="h-11 cursor-pointer"
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Check className="size-4" aria-hidden />
          )}
          فعال‌سازی باکس {cadenceShort[cadence]}
        </Button>
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Repeat className="size-3.5 shrink-0" aria-hidden />
          بدون پرداخت خودکار درگاه در این مرحله
        </p>
      </div>
    </div>
  );
}
