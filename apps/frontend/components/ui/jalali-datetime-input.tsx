"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import {
  gregorianLocalToJalaliDisplay,
  jalaliDisplayToGregorianLocal,
} from "@/lib/datetime/jalali";
import { cn } from "@/lib/utils";

/**
 * Admin-friendly Jalali datetime field. Operators type Jalali dates; the
 * underlying value stays Gregorian `datetime-local` for API payloads.
 */
export function JalaliDateTimeInput({
  id,
  value,
  onChange,
  onBlur,
  disabled,
  invalid,
  className,
  name,
}: {
  id?: string;
  name?: string;
  value: string;
  onChange: (next: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}) {
  const [display, setDisplay] = React.useState(() =>
    gregorianLocalToJalaliDisplay(value),
  );
  const [localError, setLocalError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDisplay(gregorianLocalToJalaliDisplay(value));
  }, [value]);

  function commit(nextDisplay: string) {
    setDisplay(nextDisplay);
    if (!nextDisplay.trim()) {
      setLocalError(null);
      onChange("");
      return;
    }
    const converted = jalaliDisplayToGregorianLocal(nextDisplay);
    if (converted === null) {
      setLocalError("تاریخ شمسی نامعتبر — مثال: ۱۴۰۴/۰۵/۱۸ ۱۴:۳۰");
      return;
    }
    setLocalError(null);
    onChange(converted);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Input
        id={id}
        name={name}
        dir="ltr"
        inputMode="numeric"
        placeholder="۱۴۰۴/۰۵/۱۸ ۱۴:۳۰"
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
