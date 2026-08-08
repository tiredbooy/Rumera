"use client";

import { cn } from "@/lib/utils";

export type ProductFormSectionLink = {
  id: string;
  label: string;
  hint?: string;
  hasError?: boolean;
};

/**
 * Sticky in-form table of contents so operators jump between product sections
 * without endless scrolling (Task 081a progressive disclosure companion).
 */
export function ProductFormSectionNav({
  sections,
  className,
}: {
  sections: ProductFormSectionLink[];
  className?: string;
}) {
  return (
    <nav
      aria-label="بخش‌های فرم محصول"
      className={cn(
        "border-hairline rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.04]",
        className,
      )}
    >
      <p className="text-xs font-semibold tracking-wide text-muted-foreground">
        پرش سریع
      </p>
      <ol className="mt-3 space-y-1">
        {sections.map((section, index) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className={cn(
                "flex min-h-10 items-center gap-2 rounded-xl px-2.5 text-sm transition-colors",
                "hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                section.hasError && "text-destructive",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold tabular-nums",
                  section.hasError
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{section.label}</span>
                {section.hint ? (
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {section.hint}
                  </span>
                ) : null}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
