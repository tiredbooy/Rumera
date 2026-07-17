import { Check, MapPin, Truck, Wallet } from "lucide-react";

import { cn } from "@/lib/utils";

export const CHECKOUT_STEPS = [
  { key: "address", label: "آدرس", icon: MapPin },
  { key: "shipping", label: "ارسال", icon: Truck },
  { key: "payment", label: "پرداخت", icon: Wallet },
  { key: "review", label: "بازبینی", icon: Check },
] as const;

export type CheckoutStepKey = (typeof CHECKOUT_STEPS)[number]["key"];

/** Horizontal progress stepper. Past steps are clickable to jump back. */
export function CheckoutStepper({
  current,
  maxReached,
  onJump,
}: {
  current: number;
  maxReached: number;
  onJump: (i: number) => void;
}) {
  return (
    <ol className="flex items-center gap-2" aria-label="مراحل تسویه">
      {CHECKOUT_STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const reachable = i <= maxReached;
        const Icon = s.icon;
        return (
          <li key={s.key} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => reachable && onJump(i)}
              disabled={!reachable}
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                reachable ? "cursor-pointer" : "cursor-default",
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium transition-all duration-300",
                  active
                    ? "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15"
                    : done
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground",
                )}
              >
                {done ? (
                  <Check className="size-4" />
                ) : (
                  <Icon className="size-4" />
                )}
              </span>
              <span
                className={cn(
                  "hidden truncate text-sm sm:block",
                  active
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </button>
            {i < CHECKOUT_STEPS.length - 1 ? (
              <span
                className={cn(
                  "h-px flex-1 transition-colors",
                  i < current ? "bg-primary/40" : "bg-border",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
