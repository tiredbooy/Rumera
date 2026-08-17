"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import {
  gregorianLocalToJalaliDisplay,
  jalaliDisplayToGregorianLocal,
} from "@/lib/datetime/jalali";
import { cn } from "@/lib/utils";

export type JalaliGranularity = "date" | "datetime";

/**
 * Admin-friendly Jalali field. Operators type Jalali dates; the committed
 * value stays Gregorian (`YYYY-MM-DD` or `datetime-local`) for APIs and
 * native form posts (via a hidden input when `name` is set).
 */
export function JalaliDateTimeInput({
  id,
  value,
  defaultValue,
  onChange,
  onBlur,
  disabled,
  invalid,
  className,
  name,
  granularity = "datetime",
}: {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (next: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  granularity?: JalaliGranularity;
}) {
  const dateOnly = granularity === "date";
  const controlled = value !== undefined;
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue ?? "");
  const committed = controlled ? value : uncontrolled;
  const [display, setDisplay] = React.useState(() =>
    gregorianLocalToJalaliDisplay(committed),
  );
  const [localError, setLocalError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDisplay(gregorianLocalToJalaliDisplay(committed));
  }, [committed]);

  function emit(next: string) {
    if (!controlled) setUncontrolled(next);
    onChange?.(next);
  }

  function commit(nextDisplay: string) {
    setDisplay(nextDisplay);
    if (!nextDisplay.trim()) {
      setLocalError(null);
      emit("");
      return;
    }
    const converted = jalaliDisplayToGregorianLocal(nextDisplay);
    if (converted === null || converted === "") {
      setLocalError(
        dateOnly
          ? "تاریخ شمسی نامعتبر — مثال: ۱۴۰۴/۰۵/۱۸"
          : "تاریخ شمسی نامعتبر — مثال: ۱۴۰۴/۰۵/۱۸ ۱۴:۳۰",
      );
      return;
    }
    setLocalError(null);
    emit(dateOnly ? converted.slice(0, 10) : converted);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Input
        id={id}
        dir="ltr"
        inputMode="numeric"
        placeholder={dateOnly ? "۱۴۰۴/۰۵/۱۸" : "۱۴۰۴/۰۵/۱۸ ۱۴:۳۰"}
        value={display}
        disabled={disabled}
        aria-invalid={invalid || Boolean(localError) || undefined}
        className={cn("font-mono", className)}
        onChange={(event) => setDisplay(event.target.value)}
        onBlur={() => {
          commit(display);
          onBlur?.();
        }}
      />
      {name ? <input type="hidden" name={name} value={committed} /> : null}
      <p className="text-[11px] text-muted-foreground">
        تاریخ شمسی (جلالی) — به صورت خودکار برای API میلادی می‌شود.
      </p>
      {localError ? (
        <p role="alert" className="text-xs text-destructive">
          {localError}
        </p>
      ) : null}
    </div>
  );
}
