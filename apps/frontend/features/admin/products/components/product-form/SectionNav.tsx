"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

import {
  productFormSectionHref,
  productFormSectionId,
  type ProductFormSectionKey,
} from "./sections";

export type ProductFormSectionLink = {
  key: ProductFormSectionKey;
  label: string;
  hint?: string;
  hasError?: boolean;
};

/**
 * The product editor's section switcher (PE-5).
 *
 * Real links, not a `role="tablist"` widget: each section has its own URL, so
 * the browser's own affordances — open in a new tab, copy the link, back —
 * are the point, and `aria-current` is the right way to say which one is open.
 * Changing a price is now one click from a page load instead of a scroll past
 * an always-expanded eight-field general section.
 */
export function ProductFormSectionNav({
  sections,
  active,
  search,
  onSelect,
  className,
}: {
  sections: ProductFormSectionLink[];
  active: ProductFormSectionKey;
  /** Current query string, so a link keeps the params it does not own. */
  search: string;
  onSelect: (key: ProductFormSectionKey) => void;
  className?: string;
}) {
  return (
    <nav
      aria-label="بخش‌های فرم محصول"
      className={cn(
        "border-hairline -mx-1 mb-6 overflow-x-auto rounded-2xl bg-card p-1.5 ring-1 ring-foreground/[0.04]",
        className,
      )}
    >
      <ol className="flex min-w-max items-stretch gap-1">
        {sections.map((section, index) => {
          const isActive = section.key === active;
          return (
            <li key={section.key}>
              <a
                href={productFormSectionHref(search, section.key)}
                aria-current={isActive ? "page" : undefined}
                aria-controls={productFormSectionId(section.key)}
                onClick={(event) => {
                  if (
                    event.defaultPrevented ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey ||
                    event.button !== 0
                  ) {
                    return;
                  }
                  event.preventDefault();
                  onSelect(section.key);
                }}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm transition-colors",
                  "hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none",
                  isActive && "bg-accent text-foreground",
                  section.hasError && "text-destructive",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold tabular-nums",
                    section.hasError
                      ? "bg-destructive/10 text-destructive"
                      : isActive
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block font-medium whitespace-nowrap">
                    {section.label}
                  </span>
                  {section.hint ? (
                    <span className="block text-[11px] whitespace-nowrap text-muted-foreground">
                      {section.hint}
                    </span>
                  ) : null}
                </span>
                {section.hasError ? (
                  <span className="sr-only">نیاز به بررسی</span>
                ) : null}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
