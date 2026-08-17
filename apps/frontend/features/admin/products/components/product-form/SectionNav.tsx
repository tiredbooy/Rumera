"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type ProductFormSectionLink = {
  id: string;
  label: string;
  hint?: string;
  hasError?: boolean;
};

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function openCollapsedSection(target: HTMLElement) {
  const trigger = target.querySelector<HTMLButtonElement>(
    "button[id$='-trigger']",
  );
  if (trigger?.getAttribute("aria-expanded") === "false") {
    trigger.click();
  }
}

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
  const [activeId, setActiveId] = React.useState(sections[0]?.id ?? "");

  React.useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const nodes = sections
      .map((section) => document.getElementById(section.id))
      .filter((node): node is HTMLElement => Boolean(node));
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActiveId(visible.target.id);
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [sections]);

  function jumpToSection(
    event: React.MouseEvent<HTMLAnchorElement>,
    id: string,
  ) {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    openCollapsedSection(target);
    target.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
    setActiveId(id);
    window.history.replaceState(null, "", `#${id}`);
  }

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
        {sections.map((section, index) => {
          const active = section.id === activeId;
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={active ? "true" : undefined}
                onClick={(event) => jumpToSection(event, section.id)}
                className={cn(
                  "flex min-h-10 items-center gap-2 rounded-xl px-2.5 text-sm transition-colors",
                  "hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  active && "bg-accent/70 text-foreground",
                  section.hasError && "text-destructive",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold tabular-nums",
                    section.hasError
                      ? "bg-destructive/10 text-destructive"
                      : active
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {section.label}
                  </span>
                  {section.hint ? (
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {section.hint}
                    </span>
                  ) : null}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
