"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseRegionCodes } from "@/features/shipping/validations";
import { cn } from "@/lib/utils";

/** Common Iranian province-style codes admins can pick without memorizing. */
export const IRAN_REGION_PRESETS: { code: string; label: string }[] = [
  { code: "IR-TEH", label: "تهران" },
  { code: "IR-ALB", label: "البرز" },
  { code: "IR-ISF", label: "اصفهان" },
  { code: "IR-KHR", label: "خراسان رضوی" },
  { code: "IR-FA", label: "فارس" },
  { code: "IR-EAZ", label: "آذربایجان شرقی" },
  { code: "IR-WAZ", label: "آذربایجان غربی" },
  { code: "IR-GIL", label: "گیلان" },
  { code: "IR-MZN", label: "مازندران" },
  { code: "IR-KHU", label: "خوزستان" },
  { code: "IR-QOM", label: "قم" },
  { code: "IR-QAZ", label: "قزوین" },
  { code: "IR-HD", label: "همدان" },
  { code: "IR-KR", label: "کرمان" },
  { code: "IR-YZD", label: "یزد" },
  { code: "IR", label: "سراسر ایران" },
];

function codesFromValue(value: string): string[] {
  return parseRegionCodes(value);
}

function valueFromCodes(codes: string[]): string {
  return codes.join("، ");
}

/**
 * Chip-based region coverage editor. Still serializes to the same string field
 * the zone form schema expects (comma-separated codes).
 */
export const RegionCodesEditor = React.forwardRef<
  HTMLInputElement,
  {
    id: string;
    value: string;
    onChange: (next: string) => void;
    onBlur?: () => void;
    disabled?: boolean;
    invalid?: boolean;
    describedBy?: string;
  }
>(function RegionCodesEditor(
  {
    id,
    value,
    onChange,
    onBlur,
    disabled = false,
    invalid = false,
    describedBy,
  },
  ref,
) {
  const [draft, setDraft] = React.useState("");
  const codes = codesFromValue(value);

  function commitCodes(next: string[]) {
    onChange(valueFromCodes(next));
  }

  function addCodes(raw: string) {
    const incoming = parseRegionCodes(raw);
    if (incoming.length === 0) return;
    commitCodes([...new Set([...codes, ...incoming])]);
    setDraft("");
  }

  function removeCode(code: string) {
    commitCodes(codes.filter((item) => item !== code));
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div
        className={cn(
          "flex min-h-14 flex-wrap items-center gap-2 rounded-xl border bg-background px-3 py-2 ring-0",
          invalid
            ? "border-destructive"
            : "border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30",
        )}
      >
        {codes.map((code) => (
          <Badge
            key={code}
            variant="secondary"
            className="inline-flex min-h-8 items-center gap-1 px-2.5 font-mono text-xs"
          >
            {code}
            <button
              type="button"
              disabled={disabled}
              onClick={() => removeCode(code)}
              className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none disabled:opacity-50"
              aria-label={`حذف ${code}`}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </Badge>
        ))}
        <Input
          ref={ref}
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          dir="ltr"
          spellCheck={false}
          placeholder={
            codes.length ? "کد دیگر…" : "مثلاً IR-TEH یا چند کد با ویرگول"
          }
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className="h-9 min-w-[12rem] flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addCodes(draft);
            }
            if (event.key === "Backspace" && !draft && codes.length) {
              removeCode(codes[codes.length - 1]!);
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 shrink-0"
          disabled={disabled || !draft.trim()}
          onClick={() => addCodes(draft)}
        >
          <Plus className="size-4" aria-hidden />
          افزودن
        </Button>
      </div>

      <details className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-foreground">
          چسباندن چند کد یک‌جا (bulk paste)
        </summary>
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
          کدها را با ویرگول، خط جدید یا فاصله بچسبانید؛ Enter یا «افزودن» همه را
          یکتا می‌کند. نمونه:{" "}
          <code className="font-mono">IR-TEH, IR-ISF, IR</code>
        </p>
        <textarea
          rows={3}
          dir="ltr"
          disabled={disabled}
          className="mt-2 w-full rounded-xl border border-input bg-background p-2 font-mono text-sm"
          placeholder="IR-TEH&#10;IR-ALB&#10;DE"
          onBlur={(event) => {
            if (event.target.value.trim()) {
              addCodes(event.target.value);
              event.target.value = "";
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              const target = event.currentTarget;
              addCodes(target.value);
              target.value = "";
            }
          }}
        />
      </details>

      <div className="flex flex-wrap gap-1.5">
        <span className="w-full text-[11px] font-medium text-muted-foreground">
          پیشنهادهای رایج (کلیک برای افزودن):
        </span>
        {IRAN_REGION_PRESETS.map((preset) => {
          const selected = codes.includes(preset.code);
          return (
            <button
              key={preset.code}
              type="button"
              disabled={disabled || selected}
              onClick={() => addCodes(preset.code)}
              className={cn(
                "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
                selected
                  ? "cursor-default border-primary/30 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                disabled && "opacity-50",
              )}
              aria-pressed={selected}
            >
              <span>{preset.label}</span>
              <span className="font-mono text-[10px] opacity-70">
                {preset.code}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
