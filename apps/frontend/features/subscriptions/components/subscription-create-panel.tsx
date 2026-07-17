import { Check, Loader2, Repeat } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SubscriptionCadence } from "@/features/subscriptions/types";
import { cn } from "@/lib/utils";
import { cadenceLabel, cadenceShort } from "./subscription-display-helpers";

type SubscriptionCreatePanelProps = {
  cadence: SubscriptionCadence;
  isPending: boolean;
  onCadenceChange: (cadence: SubscriptionCadence) => void;
  onSubscribe: () => void;
};

export function SubscriptionCreatePanel({
  cadence,
  isPending,
  onCadenceChange,
  onSubscribe,
}: SubscriptionCreatePanelProps) {
  return (
    <div className="cellar-glow border-hairline rounded-3xl px-6 py-7 ring-1 ring-foreground/10">
      <p className="eyebrow">
        <Repeat className="size-3.5" /> اشتراک دوره‌ای
      </p>
      <h2 className="mt-2 font-serif text-2xl sm:text-3xl">باکس سرداب</h2>
      <p className="mt-2 max-w-xl text-base leading-relaxed text-muted-foreground">
        در هر دوره یک منتخب ویژه برایتان فرستاده می‌شود. هر زمان خواستید
        می‌توانید آن را متوقف یا لغو کنید.
      </p>
      <fieldset className="mt-5">
        <legend className="sr-only">انتخاب دورهٔ ارسال</legend>
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
            فعال‌سازی اشتراک
          </Button>
        </div>
      </fieldset>
    </div>
  );
}
