import type { ReactNode } from "react";
import { Check, MapPin } from "lucide-react";

import type { ShippingMethod } from "@/features/shipping/types";
import { faNum } from "@/lib/products";
import { cn } from "@/lib/utils";

export function CheckoutSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof MapPin;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-hairline rounded-2xl bg-card p-6 ring-1 ring-foreground/5">
      <h2 className="mb-4 flex items-center gap-2 font-serif text-2xl">
        <Icon className="size-5 text-primary" /> {title}
      </h2>
      {children}
    </section>
  );
}

export function CheckoutSelectRow({
  name,
  value,
  selected,
  onClick,
  children,
}: {
  name: string;
  value: string;
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        "relative flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-start transition-colors",
        selected
          ? "border-primary bg-primary/10"
          : "border-border hover:border-primary/40",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={onClick}
        className="peer sr-only"
      />
      <span
        className="pointer-events-none absolute inset-0 rounded-xl peer-focus-visible:ring-3 peer-focus-visible:ring-ring/30"
        aria-hidden="true"
      />
      <span className="min-w-0">{children}</span>
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border",
        )}
        aria-hidden="true"
      >
        {selected ? <Check className="size-3" /> : null}
      </span>
    </label>
  );
}

export function CheckoutChoiceGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{label}</legend>
      <div className="flex flex-col gap-2">{children}</div>
    </fieldset>
  );
}

export function shippingDays(m?: ShippingMethod) {
  if (!m) return null;
  const { min_delivery_days: mn, max_delivery_days: mx } = m;
  if (mn && mx)
    return mn === mx
      ? `${faNum(mn)} روز کاری`
      : `${faNum(mn)} تا ${faNum(mx)} روز کاری`;
  if (mx) return `تا ${faNum(mx)} روز کاری`;
  return null;
}
